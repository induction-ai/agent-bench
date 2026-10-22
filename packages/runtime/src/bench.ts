/**
 * A bench: one agent and customer run `count` times, `concurrency` at a time,
 * every run judged, then the scores and costs summarized in the bench
 * directory's results.json and results.html.
 *
 * Each run gets its own worker thread, because a run's HTTP recorder patches
 * the process-wide `fetch`. The worker loads the same entry script as the
 * bench, so that script's runBenchCli call runs again inside it and hands the
 * worker its one run (runBenchWorker).
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { Readable } from "node:stream";
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
} from "node:worker_threads";
import {
  generate_id,
  generate_run_id,
  gitInfo,
  readJson,
  run_agent,
  type AgentDef,
  type RunResult,
} from "./agent.ts";
import type { ModelSpec, Provider, SupportModelChoices } from "./model.ts";
import { formatCents, writeBenchHtml } from "./results_html.ts";
import type { UsageData } from "./usage.ts";

/** What every run of a bench shares: everything needed to rerun it. */
export type BenchConfig = {
  agent: string;
  provider: Provider;
  /** The agent's model spec as run, reasoning level included. */
  model: ModelSpec;
  /** The customer's name (never "auto" or "human"). */
  customer: string;
  /** The supporting models, as resolved before the first run. */
  support: SupportModelChoices;
  count: number;
  concurrency: number;
  bust_cache: boolean;
  /** Print each run's whole conversation, not only its progress lines. */
  verbose: boolean;
};

/** Contents of the bench's input.json. */
export type BenchInputRecord = BenchConfig & {
  bench_id: string;
  run_ids: string[];
};

/** One run as the bench records it. Only run_id, score and error are set
 *  when the run's worker died before it could report. */
export type BenchRun = {
  run_id: string;
  score: number | null;
  reasoning: string | null;
  error: string | null;
  usage?: UsageData;
  /** Total cost of the run in cents, every role included. */
  cost?: number;
  costs?: Record<string, UsageData>;
  customer_turns?: number;
  client_turns?: number;
  llm_latency_ms?: number;
  /** The run's results.html, relative to the bench directory. */
  results_html?: string;
};

export type BenchMetrics = {
  total: number;
  scored: number;
  failed: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
  /** Mean cost of a run in cents, over runs that ended without an error. */
  avg_cost: number;
  /** Cents by role, averaged over and summed across those runs. */
  avg_costs: Record<string, number>;
  total_costs: Record<string, number>;
  /** Runs left without a score after every retry. */
  excluded: number;
};

/** Contents of the bench's results.json. */
export type BenchResultRecord = {
  bench_id: string;
  timestamp: string;
  git_sha: string | null;
  git_url: string | null;
  agent: string;
  provider: Provider;
  model: ModelSpec;
  customer: string;
  support: SupportModelChoices;
  count: number;
  concurrency: number;
  metrics: BenchMetrics;
  /** The runs that were scored. */
  runs: BenchRun[];
  /** The runs left without a score after every retry. */
  excluded_runs: BenchRun[];
};

export type BenchResult = BenchResultRecord & {
  bench_dir: string;
  results_json: string;
  results_html: string;
};

// --- The pool ---

/** Attempts after the first for a run that ends without a score. */
const MAX_RETRIES = 3;

/** One attempt at a run, under way. */
export type RunAttempt = {
  result: Promise<BenchRun>;
  /** End the run early; it still reports, with the reason as its error. */
  abort: (reason: string) => void;
};

export type StartRun = (
  run_id: string,
  index: number,
  onTurn: (turn: number) => void
) => RunAttempt;

type RunHandle = {
  run_id: string;
  turns: number;
  abort: ((reason: string) => void) | null;
};

export type PoolOptions = {
  run_ids: string[];
  concurrency: number;
  startRun: StartRun;
  /** Called before each retry of `run_id`, so the retry starts fresh. */
  beforeRetry: (run_id: string) => void;
  /** When aborted, no run starts or retries, and the runs under way end. */
  abortSignal?: AbortSignal;
  log?: (message: string) => void;
};

/**
 * Run every id, `concurrency` at a time, retrying a run that ends without a
 * score up to MAX_RETRIES times. Once 90% of runs have finished, a run whose
 * turn count passes twice the most any finished run took (and at least 10) is
 * stopped as a runaway.
 */
export async function run_pool({
  run_ids,
  concurrency,
  startRun,
  beforeRetry,
  abortSignal,
  log = console.log,
}: PoolOptions): Promise<BenchRun[]> {
  const count = run_ids.length;
  const results = new Array<BenchRun>(count);
  const handles: RunHandle[] = [];
  const finishedTurns: number[] = [];
  let completed = 0;
  let next = 0;

  const stopRunaways = () => {
    if (count < 2) return;
    if (completed < Math.ceil(count * 0.9)) return;
    const maxFinished = Math.max(...finishedTurns, 0);
    if (maxFinished === 0) return;
    const limit = Math.max(maxFinished * 2, 10);
    for (const h of handles) {
      if (h.abort && h.turns > limit) {
        const reason = `${h.turns} turns exceeds 2× max finished (${maxFinished})`;
        log(`[Bench] Stopping run ${h.run_id}: ${reason}`);
        h.abort(reason);
      }
    }
  };

  const stopAll = () => {
    for (const h of handles) h.abort?.("Interrupted");
  };
  abortSignal?.addEventListener("abort", stopAll, { once: true });

  async function runOne(index: number, handle: RunHandle): Promise<BenchRun> {
    const run_id = handle.run_id;
    log(`[${index + 1}] ${run_id}`);
    let last: BenchRun | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (abortSignal?.aborted) {
        return (
          last ?? { run_id, score: null, reasoning: null, error: "Interrupted" }
        );
      }
      if (attempt > 0) beforeRetry(run_id);
      handle.turns = 0;
      const run = startRun(run_id, index, (turn) => {
        handle.turns = turn;
        stopRunaways();
      });
      handle.abort = run.abort;
      last = await run.result;
      handle.abort = null;
      if (last.score !== null) return last;
      if (attempt < MAX_RETRIES && !abortSignal?.aborted) {
        log(
          `\n  Retrying run ${run_id} (attempt ${attempt + 2}/${MAX_RETRIES + 1}): ${last.error}`
        );
      }
    }
    return { ...last!, error: "Max retries exceeded" };
  }

  async function take(): Promise<void> {
    while (next < count && !abortSignal?.aborted) {
      const index = next++;
      const handle: RunHandle = {
        run_id: run_ids[index]!,
        turns: 0,
        abort: null,
      };
      handles.push(handle);
      results[index] = await runOne(index, handle);
      finishedTurns.push(handle.turns);
      completed++;
      log(`[Bench] Completed ${completed}/${count} runs`);
      stopRunaways();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, count) }, () => take())
  );
  abortSignal?.removeEventListener("abort", stopAll);
  // Runs never started because of an interrupt.
  for (let i = 0; i < count; i++) {
    results[i] ??= {
      run_id: run_ids[i]!,
      score: null,
      reasoning: null,
      error: "Interrupted",
    };
  }
  return results;
}

// --- Metrics ---

const round = (n: number, places: number) =>
  Math.round(n * 10 ** places) / 10 ** places;

/** Score statistics over the runs that were scored, and costs over the runs
 *  that ended without an error. */
export function compute_metrics(
  runs: BenchRun[]
): Omit<BenchMetrics, "excluded"> {
  const scores = runs
    .map((r) => r.score)
    .filter((s): s is number => s !== null);
  const failed = runs.length - scores.length;
  if (scores.length === 0) {
    return {
      total: runs.length,
      scored: 0,
      failed,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stddev: 0,
      avg_cost: 0,
      avg_costs: {},
      total_costs: {},
    };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[Math.floor(mid)]!;
  const variance =
    scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;

  const successful = runs.filter((r) => !r.error);
  const total_costs: Record<string, number> = {};
  for (const r of successful) {
    for (const [role, usage] of Object.entries(r.costs ?? {})) {
      total_costs[role] = (total_costs[role] ?? 0) + usage.cost_cents;
    }
  }
  const avg_costs: Record<string, number> = {};
  for (const [role, total] of Object.entries(total_costs)) {
    total_costs[role] = round(total, 4);
    avg_costs[role] = round(total / successful.length, 4);
  }
  const avg_cost =
    successful.length > 0
      ? successful.reduce((sum, r) => sum + (r.cost ?? 0), 0) /
        successful.length
      : 0;

  return {
    total: runs.length,
    scored: scores.length,
    failed,
    mean: round(mean, 2),
    median,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    stddev: round(Math.sqrt(variance), 2),
    avg_cost: round(avg_cost, 4),
    avg_costs,
    total_costs,
  };
}

function printSummary(metrics: BenchMetrics) {
  if (metrics.scored === 0) {
    console.error("\nNo runs produced a score.");
    if (metrics.excluded > 0) {
      console.error(
        `${metrics.excluded} run(s) failed after retries and were excluded.`
      );
    }
    return;
  }
  console.log(
    metrics.excluded > 0
      ? `\nResults (${metrics.scored} runs; ${metrics.excluded} failed after retries and excluded):`
      : `\nResults (${metrics.scored} runs):`
  );
  console.log(`  Mean:   ${metrics.mean.toFixed(1)}/10`);
  console.log(`  Median: ${metrics.median.toFixed(1)}/10`);
  console.log(`  Min:    ${metrics.min}/10`);
  console.log(`  Max:    ${metrics.max}/10`);
  console.log(`  Stddev: ${metrics.stddev.toFixed(2)}`);
  console.log(`  Cost:   ${formatCents(metrics.avg_cost)} per run`);
  if (metrics.excluded > 0) {
    console.error(
      `  ${metrics.excluded} run(s) excluded (failed after retries).`
    );
  }
}

// --- Workers ---

/** What a worker is handed: its one run. */
type BenchJob = Omit<BenchConfig, "count" | "concurrency"> & {
  run_id: string;
  log_dir: string;
};

type WorkerMessage =
  | { type: "turn"; turn: number }
  | { type: "result"; run: BenchRun };

/** Whether this thread is a bench worker, which runs one run and exits. */
export function isBenchWorker(): boolean {
  return (
    !isMainThread &&
    typeof workerData === "object" &&
    workerData !== null &&
    "bench_job" in workerData
  );
}

/** The bench's record of a finished run, without the transcript. */
function benchRun(result: RunResult, bench_dir: string): BenchRun {
  return {
    run_id: result.run_id,
    score: result.score,
    reasoning: result.reasoning,
    error: result.error,
    usage: result.usage,
    cost: result.cost,
    costs: result.costs,
    customer_turns: result.customer_turns,
    client_turns: result.client_turns,
    llm_latency_ms: result.llm_latency_ms,
    results_html: path
      .relative(bench_dir, result.results_html)
      .replace(/\\/g, "/"),
  };
}

/** Run the job this worker was handed and report it to the bench. */
export async function runBenchWorker(
  agents: Record<string, AgentDef>
): Promise<void> {
  const job = (workerData as { bench_job: BenchJob }).bench_job;
  const port = parentPort!;
  const controller = new AbortController();
  port.on("message", (msg: { type?: string; reason?: string }) => {
    if (msg.type === "abort") controller.abort(msg.reason ?? "Interrupted");
  });
  const result = await run_agent({
    agents,
    agent: job.agent,
    provider: job.provider,
    model: job.model,
    customer: job.customer,
    support: job.support,
    run_id: job.run_id,
    log_dir: job.log_dir,
    judge: true,
    bust_cache: job.bust_cache,
    quiet: !job.verbose,
    abortSignal: controller.signal,
    onTurn: (turn) =>
      port.postMessage({ type: "turn", turn } satisfies WorkerMessage),
  });
  port.postMessage({
    type: "result",
    run: benchRun(result, job.log_dir),
  } satisfies WorkerMessage);
  // Open sockets in the SDK clients would otherwise keep the worker alive.
  setImmediate(() => process.exit(0));
}

/** Echo a worker's output, each line tagged with its run's number. */
function pipeLines(
  stream: Readable,
  tag: string,
  write: (line: string) => void
) {
  readline
    .createInterface({ input: stream })
    .on("line", (line) => write(`[${tag}] ${line}`));
}

function startWorker(
  entry: string,
  job: BenchJob,
  index: number,
  onTurn: (turn: number) => void
): RunAttempt {
  const worker = new Worker(entry, {
    workerData: { bench_job: job },
    stdout: true,
    stderr: true,
  });
  const tag = String(index + 1);
  pipeLines(worker.stdout, tag, console.log);
  pipeLines(worker.stderr, tag, console.error);

  const failed = (error: string): BenchRun => ({
    run_id: job.run_id,
    score: null,
    reasoning: null,
    error,
  });
  const result = new Promise<BenchRun>((resolve) => {
    let run: BenchRun | undefined;
    worker.on("message", (msg: WorkerMessage) => {
      if (msg.type === "turn") onTurn(msg.turn);
      else run = msg.run;
    });
    worker.on("error", (err) =>
      resolve(failed(err.stack ? `${err.message}\n${err.stack}` : err.message))
    );
    worker.on("exit", (code) =>
      resolve(run ?? failed(`Worker exited with code ${code}`))
    );
  });
  return {
    result,
    abort: (reason) => worker.postMessage({ type: "abort", reason }),
  };
}

// --- The bench ---

export type RunBenchOptions = {
  /** Parent directory of the bench directory. */
  log_dir: string;
  /** Resume this bench: its saved run ids are run again, and any the count
   *  still lacks are added. Finished runs replay from their recordings. */
  bench_id?: string;
  /** The script that called runBenchCli, which each worker loads. */
  entry: string;
  abortSignal?: AbortSignal;
  /** The command as typed, for the “rerun with” hint. */
  command: string;
};

export async function run_bench(
  config: BenchConfig,
  opts: RunBenchOptions
): Promise<BenchResult> {
  const bench_id = opts.bench_id ?? generate_id("b");
  const bench_dir = path.join(opts.log_dir, bench_id);
  fs.mkdirSync(bench_dir, { recursive: true });

  const saved = readJson(
    path.join(bench_dir, "input.json")
  ) as BenchInputRecord | null;
  const run_ids = [...(saved?.run_ids ?? [])];
  while (run_ids.length < config.count) run_ids.push(generate_run_id());
  const input: BenchInputRecord = { bench_id, ...config, run_ids };
  fs.writeFileSync(
    path.join(bench_dir, "input.json"),
    JSON.stringify(input, null, 2) + "\n"
  );

  const rerun = `${opts.command} --bench_id ${bench_id}`;
  console.log(`Bench: ${bench_id}`);
  console.log(rerun);
  console.log(
    `Bench: ${config.agent} ${config.provider} (${config.model}) | customer=${config.customer} | count=${config.count} concurrency=${config.concurrency}`
  );

  const { count: _count, concurrency: _concurrency, ...shared } = config;
  const results = await run_pool({
    run_ids,
    concurrency: config.concurrency,
    startRun: (run_id, index, onTurn) =>
      startWorker(
        opts.entry,
        { ...shared, run_id, log_dir: bench_dir },
        index,
        onTurn
      ),
    // A fresh attempt: without its recordings the run doesn't replay.
    beforeRetry: (run_id) =>
      fs.rmSync(path.join(bench_dir, run_id, "recordings"), {
        recursive: true,
        force: true,
      }),
    abortSignal: opts.abortSignal,
  });

  const runs = results.filter((r) => r.score !== null);
  const excluded_runs = results
    .filter((r) => r.score === null)
    .map((r) => ({
      ...r,
      results_html: r.results_html ?? `${r.run_id}/results.html`,
    }));
  const git = gitInfo();
  const record: BenchResultRecord = {
    bench_id,
    timestamp: new Date().toISOString(),
    git_sha: git.sha,
    git_url: git.url,
    agent: config.agent,
    provider: config.provider,
    model: config.model,
    customer: config.customer,
    support: config.support,
    count: config.count,
    concurrency: config.concurrency,
    metrics: { ...compute_metrics(runs), excluded: excluded_runs.length },
    runs,
    excluded_runs,
  };
  const results_json = path.join(bench_dir, "results.json");
  const results_html = path.join(bench_dir, "results.html");
  fs.writeFileSync(results_json, JSON.stringify(record, null, 2) + "\n");
  await writeBenchHtml(bench_dir, record);

  printSummary(record.metrics);
  console.log(`\nBench ID: ${bench_id}`);
  console.log(rerun);
  const shown = path.relative(process.cwd(), results_html);
  console.log(shown.startsWith("..") ? results_html : shown);
  return { ...record, bench_dir, results_json, results_html };
}
