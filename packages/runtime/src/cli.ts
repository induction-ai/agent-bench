import path from "node:path";
import yargs from "yargs";
import {
  readJson,
  run_agent,
  type AgentDef,
  type RunInputRecord,
} from "./agent.ts";
import {
  API_KEY_ENV,
  customerModelFor,
  defaultModelFor,
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

// --- The command ---

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

  const agents: Record<string, AgentDef> = {};
  for (const def of options.agents) {
    if (agents[def.agent_name]) {
      throw new Error(`Two agents are named “${def.agent_name}”`);
    }
    agents[def.agent_name] = def;
  }
  const agentNames = Object.keys(agents);
  const only = options.agents.length === 1 ? options.agents[0] : undefined;
  const usage = only
    ? `Usage: ${name} [${providers.join("|")}] [options]`
    : `Usage: ${name} [${agentNames.join("|")}] [${providers.join("|")}] [options]`;

  const args = yargs(options.argv ?? process.argv.slice(2))
    .scriptName(name)
    .usage(usage)
    .command(
      only ? "$0 [provider]" : "$0 [agent] [provider]",
      only
        ? `Run one ${only.agent_name} conversation`
        : "Run one agent conversation",
      (y) =>
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
    .option("customer", {
      type: "string",
      describe:
        "Customer name, “human” (you type), or “auto” (the first one); asked when left out",
    })
    .option("customer_provider", {
      type: "string",
      describe: `Provider for the simulated customer and LLM-backed tools (${providers.join(", ")}); default OpenAI, else the first with an API key`,
    })
    .option("customer_model", {
      type: "string",
      describe: "Model for the simulated customer and LLM-backed tools",
    })
    .option("judge", {
      type: "boolean",
      default: false,
      describe: "Score the finished conversation with the judge",
    })
    .option("judge_provider", {
      type: "string",
      describe: `Provider for the judge, which gates the customer’s done and scores the run (${providers.join(", ")}); default OpenAI, else the first with an API key`,
    })
    .option("judge_model", {
      type: "string",
      describe: "Model for the judge",
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
    .option("bust_cache", {
      type: "boolean",
      default: true,
      describe:
        "Add a per-run dummy tool so a run never reuses another run’s prompt cache",
    })
    .alias("h", "help")
    .strictOptions()
    .parseSync();

  const logDir = path.resolve(args.log_dir);
  let agentArg = only ? undefined : (args.agent as string | undefined);
  let providerArg = args.provider as string | undefined;
  // `bin/agent gemini`: a provider where the agent goes.
  if (
    agentArg !== undefined &&
    providerArg === undefined &&
    !(agentArg in agents) &&
    (providers as readonly string[]).includes(agentArg)
  ) {
    providerArg = agentArg;
    agentArg = undefined;
  }

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

  if (agent === undefined || !(agent in agents)) {
    if (agent !== undefined) console.log(`${name} has no agent “${agent}”.`);
    agent = await choose(
      "Which agent?",
      agentNames.map((n) => ({
        label: `${n} (customers: ${Object.keys(agents[n]!.customers).join(", ")})`,
        value: n,
      })),
      `Pass one of ${agentNames.join(", ")} as the first argument.`
    );
  }
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

  const providerHint = `Pass the provider as an argument: ${usage}`;
  if (!saved) {
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
    provider = chosen;
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
    support = {
      ...(customerChoice && { customer: customerChoice }),
      ...(judgeChoice && { judge: judgeChoice }),
    };
  }

  provider ??= await pickProvider("agent", providerHint);

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
        provider,
        model,
        customer,
        support,
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
      const moved = await fixMissingKey(err);
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
    }
  }
}
