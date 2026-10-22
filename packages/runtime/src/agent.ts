import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "node:util";
import { stepCountIs, type ModelMessage, type ToolSet } from "ai";
import { compactThread, format_conversation } from "./conversation.ts";
import type { Customer, CustomerClass } from "./customer.ts";
import {
  judge_done_criteria,
  judge_run,
  type DoneResult,
  type JudgeResult,
} from "./judge.ts";
import {
  bareModel,
  get_model,
  get_support_models,
  type Model,
  type ModelSpec,
  type Provider,
  type SupportModelChoices,
  type SupportModels,
} from "./model.ts";
import { close, question } from "./readline.ts";
import { writeResultsHtml, type RunResultRecord } from "./results_html.ts";
import { is429, isContextOverflow, rateLimitDelay, sleep } from "./retry.ts";
import {
  CacheBusterNeverCallTool,
  ToolFromLLM,
  type ToolBase,
} from "./tool.ts";
import { agentGenerateText, RunCostCollector, UsageTracker } from "./usage.ts";
import { record_run } from "./vcr.ts";

export type { RunResultRecord };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolClass = new () => ToolBase<any>;

/** What an agent class needs to run: the model under test, the supporting
 *  models, and where to write the run. */
export type AgentOptions = {
  model: Model;
  support: SupportModels;
  log_dir: string;
  run_id?: string;
  /** The simulated customer; absent when a human types the customer side. */
  customer?: Customer;
  /** Inject a per-run cache-buster tool. Default true. */
  bust_cache?: boolean;
};

/** An agent class as the registry holds it: its name and customers are
 *  static, so the CLI can list them without constructing anything. */
export type AgentDef = {
  readonly agent_name: string;
  readonly customers: Record<string, CustomerClass>;
  new (opts: AgentOptions): BaseAgent;
};

export type RunOptions = {
  /** Keep the conversation out of the console (it still goes to
   *  agent_log.txt). */
  quiet?: boolean;
  /** Score the finished conversation with the judge. */
  judge?: boolean;
  /** When aborted, end the conversation and write partial results. */
  abortSignal?: AbortSignal;
  /** Called with the turn number as each simulated-customer turn starts. */
  onTurn?: (turn: number) => void;
  /** In human mode, sent as the first customer message. */
  initial_message?: string;
  /** The CLI command that ran this, for the “rerun with” hint. */
  command?: string;
};

/** Contents of input.json: everything needed to rerun the run by its id. */
export type RunInputRecord = {
  agent: string;
  run_id: string;
  customer: string | null;
  provider: Provider;
  /** The model spec as run, reasoning level included (`gpt-5.5@high`). */
  model: ModelSpec;
  /** The supporting models the run used, by role, as resolved. */
  support: SupportModelChoices;
  judge: boolean;
};

/** Return type of run(): the results record plus where it was written. */
export type RunResult = RunResultRecord & {
  results_json: string;
  results_html: string;
};

type ConversationResult = {
  messages: ModelMessage[];
  judge: JudgeResult | null;
  error: string | null;
};

/** Max time for a full turn (customer message → agent response). */
const TURN_TIMEOUT_MS = 4 * 60 * 1000;

/** Max number of turns before forcing stop. */
const DEFAULT_MAX_TURNS = 50;
const MINIMUM_TURN_LIMIT = 7;

function customerTurnLimit(targetTurns: number): number {
  return Math.max(MINIMUM_TURN_LIMIT, targetTurns * 2);
}

/** An id that sorts by start time: `<prefix>_20261006_153012_a1b2c3`. */
export function generate_id(prefix: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}_${stamp}_${randomBytes(3).toString("hex")}`;
}

export function generate_run_id(now = new Date()): string {
  return generate_id("r", now);
}

/** The directory a run writes to, created on first use. */
export function get_run_dir(run_id: string, log_dir: string): string {
  const dir = path.join(log_dir, run_id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}

function writeJson(dir: string, name: string, data: unknown) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2) + "\n");
}

/** The commit this code is at, and its GitHub link when the origin is on
 *  GitHub; nulls outside a git checkout. */
export function gitInfo(): { sha: string | null; url: string | null } {
  const cwd = path.dirname(fileURLToPath(import.meta.url));
  const git = (args: string) =>
    execSync(`git ${args}`, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  let sha: string;
  try {
    sha = git("rev-parse HEAD");
  } catch {
    return { sha: null, url: null };
  }
  try {
    const m = /github\.com[:/](.+?)(?:\.git)?$/.exec(
      git("remote get-url origin")
    );
    return { sha, url: m ? `https://github.com/${m[1]}/commit/${sha}` : null };
  } catch {
    return { sha, url: null };
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type RunAgentInput = {
  /** The agents this CLI knows, by name. */
  agents: Record<string, AgentDef>;
  agent: string;
  provider: Provider;
  model?: ModelSpec;
  /** A customer name, "auto" for the agent's first customer, or "human"
   *  (or unset) for a person typing the customer side. */
  customer?: string;
  support?: SupportModelChoices;
  run_id?: string;
  log_dir: string;
  judge?: boolean;
  bust_cache?: boolean;
  initial_message?: string;
  abortSignal?: AbortSignal;
  onTurn?: (turn: number) => void;
  quiet?: boolean;
  command?: string;
};

/**
 * Run a single agent conversation. Writes input.json, agent_log.txt,
 * results.json, results.html and the HTTP recordings to <log_dir>/<run_id>.
 */
export async function run_agent(input: RunAgentInput): Promise<RunResult> {
  const AgentClass = input.agents[input.agent];
  if (!AgentClass) {
    throw new Error(
      `Unknown agent “${input.agent}”. Available: ${Object.keys(input.agents).join(", ")}`
    );
  }
  const model = get_model(input.provider, input.model, "agent");
  const support = get_support_models(input.support);

  let customer: Customer | undefined;
  if (input.customer && input.customer !== "human") {
    const names = Object.keys(AgentClass.customers);
    const name = input.customer === "auto" ? names[0] : input.customer;
    const Cls = name ? AgentClass.customers[name] : undefined;
    if (!Cls) {
      throw new Error(
        `Unknown customer “${input.customer}”. Available: human, auto, ${names.join(", ")}`
      );
    }
    customer = new Cls({ model: support.customer });
  }

  const agent = new AgentClass({
    model,
    support,
    log_dir: input.log_dir,
    run_id: input.run_id,
    customer,
    bust_cache: input.bust_cache,
  });
  return agent.run({
    judge: input.judge,
    abortSignal: input.abortSignal,
    onTurn: input.onTurn,
    initial_message: input.initial_message,
    quiet: input.quiet,
    command: input.command,
  });
}

export abstract class BaseAgent {
  abstract get agentName(): string;
  abstract get systemPrompt(): string;
  protected abstract get toolSet(): ToolSet;

  /** Tool-call round trips allowed within one turn before the model must
   *  answer. Agents with tool-heavy turns can raise it. */
  protected get maxStepsPerTurn(): number {
    return 10;
  }

  protected readonly model: Model;
  protected readonly support: SupportModels;
  protected readonly customer?: Customer;
  protected readonly run_id: string;
  protected readonly log_dir: string;
  protected readonly bust_cache: boolean;
  protected readonly costs = new RunCostCollector();
  protected readonly usage: UsageTracker;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected _toolInstances: ToolBase<any>[] = [];

  private quiet = false;

  protected turn_timeout = TURN_TIMEOUT_MS;

  /** Tool names that end the conversation when called by the agent. */
  protected terminalTools: ReadonlySet<string> = new Set();

  /** Controls whether the done-criteria judge validates the customer's done call.
   *  - "judge": (default) validate done criteria before accepting
   *  - "accept": accept the customer's done call without judge validation */
  protected done_mode: "judge" | "accept" = "judge";

  constructor(opts: AgentOptions) {
    this.model = opts.model;
    this.support = opts.support;
    this.customer = opts.customer;
    this.run_id = opts.run_id || generate_run_id();
    this.log_dir = opts.log_dir;
    this.bust_cache = opts.bust_cache ?? true;
    this.usage = this.costs.getTracker("agent", bareModel(this.model.model));
  }

  protected get run_dir(): string {
    return get_run_dir(this.run_id, this.log_dir);
  }

  // Clears any existing Anthropic cache control and appends a new one to the
  // last message.
  //
  // Anthropic only allows max of 4 cache control entries on a request.
  // AI SDK would silently ignore additional entries after the 4th.
  // Need to clean up earlier cache control otherwise after multiple turns,
  // later turns won't be cached.
  private clearAndAppendAnthropicCacheControl(messages: ModelMessage[]) {
    messages.forEach((m) => {
      if (m.providerOptions?.anthropic) {
        delete m.providerOptions.anthropic;
      }
    });

    const last = messages[messages.length - 1];
    if (last) {
      last.providerOptions = {
        ...last.providerOptions,
        anthropic: { cacheControl: { type: "ephemeral" } },
      };
    }
  }

  private fileLog(...args: unknown[]) {
    fs.appendFileSync(
      path.join(this.run_dir, "agent_log.txt"),
      format(...args) + "\n"
    );
  }

  /** Always shown, and logged to agent_log.txt. */
  protected report(...args: unknown[]) {
    console.log(...args);
    this.fileLog(...args);
  }

  /** Shown unless quiet, and logged to agent_log.txt. */
  protected log(...args: unknown[]) {
    if (!this.quiet) console.log(...args);
    this.fileLog(...args);
  }

  /**
   * The supporting models this run will call, by role. Building them here,
   * before the conversation starts or anything is written, surfaces a missing
   * API key (MissingApiKeyError) while the caller can still fix it and retry.
   */
  private usedSupportModels(judgeEnabled: boolean): Record<string, Model> {
    // Reading the tool set creates the tool instances.
    void this.fullToolSet;
    const used: Record<string, Model> = {};
    if (this.customer) {
      used.customer = this.support.customer;
      if (this.done_mode === "judge") used.judge = this.support.judge;
    }
    if (this._toolInstances.some((t) => t instanceof ToolFromLLM)) {
      used.tool = this.support.tool;
    }
    if (judgeEnabled) used.judge = this.support.judge;
    return used;
  }

  async run(opts: RunOptions = {}): Promise<RunResult> {
    this.quiet = opts.quiet ?? false;
    const judgeEnabled = Boolean(opts.judge && this.customer);
    // First, before anything is written: a missing API key surfaces here.
    const used = this.usedSupportModels(judgeEnabled);
    const support_models = Object.fromEntries(
      Object.entries(used).map(([role, m]) => [
        role,
        `${m.provider}/${m.model}`,
      ])
    );
    // The models the roles resolved to, so a rerun uses them whatever keys
    // are set by then. The tools share the customer's model.
    const sim = used.customer ?? used.tool;
    const support: SupportModelChoices = {
      ...(sim && { customer: { provider: sim.provider, model: sim.model } }),
      ...(used.judge && {
        judge: { provider: used.judge.provider, model: used.judge.model },
      }),
    };
    const dir = this.run_dir;
    const results_json = path.join(dir, "results.json");
    const results_html = path.join(dir, "results.html");
    const { provider, model } = this.model;

    const runInput: RunInputRecord = {
      agent: this.agentName,
      run_id: this.run_id,
      customer: this.customer?.name ?? null,
      provider,
      model,
      support,
      judge: judgeEnabled,
    };
    writeJson(dir, "input.json", runInput);

    this.log(`🤖 Agent started: ${this.agentName} on ${provider}/${model}`);
    this.log(`📼 Run ID: ${this.run_id}`);
    if (this.customer) {
      this.log(`👤 Customer: ${this.customer.name}\n`);
    } else {
      this.log("Type “quit” to exit.\n");
    }

    let conv: ConversationResult;
    try {
      conv = await this.runConversation(opts, judgeEnabled);
    } catch (err) {
      const message =
        err instanceof Error ? (err.stack ?? err.message) : String(err);
      this.report(`❌ ${message}`);
      conv = { messages: [], judge: null, error: message };
    }

    const git = gitInfo();
    const result: RunResult = {
      run_id: this.run_id,
      timestamp: new Date().toISOString(),
      git_sha: git.sha,
      git_url: git.url,
      agent: this.agentName,
      provider,
      model,
      customer: this.customer?.name ?? null,
      support_models,
      score: conv.judge?.score ?? null,
      reasoning: conv.judge?.reasoning ?? null,
      judge: conv.judge,
      error: conv.error,
      usage: this.usage.toJSON(),
      cost: this.costs.totalCost(),
      costs: this.costs.toJSON(),
      messages: conv.messages,
      customer_turns: conv.messages.filter((m) => m.role === "user").length,
      client_turns: conv.messages.filter((m) => m.role === "assistant").length,
      llm_latency_ms: Math.round(this.costs.llm_latency_ms),
      results_json,
      results_html,
    };
    const { results_json: _j, results_html: _h, ...record } = result;
    writeJson(dir, "results.json", record);
    await writeResultsHtml(dir, record);
    // Relative when the run is under the working directory, else absolute.
    const shown = path.relative(process.cwd(), results_html);
    this.log(shown.startsWith("..") ? results_html : shown);
    return result;
  }

  private async runConversation(
    opts: RunOptions,
    judgeEnabled: boolean
  ): Promise<ConversationResult> {
    if (this.customer) this.customer.costs = this.costs;

    let judge: JudgeResult | null = null;
    let error: string | null = null;

    const messages = await record_run(this.run_dir, async () => {
      const loop = await this.agent_loop(
        opts.abortSignal,
        opts.initial_message,
        opts.onTurn
      );
      error = loop.error ?? null;

      if (!error && judgeEnabled) {
        try {
          this.log("\n\n⚖️  Judging run...");
          judge = await this.judge(loop.messages);
          if (judge) {
            this.report(`⚖️  Score: ${judge.score}/10. ${judge.reasoning}`);
          }
        } catch (err) {
          error = `Judge failed: ${errorText(err)}`;
          this.report(`❌ ${error}`);
          if (err instanceof Error && err.stack) this.fileLog(err.stack);
        }
      }
      return loop.messages;
    });

    if (opts.command) {
      this.log(`\nRerun with: ${opts.command} --run_id ${this.run_id}`);
    }
    return { messages, judge, error };
  }

  /** Score the conversation. Subclasses can override for custom scoring. */
  protected async judge(messages: ModelMessage[]): Promise<JudgeResult | null> {
    if (!this.customer) return null;
    return judge_run(
      this.customer.goal,
      this.customer.doneCriteria,
      messages,
      this.costs,
      this.support.judge
    );
  }

  /** Check whether done criteria are met. Subclasses can override for custom
   *  done logic. */
  protected async judge_done(messages: ModelMessage[]): Promise<DoneResult> {
    if (!this.customer) {
      return { done: true, unmetCriteria: [], reasoning: "No customer" };
    }
    return judge_done_criteria(
      this.customer.doneCriteria,
      messages,
      this.costs,
      this.support.judge
    );
  }

  private get fullToolSet(): ToolSet {
    const cacheBuster: ToolSet = this.bust_cache
      ? { [`cache_bust_${this.run_id}`]: new CacheBusterNeverCallTool().tool() }
      : {};
    return { ...cacheBuster, ...this.toolSet };
  }

  /** The reason a run is ending because of `signal`, for the error field. */
  private abortReason(signal: AbortSignal | undefined): string | undefined {
    if (!signal?.aborted) return undefined;
    return typeof signal.reason === "string" ? signal.reason : "Interrupted";
  }

  /** One agent turn: generateText over the thread, retrying 429s and
   *  compacting the thread on a context overflow, from one shared budget. */
  private async agentTurn(
    messages: ModelMessage[],
    tools: ToolSet,
    abortSignal: AbortSignal | undefined
  ): Promise<{
    result: Awaited<ReturnType<typeof agentGenerateText>>;
    messages: ModelMessage[];
  }> {
    const signals: AbortSignal[] = [];
    if (this.turn_timeout > 0)
      signals.push(AbortSignal.timeout(this.turn_timeout));
    if (abortSignal) signals.push(abortSignal);
    const combinedSignal =
      signals.length > 0 ? AbortSignal.any(signals) : undefined;

    const MAX_RETRIES = 5;
    // `log` is called from inside the SDK's step callback.
    const log = (...args: unknown[]) => this.log(...args);
    for (let retries = 0; ; ) {
      try {
        const result = await agentGenerateText(
          "agent",
          bareModel(this.model.model),
          this.costs,
          {
            model: this.model.languageModel,
            system: this.systemPrompt,
            messages,
            tools,
            maxRetries: 0,
            stopWhen: stepCountIs(this.maxStepsPerTurn),
            abortSignal: combinedSignal,
            providerOptions: this.model.providerOptions,
            prepareStep: ({ messages: stepMessages }) => {
              if (this.model.provider === "anthropic") {
                this.clearAndAppendAnthropicCacheControl(stepMessages);
              }
              return { messages: stepMessages };
            },
            onStepEnd({ text, toolCalls }) {
              // Log text that comes with tool calls; a final answer with no
              // tool calls is logged once the turn ends.
              if (text && toolCalls.length) log(`\n🤖⏳ Assistant: ${text}\n`);
              for (const tc of toolCalls) {
                log(
                  `🔧 Calling tool: ${tc.toolName}: ${JSON.stringify(tc.input)}`
                );
              }
            },
          }
        );
        return { result, messages };
      } catch (err) {
        if (retries >= MAX_RETRIES) throw err;

        if (is429(err)) {
          retries++;
          const delay = rateLimitDelay(err, retries);
          this.report(
            `⏳ Rate limited (429). Waiting ${Math.round(delay / 1000)}s before retry ${retries}/${MAX_RETRIES}`
          );
          await sleep(delay);
          continue;
        }

        if (isContextOverflow(err)) {
          const compacted = compactThread(messages);
          if (compacted) {
            retries++;
            this.report(
              `⚠️  Context overflow: dropped ${messages.length - compacted.length} middle messages (${messages.length} → ${compacted.length}). ${errorText(err)}`
            );
            messages = compacted;
            continue;
          }
        }

        throw err;
      }
    }
  }

  private async agent_loop(
    abortSignal?: AbortSignal,
    initial_message?: string,
    onTurn?: (turn: number) => void
  ): Promise<{ messages: ModelMessage[]; error?: string }> {
    let messages: ModelMessage[] = [];
    let lastAgentReply: string | undefined;
    let turn = 0;
    let pendingInitialMessage = initial_message;
    // Built before the first turn: building it creates the tool instances
    // that are handed their context below.
    const tools = this.fullToolSet;

    while (true) {
      const aborted = this.abortReason(abortSignal);
      if (aborted) {
        this.report(`❌ ${aborted}`);
        return { messages, error: aborted };
      }

      let userInput: string;

      if (this.customer) {
        const target = this.customer.targetTurns || DEFAULT_MAX_TURNS;
        const hardLimit = customerTurnLimit(target);
        if (turn >= hardLimit) {
          this.report(
            `⚠️  Turn limit reached (${turn} of ${hardLimit}), stopping`
          );
          return { messages, error: "Turn limit reached" };
        }
        let result: { message: string; done: boolean };
        try {
          result = await this.customer.generate(lastAgentReply);
          if (result.done) {
            const softLimit = Math.ceil(target * 1.75);
            if (turn >= softLimit) {
              // Past the soft budget: accept done without the judge gate.
              this.report("👤 Customer done (past turn budget)");
              break;
            }
            if (this.done_mode === "accept") {
              this.report("👤 Customer done");
              break;
            }
            // Judge gate: validate criteria are actually met before accepting.
            this.log("⚖️  Validating done...");
            const doneResult = await this.judge_done(messages);
            if (doneResult.done) {
              this.report("👤 Customer done");
              break;
            }
            const unmetList = doneResult.unmetCriteria
              .map((c) => `- ${c}`)
              .join("\n");
            this.log(`⚖️  Done rejected: ${doneResult.reasoning}`);
            // Reject done via tool result + block done tool for a few turns.
            this.customer.rejectDone(
              `Not all criteria are met. You still need to:\n${unmetList}`
            );
            // Customer generates a continuation addressing unmet criteria.
            result = await this.customer.generate(
              `[You still need to address these items:\n${unmetList}]`
            );
          }
        } catch (err) {
          const error = errorText(err);
          this.report(`❌ Customer error: ${error}`);
          if (err instanceof Error && err.stack) this.fileLog(err.stack);
          return { messages, error };
        }
        turn++;
        this.report(`Turn ${turn}`);
        onTurn?.(turn);
        userInput = result.message;
        this.log(`👤 Customer: ${userInput}\n`);
      } else if (pendingInitialMessage) {
        userInput = pendingInitialMessage;
        pendingInitialMessage = undefined;
        this.log(`You: ${userInput}\n`);
      } else {
        userInput = await question("You: ");
        if (userInput.toLowerCase() === "quit") {
          this.log("👋 Goodbye!");
          close();
          break;
        }
        if (userInput.length === 0) continue;
        this.fileLog(`You: ${userInput}\n`);
      }

      messages.push({ role: "user", content: userInput });

      for (const tool of this._toolInstances) {
        tool.context = {
          messages,
          costs: this.costs,
          model: this.support.tool,
          automated: Boolean(this.customer),
        };
      }

      try {
        const turnResult = await this.agentTurn(messages, tools, abortSignal);
        messages = turnResult.messages;
        const { result } = turnResult;

        this.log(`\n🤖 Assistant: ${result.text}\n`);
        this.log(this.usage.toString());
        messages.push(...result.responseMessages);
        lastAgentReply = result.text;

        // End the conversation if the agent called a terminal tool (e.g. a
        // hand-off to a human).
        if (this.terminalTools.size > 0) {
          const calledTerminal = result.steps.some((step) =>
            step.toolCalls.some((tc) => this.terminalTools.has(tc.toolName))
          );
          if (calledTerminal) {
            this.report("🔚 Terminal tool called, ending conversation");
            return { messages };
          }
        }
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        const error = isAbort
          ? (this.abortReason(abortSignal) ??
            `Turn timed out after ${this.turn_timeout / 1000}s`)
          : errorText(err);
        this.report(`❌ ${error}`);
        if (err instanceof Error && err.stack) this.fileLog(err.stack);
        // A simulated run ends on an agent error; a human can carry on.
        if (this.customer) return { messages, error };
      }
    }

    return { messages };
  }
}

/** An agent defined by static fields: its name, system prompt, tool
 *  classes and customers. Subclass it and register the subclass by name. */
export abstract class Agent extends BaseAgent {
  static readonly agent_name: string;
  static readonly system: string;
  static readonly tools: Record<string, ToolClass> = {};
  static readonly customers: Record<string, CustomerClass> = {};

  get agentName() {
    return (this.constructor as typeof Agent).agent_name;
  }
  get systemPrompt() {
    return (this.constructor as typeof Agent).system;
  }

  private _toolSet?: ToolSet;
  protected get toolSet(): ToolSet {
    if (!this._toolSet) {
      const tools = (this.constructor as typeof Agent).tools;
      this._toolInstances = [];
      this._toolSet = Object.fromEntries(
        Object.entries(tools).map(([name, Cls]) => {
          const instance = new Cls();
          this._toolInstances.push(instance);
          return [name, instance.tool()];
        })
      );
    }
    return this._toolSet;
  }
}

export const _test_ = { customerTurnLimit };
