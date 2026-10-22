import path from "node:path";
import yargs from "yargs";
import {
  readJson,
  run_agent,
  type AgentDef,
  type RunInputRecord,
} from "./agent.ts";
import {
  isBenchWorker,
  run_bench,
  runBenchWorker,
  type BenchConfig,
  type BenchInputRecord,
} from "./bench.ts";
import {
  API_KEY_ENV,
  customerModelFor,
  defaultModelFor,
  get_model,
  get_support_models,
  hasApiKey,
  judgeModelFor,
  MissingApiKeyError,
  parseModelSpec,
  providerForModel,
  providers,
  SUPPORT_ROLES,
  type ModelChoice,
  type ModelSpec,
  type Provider,
  type SupportModelChoices,
} from "./model.ts";
import { close, question, questionHidden } from "./readline.ts";

export type CliOptions = {
  /** The agents this command offers. */
  agents: AgentDef[];
  /** The command as people type it, shown in help and in the hint for
   *  rerunning a run. Default "bin/agent". */
  name?: string;
  /** Where runs are written unless --log_dir says otherwise. Default
   *  .temp/agents under the working directory. */
  logDir?: string;
  /** Default process.argv.slice(2). */
  argv?: string[];
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// --- Asking ---

/** Whether there is a person at the keyboard to ask. Piped or scripted runs
 *  get an error naming the flag to pass instead. */
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

type Option<T> = { label: string; value: T };

/**
 * Ask `prompt` with numbered options until one is picked; Enter takes the
 * first. `hint` says how to answer up front, for when no one can be asked.
 * Options are numbered from `first` (1 unless given).
 */
async function choose<T>(
  prompt: string,
  options: Option<T>[],
  hint: string,
  first = 1
): Promise<T> {
  if (!interactive) fail(`${prompt} ${hint}`);
  const last = first + options.length - 1;
  console.log(prompt);
  options.forEach((o, i) => console.log(`  ${i + first}) ${o.label}`));
  for (;;) {
    const answer = (await question(`Choose [${first}]: `)).trim();
    if (answer === "") return options[0]!.value;
    const idx = Number(answer);
    if (Number.isInteger(idx) && idx >= first && idx <= last) {
      return options[idx - first]!.value;
    }
    const byName = options.find(
      (o) => String(o.value).toLowerCase() === answer.toLowerCase()
    );
    if (byName) return byName.value;
    console.log(`Pick a number from ${first} to ${last}.`);
  }
}

/** Ask a yes/no question; Enter takes `byDefault`. */
async function confirm(
  prompt: string,
  byDefault: boolean,
  hint: string
): Promise<boolean> {
  if (!interactive) fail(`${prompt} ${hint}`);
  for (;;) {
    const answer = (
      await question(`${prompt} ${byDefault ? "[Y/n]" : "[y/N]"} `)
    )
      .trim()
      .toLowerCase();
    if (answer === "") return byDefault;
    if (answer === "y" || answer === "yes") return true;
    if (answer === "n" || answer === "no") return false;
  }
}

/** Ask for `provider`'s API key and set it for this run. Keeping keys is
 *  the command's business (the examples load .env), so it is not saved. */
async function enterApiKey(provider: Provider) {
  const name = API_KEY_ENV[provider][0]!;
  if (!interactive) fail(`${name} isn’t set.`);
  let key = "";
  while (!key) key = await questionHidden(`${name} (input hidden): `);
  process.env[name] = key;
  console.log(`${name} is set for this run. Add it to your .env to keep it.`);
}

const PROVIDER_LABELS: Record<Provider, string> = {
  responses: "OpenAI Responses API",
  completions: "OpenAI Chat Completions",
  anthropic: "Anthropic",
  gemini: "Gemini",
};

function providerLabel(provider: Provider): string {
  const key = API_KEY_ENV[provider][0]!;
  const status = hasApiKey(provider) ? `${key} set` : `no ${key}`;
  return `${provider} (${PROVIDER_LABELS[provider]}, ${defaultModelFor(provider)}) · ${status}`;
}

function isOpenAI(provider: Provider): boolean {
  return provider === "responses" || provider === "completions";
}

/**
 * The provider for `role` when the command line names none: the first with
 * an API key set, in the order `providers` lists them. With no key at all,
 * the person picks a provider and enters its key.
 */
async function pickProvider(role: string, hint: string): Promise<Provider> {
  const keyed = providers.filter(hasApiKey);
  const first = keyed[0];
  if (first) {
    const others = keyed.length > 1 ? "; pass a provider to use another" : "";
    console.log(
      `Running the ${role} on ${first} (${API_KEY_ENV[first][0]} is set${others}).`
    );
    return first;
  }
  console.log("No provider API key is set.");
  const provider = await choose(
    `Which provider should the ${role} run on?`,
    providers.map((p) => ({ label: providerLabel(p), value: p })),
    hint
  );
  await enterApiKey(provider);
  return provider;
}

/** `value` as a provider, or a pick when it isn't one. */
async function resolveProvider(
  value: string | undefined,
  role: string,
  hint: string
): Promise<Provider | undefined> {
  if (value === undefined) return undefined;
  if ((providers as readonly string[]).includes(value)) {
    return value as Provider;
  }
  console.log(`There’s no provider “${value}”.`);
  return pickProvider(role, hint);
}

/** A model spec, asking again while it doesn't parse. */
async function validModel(
  spec: ModelSpec | undefined,
  flag: string
): Promise<ModelSpec | undefined> {
  while (spec !== undefined) {
    try {
      parseModelSpec(spec);
      return spec;
    } catch (err) {
      console.log(err instanceof Error ? err.message : String(err));
      if (!interactive) fail(`Fix --${flag}.`);
      spec =
        (await question("Model (Enter for the provider’s default): ")).trim() ||
        undefined;
    }
  }
  return undefined;
}

/**
 * A supporting role's choice from its two flags: an explicit provider, else
 * the one the model belongs to, else a pick. Undefined when neither flag is
 * given, leaving the role on its default model.
 */
async function supportChoice(
  providerArg: string | undefined,
  modelArg: string | undefined,
  role: string,
  flag: string
): Promise<ModelChoice | undefined> {
  const model = await validModel(modelArg, `${flag}_model`);
  const hint = `Pass --${flag}_provider <${providers.join("|")}>.`;
  const provider =
    (await resolveProvider(providerArg, role, hint)) ??
    (model ? providerForModel(model) : undefined) ??
    (model ? await pickProvider(role, hint) : undefined);
  return provider ? { provider, ...(model && { model }) } : undefined;
}

/** Each role a missing key can belong to: the group of choices that moves
 *  it, the flag that does so, and its model on a provider. */
const ROLE_GROUPS: Record<
  string,
  {
    group: "agent" | "customer" | "judge";
    flag: string;
    modelFor: (provider: Provider) => string;
  }
> = {
  agent: {
    group: "agent",
    flag: "a provider argument",
    modelFor: defaultModelFor,
  },
  [SUPPORT_ROLES.customer]: {
    group: "customer",
    flag: "--customer_provider",
    modelFor: customerModelFor,
  },
  [SUPPORT_ROLES.judge]: {
    group: "judge",
    flag: "--judge_provider",
    modelFor: judgeModelFor,
  },
};

/** Ask how to get past a missing key: move the role to a provider whose key
 *  is set, or enter the key. Returns the role group to move, if any. */
async function fixMissingKey(
  err: MissingApiKeyError
): Promise<Partial<Record<"agent" | "customer" | "judge", Provider>>> {
  const role = ROLE_GROUPS[err.role] ?? ROLE_GROUPS[SUPPORT_ROLES.judge]!;
  const keyName = API_KEY_ENV[err.provider][0]!;
  console.log(
    `The ${err.role} runs on ${err.provider}, and ${keyName} isn’t set.`
  );
  const alternatives = providers
    .filter((p) => !isOpenAI(p) || p === "responses")
    .filter((p) => p !== err.provider && hasApiKey(p));
  const choice = await choose<Provider | "enter">(
    "What now?",
    [
      ...alternatives.map((p) => ({
        label: `Run the ${err.role} on ${p} (${role.modelFor(p)}) instead`,
        value: p,
      })),
      { label: `Enter ${keyName}`, value: "enter" as const },
    ],
    `Set ${keyName}, or pass ${role.flag} with a provider whose key is set.`
  );
  if (choice === "enter") {
    await enterApiKey(err.provider);
    return {};
  }
  return { [role.group]: choice };
}

// --- Shared by both commands ---

/** The command's agents by name. */
function agentRegistry(defs: AgentDef[]): Record<string, AgentDef> {
  const agents: Record<string, AgentDef> = {};
  for (const def of defs) {
    if (agents[def.agent_name]) {
      throw new Error(`Two agents are named “${def.agent_name}”`);
    }
    agents[def.agent_name] = def;
  }
  return agents;
}

/**
 * The yargs chain both commands start from: the agent and provider
 * positionals (no agent with a single one) and the agent's and supporting
 * models' options.
 */
function baseArgs(
  argv: string[],
  name: string,
  usage: string,
  agentNames: string[],
  only: AgentDef | undefined,
  describe: string
) {
  return yargs(argv)
    .scriptName(name)
    .usage(usage)
    .command(only ? "$0 [provider]" : "$0 [agent] [provider]", describe, (y) =>
      (only
        ? y
        : y.positional("agent", {
            type: "string",
            describe: `${agentNames.join(", ")}; asked when left out`,
          })
      ).positional("provider", {
        type: "string",
        describe: `${providers.join(", ")}; taken from --model or from the API keys you have when left out`,
      })
    )
    .option("model", {
      type: "string",
      describe:
        "Model for the agent, optionally with a reasoning level: <model>[@<none|minimal|low|medium|high|xhigh|max|dynamic>]",
    })
    .option("customer_provider", {
      type: "string",
      describe: `Provider for the simulated customer and LLM-backed tools (${providers.join(", ")}); default the first of Gemini, OpenAI and Anthropic with an API key`,
    })
    .option("customer_model", {
      type: "string",
      describe: "Model for the simulated customer and LLM-backed tools",
    })
    .option("judge_provider", {
      type: "string",
      describe: `Provider for the judge, which gates the customer’s done and scores the run (${providers.join(", ")}); default the first of Gemini, OpenAI and Anthropic with an API key`,
    })
    .option("judge_model", {
      type: "string",
      describe: "Model for the judge",
    })
    .option("bust_cache", {
      type: "boolean",
      default: true,
      describe:
        "Add a per-run dummy tool so a run never reuses another run’s prompt cache",
    })
    .alias("h", "help")
    .strictOptions();
}

/** The agent and provider positionals as given: `bin/agent gemini` puts a
 *  provider where the agent goes. */
function positionals(
  agentArg: string | undefined,
  providerArg: string | undefined,
  agents: Record<string, AgentDef>
): { agentArg?: string; providerArg?: string } {
  if (
    agentArg !== undefined &&
    providerArg === undefined &&
    !(agentArg in agents) &&
    (providers as readonly string[]).includes(agentArg)
  ) {
    return { providerArg: agentArg };
  }
  return { agentArg, providerArg };
}

/** `agent` when the command has it, else a pick. */
async function chooseAgent(
  agent: string | undefined,
  agents: Record<string, AgentDef>,
  name: string
): Promise<string> {
  if (agent !== undefined && agent in agents) return agent;
  if (agent !== undefined) console.log(`${name} has no agent “${agent}”.`);
  const agentNames = Object.keys(agents);
  return choose(
    "Which agent?",
    agentNames.map((n) => ({
      label: `${n} (customers: ${Object.keys(agents[n]!.customers).join(", ")})`,
      value: n,
    })),
    `Pass one of ${agentNames.join(", ")} as the first argument.`
  );
}

/** The agent's provider and the supporting models' choices, from the
 *  command line, with picks for what it leaves unclear. */
async function chooseModels(
  args: {
    customer_provider?: string;
    customer_model?: string;
    judge_provider?: string;
    judge_model?: string;
  },
  providerArg: string | undefined,
  model: ModelSpec | undefined,
  usage: string
): Promise<{ provider: Provider; support: SupportModelChoices }> {
  const providerHint = `Pass the provider as an argument: ${usage}`;
  let chosen =
    (await resolveProvider(providerArg, "agent", providerHint)) ??
    (model ? providerForModel(model) : undefined);
  if (chosen && model) {
    const owner = providerForModel(model);
    if (owner && !(isOpenAI(owner) && isOpenAI(chosen)) && owner !== chosen) {
      console.log(`${model} is a model for ${owner}, not ${chosen}.`);
      if (
        await confirm(
          `Run it on ${owner}?`,
          true,
          "Pass a provider that serves the model."
        )
      ) {
        chosen = owner;
      }
    }
  }
  const customerChoice = await supportChoice(
    args.customer_provider,
    args.customer_model,
    SUPPORT_ROLES.customer,
    "customer"
  );
  const judgeChoice = await supportChoice(
    args.judge_provider,
    args.judge_model,
    "judge",
    "judge"
  );
  return {
    provider: chosen ?? (await pickProvider("agent", providerHint)),
    support: {
      ...(customerChoice && { customer: customerChoice }),
      ...(judgeChoice && { judge: judgeChoice }),
    },
  };
}

type ModelState = {
  provider: Provider;
  model: ModelSpec | undefined;
  support: SupportModelChoices;
};

/** Ask about the missing key in `err`, and move the role it belongs to
 *  when the answer is another provider. */
async function afterMissingKey(
  err: MissingApiKeyError,
  state: ModelState
): Promise<ModelState> {
  const moved = await fixMissingKey(err);
  let { provider, model, support } = state;
  if (moved.agent) {
    provider = moved.agent;
    model = undefined;
  }
  if (moved.customer) {
    support = { ...support, customer: { provider: moved.customer } };
  }
  if (moved.judge) {
    support = { ...support, judge: { provider: moved.judge } };
  }
  return { provider, model, support };
}

// --- bin/agent ---

/**
 * A command that runs one conversation between one of `agents` and a
 * customer (simulated, or you at the keyboard). Assemble one per set of
 * agents you want to offer:
 *
 *   await runCli({ agents: [TravelAgent, TriviaAgent] });
 *
 * Anything the command line leaves out or gets wrong (the agent, the
 * provider, the customer, an API key) is asked for. With a single agent the
 * agent argument is dropped: `<name> [provider] [options]`.
 */
export async function runCli(options: CliOptions): Promise<void> {
  const name = options.name ?? "bin/agent";

  const agents = agentRegistry(options.agents);
  const agentNames = Object.keys(agents);
  const only = options.agents.length === 1 ? options.agents[0] : undefined;
  const usage = only
    ? `Usage: ${name} [${providers.join("|")}] [options]`
    : `Usage: ${name} [${agentNames.join("|")}] [${providers.join("|")}] [options]`;

  const args = baseArgs(
    options.argv ?? process.argv.slice(2),
    name,
    usage,
    agentNames,
    only,
    only
      ? `Run one ${only.agent_name} conversation`
      : "Run one agent conversation"
  )
    .option("customer", {
      type: "string",
      describe:
        "Customer name, “human” (you type), or “auto” (the first one); asked when left out",
    })
    .option("judge", {
      type: "boolean",
      default: false,
      describe: "Score the finished conversation with the judge",
    })
    .option("message", {
      type: "string",
      describe: "Send this as the first message (implies --customer human)",
    })
    .option("run_id", {
      type: "string",
      describe:
        "Rerun a previous run by id, with its settings, replaying its recorded responses",
    })
    .option("fresh", {
      type: "boolean",
      default: false,
      describe: "With --run_id: ignore the run’s saved settings",
    })
    .option("log_dir", {
      type: "string",
      default: options.logDir ?? path.join(".temp", "agents"),
      describe: "Parent directory for run output",
    })
    .parseSync();

  const logDir = path.resolve(args.log_dir);
  const { agentArg, providerArg } = positionals(
    only ? undefined : (args.agent as string | undefined),
    args.provider as string | undefined,
    agents
  );

  let agent: string | undefined = only?.agent_name ?? agentArg;
  let provider: Provider | undefined;
  let model: ModelSpec | undefined;
  let customer: string | undefined = args.message ? "human" : args.customer;
  let judge = args.judge;
  let support: SupportModelChoices = {};

  const runId = args.run_id;
  const saved =
    runId && !args.fresh
      ? (readJson(
          path.join(logDir, runId, "input.json")
        ) as RunInputRecord | null)
      : null;
  if (runId && !args.fresh && !saved) {
    console.log(`There’s no run ${runId} in ${logDir}.`);
    const fresh = await confirm(
      `Start a new run with the id ${runId}?`,
      false,
      "Pass --log_dir to point at the run’s parent directory, or --fresh to start a new run with this id."
    );
    if (!fresh) process.exit(1);
  }

  if (saved) {
    agent = saved.agent;
    provider = saved.provider;
    model = saved.model;
    customer = saved.customer ?? "human";
    judge = saved.judge;
    support = saved.support ?? {};
  }

  if (!saved) model = await validModel(args.model, "model");

  agent = await chooseAgent(agent, agents, name);
  const def = agents[agent]!;

  const customerNames = Object.keys(def.customers);
  if (
    customer === undefined ||
    !(customer === "human" || customer === "auto" || customer in def.customers)
  ) {
    if (customer !== undefined) {
      console.log(`${agent} has no customer “${customer}”.`);
    }
    // You typing is always 0, so it is the same key for every agent.
    customer = await choose(
      "Which customer?",
      [
        { label: "human (you type the customer side)", value: "human" },
        ...customerNames.map((n) => ({ label: n, value: n })),
      ],
      `Pass --customer <${["human", ...customerNames].join("|")}>.`,
      0
    );
  }

  if (!saved) {
    ({ provider, support } = await chooseModels(
      args,
      providerArg,
      model,
      usage
    ));
  }
  let state: ModelState = { provider: provider!, model, support };

  // The first Ctrl-C ends the conversation and still writes results; a
  // second one exits immediately.
  const controller = new AbortController();
  process.on("SIGINT", () => {
    if (controller.signal.aborted) process.exit(130);
    console.log("\nInterrupted. Writing results (Ctrl-C again to quit now)");
    controller.abort("Interrupted");
  });

  // A run checks every model's API key before it starts; a missing one is
  // asked about here, and the run tried again.
  for (;;) {
    close(); // free stdin for the run (human mode reopens it)
    try {
      const result = await run_agent({
        agents,
        agent,
        provider: state.provider,
        model: state.model,
        customer,
        support: state.support,
        run_id: runId,
        log_dir: logDir,
        judge,
        bust_cache: args.bust_cache,
        initial_message: args.message,
        abortSignal: controller.signal,
        command: name,
      });
      if (result.error) process.exitCode = 1;
      return;
    } catch (err) {
      if (!(err instanceof MissingApiKeyError)) {
        fail(err instanceof Error ? err.message : String(err));
      }
      state = await afterMissingKey(err, state);
    }
  }
}

// --- bin/bench ---

/**
 * A command that runs one of `agents` against one simulated customer
 * `--count` times, `--concurrency` at a time, judges every run, and
 * summarizes the scores and costs (see bench.ts). It takes bin/agent's
 * arguments, less those for a person typing, and asks for what it leaves out
 * the same way. Each run happens in a worker thread that loads the calling
 * script again, so call this at the top level of that script.
 */
export async function runBenchCli(options: CliOptions): Promise<void> {
  const agents = agentRegistry(options.agents);
  if (isBenchWorker()) return runBenchWorker(agents);

  const name = options.name ?? "bin/bench";
  const agentNames = Object.keys(agents);
  const only = options.agents.length === 1 ? options.agents[0] : undefined;
  const usage = only
    ? `Usage: ${name} [${providers.join("|")}] [options]`
    : `Usage: ${name} [${agentNames.join("|")}] [${providers.join("|")}] [options]`;

  const args = baseArgs(
    options.argv ?? process.argv.slice(2),
    name,
    usage,
    agentNames,
    only,
    only
      ? `Run ${only.agent_name} several times and summarize the scores`
      : "Run an agent several times and summarize the scores"
  )
    .option("customer", {
      type: "string",
      describe: "Customer name, or “auto” (the first one); asked when left out",
    })
    .option("count", {
      type: "number",
      default: 8,
      describe: "Number of runs",
    })
    .option("concurrency", {
      type: "number",
      default: 4,
      describe: "Runs at a time",
    })
    .option("bench_id", {
      type: "string",
      describe:
        "Resume a previous bench by id, with its settings; finished runs replay their recorded responses",
    })
    .option("fresh", {
      type: "boolean",
      default: false,
      describe: "With --bench_id: ignore the bench’s saved settings",
    })
    .option("verbose", {
      type: "boolean",
      default: false,
      describe: "Print every run’s whole conversation",
    })
    .option("log_dir", {
      type: "string",
      default: options.logDir ?? path.join(".temp", "benches"),
      describe: "Parent directory for bench output",
    })
    .parseSync();

  const logDir = path.resolve(args.log_dir);
  const benchId = args.bench_id;
  const saved =
    benchId && !args.fresh
      ? (readJson(
          path.join(logDir, benchId, "input.json")
        ) as BenchInputRecord | null)
      : null;
  if (benchId && !args.fresh && !saved) {
    console.log(`There’s no bench ${benchId} in ${logDir}.`);
    const fresh = await confirm(
      `Start a new bench with the id ${benchId}?`,
      false,
      "Pass --log_dir to point at the bench’s parent directory, or --fresh to start a new bench with this id."
    );
    if (!fresh) process.exit(1);
  }

  let config: Omit<BenchConfig, "provider" | "model" | "support">;
  let state: ModelState;
  if (saved) {
    const {
      bench_id: _id,
      run_ids: _runs,
      provider,
      model,
      support,
      ...rest
    } = saved;
    // How much to print is up to this invocation, not the saved bench.
    config = { ...rest, verbose: args.verbose || rest.verbose };
    state = { provider, model, support };
  } else {
    const { agentArg, providerArg } = positionals(
      only ? undefined : (args.agent as string | undefined),
      args.provider as string | undefined,
      agents
    );
    const model = await validModel(args.model, "model");
    const agent = await chooseAgent(only?.agent_name ?? agentArg, agents, name);
    const customerNames = Object.keys(agents[agent]!.customers);
    let customer = args.customer === "auto" ? customerNames[0] : args.customer;
    if (customer === undefined || !customerNames.includes(customer)) {
      if (customer === "human") {
        console.log("A bench needs a simulated customer.");
      } else if (customer !== undefined) {
        console.log(`${agent} has no customer “${customer}”.`);
      }
      customer = await choose(
        "Which customer?",
        customerNames.map((n) => ({ label: n, value: n })),
        `Pass --customer <${["auto", ...customerNames].join("|")}>.`
      );
    }
    config = {
      agent,
      customer,
      count: args.count,
      concurrency: args.concurrency,
      bust_cache: args.bust_cache,
      verbose: args.verbose,
    };
    state = {
      model,
      ...(await chooseModels(args, providerArg, model, usage)),
    };
  }

  // Every model is built once here, so a missing API key is asked about
  // before any run starts, and every run uses the same resolved models.
  let resolved: BenchConfig;
  for (;;) {
    try {
      const agentModel = get_model(state.provider, state.model, "agent");
      const support = get_support_models(state.support);
      resolved = {
        ...config,
        provider: state.provider,
        model: agentModel.model,
        support: {
          customer: {
            provider: support.customer.provider,
            model: support.customer.model,
          },
          judge: {
            provider: support.judge.provider,
            model: support.judge.model,
          },
        },
      };
      break;
    } catch (err) {
      if (!(err instanceof MissingApiKeyError)) {
        fail(err instanceof Error ? err.message : String(err));
      }
      state = await afterMissingKey(err, state);
    }
  }
  close();

  // The first Ctrl-C ends the runs under way and still writes results; a
  // second one exits immediately.
  const controller = new AbortController();
  process.on("SIGINT", () => {
    if (controller.signal.aborted) process.exit(130);
    console.log("\nInterrupted. Writing results (Ctrl-C again to quit now)");
    controller.abort("Interrupted");
  });

  const result = await run_bench(resolved, {
    log_dir: logDir,
    bench_id: benchId,
    entry: process.argv[1]!,
    abortSignal: controller.signal,
    command: name,
  });
  if (result.metrics.scored === 0) process.exitCode = 1;
}
