import { describe, expect, it } from "vitest";
import {
  compute_metrics,
  run_pool,
  type BenchRun,
  type RunAttempt,
  type StartRun,
} from "../src/bench.ts";
import type { UsageData } from "../src/usage.ts";

const usage = (cost_cents: number): UsageData => ({
  input: 0,
  output: 0,
  cached_input: 0,
  uncached_input: 0,
  cache_write_input: 0,
  calls: 1,
  cost_cents,
  cost_if_no_caching_cents: cost_cents,
});

const scored = (run_id: string, score: number, cost = 0): BenchRun => ({
  run_id,
  score,
  reasoning: null,
  error: null,
  cost,
  costs: { agent: usage(cost) },
});

const failed = (run_id: string, error: string): BenchRun => ({
  run_id,
  score: null,
  reasoning: null,
  error,
});

const ids = (n: number) => Array.from({ length: n }, (_, i) => `r_${i + 1}`);

/** A run that ends as soon as it starts. */
const finished = (run: BenchRun): RunAttempt => ({
  result: Promise.resolve(run),
  abort: () => {},
});

describe("compute_metrics", () => {
  it("summarizes the scores of the scored runs", () => {
    const m = compute_metrics([
      scored("a", 6),
      scored("b", 8),
      scored("c", 9),
      scored("d", 9),
    ]);
    expect(m).toMatchObject({
      total: 4,
      scored: 4,
      failed: 0,
      mean: 8,
      median: 8.5,
      min: 6,
      max: 9,
      stddev: 1.22,
    });
  });

  it("averages cost over the runs that ended without an error", () => {
    const m = compute_metrics([
      scored("a", 7, 10),
      scored("b", 7, 30),
      {
        ...failed("c", "Judge failed"),
        cost: 500,
        costs: { agent: usage(500) },
      },
    ]);
    expect(m.avg_cost).toBe(20);
    expect(m.total_costs).toEqual({ agent: 40 });
    expect(m.avg_costs).toEqual({ agent: 20 });
  });

  it("reports zeros when no run was scored", () => {
    const m = compute_metrics([failed("a", "boom"), failed("b", "boom")]);
    expect(m).toMatchObject({ total: 2, scored: 0, failed: 2, mean: 0 });
  });
});

describe("run_pool", () => {
  it("runs every id with no more than the concurrency at a time", async () => {
    let running = 0;
    let most = 0;
    const startRun: StartRun = (run_id) => {
      running++;
      most = Math.max(most, running);
      return {
        result: new Promise((resolve) =>
          setTimeout(() => {
            running--;
            resolve(scored(run_id, 7));
          }, 5)
        ),
        abort: () => {},
      };
    };
    const results = await run_pool({
      run_ids: ids(5),
      concurrency: 2,
      startRun,
      beforeRetry: () => {},
      log: () => {},
    });
    expect(results.map((r) => r.run_id)).toEqual(ids(5));
    expect(most).toBe(2);
  });

  it("retries a run without a score, starting it fresh each time", async () => {
    const attempts: string[] = [];
    const retried: string[] = [];
    const startRun: StartRun = (run_id) => {
      attempts.push(run_id);
      const tries = attempts.filter((id) => id === run_id).length;
      return finished(
        tries < 3 ? failed(run_id, "Judge failed") : scored(run_id, 8)
      );
    };
    const [result] = await run_pool({
      run_ids: ["r_1"],
      concurrency: 1,
      startRun,
      beforeRetry: (run_id) => retried.push(run_id),
      log: () => {},
    });
    expect(result!.score).toBe(8);
    expect(attempts).toEqual(["r_1", "r_1", "r_1"]);
    expect(retried).toEqual(["r_1", "r_1"]);
  });

  it("gives up on a run after three retries", async () => {
    let attempts = 0;
    const [result] = await run_pool({
      run_ids: ["r_1"],
      concurrency: 1,
      startRun: (run_id) => {
        attempts++;
        return finished(failed(run_id, "Turn limit reached"));
      },
      beforeRetry: () => {},
      log: () => {},
    });
    expect(attempts).toBe(4);
    expect(result).toMatchObject({
      score: null,
      error: "Max retries exceeded",
    });
  });

  it("stops a run that goes on twice as long as the finished ones once most are done", async () => {
    const aborted: string[] = [];
    const startRun: StartRun = (run_id, index, onTurn) => {
      if (index < 9) {
        onTurn(5);
        return finished(scored(run_id, 7));
      }
      // The tenth run keeps going until it is stopped.
      let stop: (reason: string) => void = () => {};
      const result = new Promise<BenchRun>((resolve) => {
        stop = (reason) => resolve(failed(run_id, reason));
        let turn = 0;
        const tick = () => {
          onTurn(++turn);
          if (turn < 100) setTimeout(tick, 0);
        };
        tick();
      });
      return {
        result,
        abort: (reason) => {
          aborted.push(run_id);
          stop(reason);
        },
      };
    };
    const results = await run_pool({
      run_ids: ids(10),
      concurrency: 10,
      startRun,
      beforeRetry: () => {},
      log: () => {},
    });
    // Each retry runs away too, so every attempt is stopped.
    expect(aborted).toEqual(["r_10", "r_10", "r_10", "r_10"]);
    expect(results[9]).toMatchObject({
      run_id: "r_10",
      error: "Max retries exceeded",
    });
  });

  it("lets a long run finish when fewer than 90% of runs are done", async () => {
    const aborted: string[] = [];
    const startRun: StartRun = (run_id, index, onTurn) => {
      if (index === 0) {
        onTurn(3);
        return finished(scored(run_id, 7));
      }
      onTurn(50);
      return {
        result: new Promise((resolve) =>
          setTimeout(() => resolve(scored(run_id, 7)), 5)
        ),
        abort: () => aborted.push(run_id),
      };
    };
    await run_pool({
      run_ids: ids(4),
      concurrency: 4,
      startRun,
      beforeRetry: () => {},
      log: () => {},
    });
    expect(aborted).toEqual([]);
  });

  it("stops the runs under way and starts no more when interrupted", async () => {
    const controller = new AbortController();
    const started: string[] = [];
    const startRun: StartRun = (run_id) => {
      started.push(run_id);
      let stop: (reason: string) => void = () => {};
      const result = new Promise<BenchRun>((resolve) => {
        stop = (reason) => resolve(failed(run_id, reason));
      });
      return { result, abort: (reason) => stop(reason) };
    };
    const pool = run_pool({
      run_ids: ids(4),
      concurrency: 2,
      startRun,
      beforeRetry: () => {},
      abortSignal: controller.signal,
      log: () => {},
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort("Interrupted");
    const results = await pool;
    expect(started).toEqual(["r_1", "r_2"]);
    expect(results.map((r) => r.error)).toEqual([
      "Interrupted",
      "Interrupted",
      "Interrupted",
      "Interrupted",
    ]);
  });
});
