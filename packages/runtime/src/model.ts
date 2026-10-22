import { pickService, resolveModel } from "@agent-bench/model-stats/index.js";
import type {
  KnownAnthropicModelName,
  KnownGeminiModelName,
  KnownOpenAIModelName,
} from "@agent-bench/model-stats/model_names.js";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/** Provider options as generateText takes them: one object per provider. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProviderOptions = Record<string, Record<string, any>>;

/**
 * The APIs a model can be called over: OpenAI's two (`responses` and
 * `completions`, Chat Completions), and Anthropic's and Gemini's own. Listed
 * in order of preference, for when a run doesn't say.
 */
export const providers = [
  "responses",
  "completions",
  "anthropic",
  "gemini",
] as const;

export type Provider = (typeof providers)[number];

/** Reasoning levels a model spec can name — the shared `reasoning_effort`
 *  vocabulary, plus `dynamic` for the thinking a model sizes itself. `max` is
 *  the level above `xhigh` (gpt-5.6+, and Anthropic's adaptive effort). Each
 *  provider maps a level onto its own setting (see reasoningProviderOptions). */
export const reasoningLevels = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "dynamic",
] as const;

/** Every level a spec may name. */
export type SpecReasoningLevel = (typeof reasoningLevels)[number];

/** The levels that configure thinking. `dynamic` is absent by design: it is
 *  configured by sending nothing, so it parses out as no level at all and
 *  never reaches the code that maps a level onto a request. */
export type ReasoningLevel = Exclude<SpecReasoningLevel, "dynamic">;

/**
 * A model as given everywhere in the harness — `<model>[@<reasoning>]`, e.g.
 * `gpt-5.5@high`. This whole string is THE model value: the CLI's --model,
 * input.json and results.json all carry it intact. The few places that need
 * the bare wire id (API calls, cost lookups) pare it with {@link bareModel}.
 */
export type ModelSpec = string;

function isSpecReasoningLevel(value: string): value is SpecReasoningLevel {
  return (reasoningLevels as readonly string[]).includes(value);
}

/** A spec split into its bare model id and the level it names, whatever that
 *  level is. Throws on an unknown level so a typo fails up front rather than
 *  running an expensive benchmark against the wrong configuration. */
function splitModelSpec(spec: ModelSpec): {
  model: string;
  level?: SpecReasoningLevel;
} {
  const idx = spec.lastIndexOf("@");
  if (idx === -1) return { model: spec };
  const model = spec.slice(0, idx);
  const level = spec.slice(idx + 1);
  if (!model || !isSpecReasoningLevel(level)) {
    throw new Error(
      `Invalid model spec “${spec}”. Use <model>[@<${reasoningLevels.join("|")}>]`
    );
  }
  return { model, level };
}

/**
 * Parse a model spec `<model>[@<reasoning>]` (e.g. `gpt-5.5@high`) into the
 * bare wire model id and the level to configure. `@dynamic` comes back with no
 * level: the model sizes its own thinking, which is asked for by configuring
 * none, so every caller from here down treats it as an unqualified model.
 */
export function parseModelSpec(spec: ModelSpec): {
  model: string;
  reasoning?: ReasoningLevel;
} {
  const { model, level } = splitModelSpec(spec);
  return level && level !== "dynamic" ? { model, reasoning: level } : { model };
}

/** The bare wire model id of a spec — for API calls and cost lookups, which
 *  key on the id alone. */
export function bareModel(spec: ModelSpec): string {
  return parseModelSpec(spec).model;
}

/**
 * Whether a model takes a reasoning parameter at all. One that doesn't rejects
 * it outright whatever its value — OpenAI below gpt-5 answers "reasoning.effort
 * is not supported with this model", claude below 4 refuses `thinking` — so
 * such a model is left unqualified instead of being stamped with a level.
 * Gemini is always true: its level configures nothing to begin with.
 */
function modelTakesReasoning(provider: Provider, model: string): boolean {
  switch (provider) {
    case "gemini":
      return true;
    case "completions":
    case "responses": {
      // The chat-latest models are non-reasoning siblings of a reasoning family.
      if (model.includes("-chat-latest")) return false;
      if (/^o\d/.test(model)) return true;
      const m = /^gpt-(\d+)/.exec(model);
      return m ? Number(m[1]) >= 5 : false;
    }
    case "anthropic": {
      // Claude 4+ names its family before the version (`claude-opus-4-8`);
      // the 3.x names that lead with the version don't match, as intended.
      const m = /^claude-(?:opus|sonnet|haiku|fable)-(\d+)/.exec(model);
      return m ? Number(m[1]) >= 4 : false;
    }
  }
}

/** Whether an OpenAI model supports the `max` effort — gpt-5.6 and
 *  newer families; everything below tops out at `xhigh`. */
function openaiSupportsMax(model: string): boolean {
  const m = /^gpt-(\d+)(?:\.(\d+))?/.exec(model);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2] ?? 0);
  return major > 5 || (major === 5 && minor >= 6);
}

/** Whether a claude model supports the `xhigh` effort — 4.7 and newer. 4.6 and
 *  below answer "does not support effort level 'xhigh'"; several of them still
 *  take `max`, which is its own setting rather than a step past xhigh. */
function anthropicSupportsXhigh(model: string): boolean {
  const m = /^claude-[a-z]+-(\d+)(?:-(\d+))?/.exec(model);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2] ?? 0);
  return major > 4 || (major === 4 && minor >= 7);
}

/**
 * The level a model actually honors — a level above what it supports clamps
 * to its top instead of erroring (the API would 400, and crashing a run over
 * a level the model lacks helps nobody): gemini tops out at `high`; OpenAI
 * models below gpt-5.6 top out at `xhigh`; claude below 4.7 has no `xhigh`
 * between its `high` and its `max`.
 */
export function clampReasoningLevel(
  provider: Provider,
  model: string,
  reasoning: ReasoningLevel
): ReasoningLevel {
  if (provider === "gemini" && (reasoning === "xhigh" || reasoning === "max")) {
    return "high";
  }
  if (
    (provider === "completions" || provider === "responses") &&
    reasoning === "max" &&
    !openaiSupportsMax(model)
  ) {
    return "xhigh";
  }
  if (
    provider === "anthropic" &&
    reasoning === "xhigh" &&
    !anthropicSupportsXhigh(model)
  ) {
    return "high";
  }
  return reasoning;
}

/**
 * The level a spec runs at when it names none: `medium` on every provider, so
 * default runs on different providers think about as hard. For OpenAI that is
 * also what an unconfigured request gets. Left alone, Claude does no extended
 * thinking and gemini sizes its own, which can mean none at all; `@dynamic`
 * still asks gemini to size its own.
 */
const providerDefaultLevels: Record<Provider, SpecReasoningLevel> = {
  completions: "medium",
  responses: "medium",
  anthropic: "medium",
  gemini: "medium",
};

/**
 * The spec as it effectively runs, and the one every record carries — so two
 * specs that run identically share one identity in results. Levels above what
 * the model supports come back clamped (see clampReasoningLevel), and a spec
 * naming no level comes back carrying the one its provider would have applied,
 * so a recorded model never leaves the effort of a run to be inferred. A model
 * that takes no reasoning parameter has no level to carry and stays
 * unqualified.
 *
 * Only gemini sizes its own thinking, so `@dynamic` on any other provider is
 * refused here rather than quietly running at that provider's own default.
 */
export function normalizeModelSpec(
  provider: Provider,
  spec: ModelSpec
): ModelSpec {
  const { model, level } = splitModelSpec(spec);
  if (!level) {
    return modelTakesReasoning(provider, model)
      ? `${model}@${providerDefaultLevels[provider]}`
      : spec;
  }
  if (level === "dynamic") {
    if (provider !== "gemini") {
      throw new Error(
        `Model “${model}” cannot run at @dynamic: only gemini sizes its own thinking`
      );
    }
    return spec;
  }
  const clamped = clampReasoningLevel(provider, model, level);
  return clamped === level ? spec : `${model}@${clamped}`;
}

/** Anthropic thinking budget per level — litellm's
 *  DEFAULT_REASONING_EFFORT_*_THINKING_BUDGET values. `minimal` is clamped up
 *  to Anthropic's 1024-token minimum, as litellm does. */
const ANTHROPIC_THINKING_BUDGETS: Record<
  Exclude<ReasoningLevel, "none">,
  number
> = {
  minimal: 1024,
  low: 1024,
  medium: 2048,
  high: 4096,
  xhigh: 8192,
  max: 16384,
};

/**
 * Claude models driven with adaptive thinking + an output-config effort
 * instead of a token budget: 4.6 and newer, which answer a token budget with
 * "thinking.type.enabled is not supported for this model". A dated id like
 * `claude-opus-4-20250514` is version 4, not 4.20250514.
 */
function isAdaptiveThinkingModel(model: string): boolean {
  const m = /^claude-[a-z]+-(\d+)(?:-(\d{1,2}))?(?:-|$)/.exec(
    model.toLowerCase()
  );
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2] ?? 0);
  return major > 4 || (major === 4 && minor >= 6);
}

/** Adaptive-thinking effort per level (minimal sinks to low). */
const ANTHROPIC_ADAPTIVE_EFFORT: Record<
  Exclude<ReasoningLevel, "none">,
  "low" | "medium" | "high" | "xhigh" | "max"
> = {
  minimal: "low",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: "max",
};

/** Gemini (< 3) thinking budget for a level, including the per-model minimal
 *  budgets. `none` disables thinking outright; `xhigh` uses the `high` budget
 *  (see clampReasoningLevel). */
function geminiThinkingBudget(
  reasoning: ReasoningLevel,
  model: string
): number {
  switch (reasoning) {
    case "none":
      return 0;
    case "minimal":
      if (model.includes("gemini-2.5-flash-lite")) return 512;
      if (model.includes("gemini-2.5-pro")) return 128;
      if (model.includes("gemini-2.5-flash")) return 1;
      return 128;
    case "low":
      return 1024;
    case "medium":
      return 2048;
    case "high":
    case "xhigh":
    case "max":
      return 4096;
  }
}

function isGemini3OrNewer(model: string): boolean {
  const m = /^gemini-(\d+)/.exec(model);
  return m ? Number(m[1]) >= 3 : false;
}

/** Gemini 3+ thinkingConfig for a level. Gemini 3 is configured by level, not
 *  budget, and can't fully disable thinking — `none`/`minimal` sink to the
 *  lowest level the model family supports (flash models have `minimal`, the
 *  rest bottom out at `low`). `xhigh` uses `high` (see clampReasoningLevel). */
function gemini3ThinkingConfig(
  reasoning: ReasoningLevel,
  model: string
): { thinkingLevel: "minimal" | "low" | "medium" | "high" } {
  const lowest = model.includes("flash") ? "minimal" : "low";
  switch (reasoning) {
    case "none":
    case "minimal":
      return { thinkingLevel: lowest };
    case "low":
    case "medium":
    case "high":
      return { thinkingLevel: reasoning };
    case "xhigh":
    case "max":
      return { thinkingLevel: "high" };
  }
}

/** The provider options a reasoning level configures, following the
 *  `reasoning_effort` semantics per provider: OpenAI takes the level verbatim,
 *  Anthropic maps it to a thinking budget (adaptive effort on 4.6+ models),
 *  Gemini to a budget (< 3) or a thinking level (3+). */
export function reasoningProviderOptions(
  provider: Provider,
  model: string,
  reasoning: ReasoningLevel
): ProviderOptions {
  reasoning = clampReasoningLevel(provider, model, reasoning);
  switch (provider) {
    case "completions":
    case "responses":
      return { openai: { reasoningEffort: reasoning } };
    case "anthropic":
      if (reasoning === "none") {
        return { anthropic: { thinking: { type: "disabled" } } };
      }
      if (isAdaptiveThinkingModel(model)) {
        return {
          anthropic: {
            thinking: { type: "adaptive" },
            effort: ANTHROPIC_ADAPTIVE_EFFORT[reasoning],
          },
        };
      }
      return {
        anthropic: {
          thinking: {
            type: "enabled",
            budgetTokens: ANTHROPIC_THINKING_BUDGETS[reasoning],
          },
        },
      };
    case "gemini":
      if (isGemini3OrNewer(model)) {
        return {
          google: { thinkingConfig: gemini3ThinkingConfig(reasoning, model) },
        };
      }
      return {
        google: {
          thinkingConfig: {
            thinkingBudget: geminiThinkingBudget(reasoning, model),
          },
        },
      };
  }
}

/** One known model per provider, each from that provider's own list, so a
 *  table can't file a model under a provider that doesn't serve it. */
type ProviderModels = {
  responses: KnownOpenAIModelName;
  completions: KnownOpenAIModelName;
  anthropic: KnownAnthropicModelName;
  gemini: KnownGeminiModelName;
};

/** The model the agent uses when a run names none. */
const defaultModels: ProviderModels = {
  completions: "gpt-6.1-sol",
  responses: "gpt-6.1-sol",
  anthropic: "claude-sonnet-5-5",
  gemini: "gemini-4-argon",
};

/** The model a customer uses on a provider when the run names none: a cheap,
 *  fast one, since the customer only needs to follow a script. */
const customerModels: ProviderModels = {
  completions: "gpt-6-luna",
  responses: "gpt-6-luna",
  anthropic: "claude-haiku-5-5",
  gemini: "gemini-3.5-flash-lite",
};

/** The judge's model on each provider: one that reads long transcripts
 *  well and cheaply, since the judge reads near-full transcripts. */
const judgeModels: ProviderModels = {
  completions: "gpt-6-luna",
  responses: "gpt-6-luna",
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-3.8-flash",
};

/** The model the agent runs on a provider when the run names none. */
export function defaultModelFor(provider: Provider): string {
  return defaultModels[provider];
}

/** The model the customer and LLM-backed tools run on a provider when the
 *  run names none. */
export function customerModelFor(provider: Provider): string {
  return customerModels[provider];
}

/** The model the judge runs on a provider when the run names none. */
export function judgeModelFor(provider: Provider): string {
  return judgeModels[provider];
}

/** The environment variables each provider's API key is read from, the
 *  first being the one to set. */
export const API_KEY_ENV: Record<Provider, readonly string[]> = {
  responses: ["OPENAI_API_KEY"],
  completions: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
};

function apiKeyValue(provider: Provider): string | undefined {
  for (const name of API_KEY_ENV[provider]) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

/** Whether the environment holds an API key for `provider`. */
export function hasApiKey(provider: Provider): boolean {
  return apiKeyValue(provider) !== undefined;
}

/** A model can't be built because its provider's API key isn't set. Thrown
 *  before a run calls any model, so the caller can fix it and try again. */
export class MissingApiKeyError extends Error {
  readonly provider: Provider;
  /** What the model was for: "agent", "customer", "judge", … */
  readonly role: string;

  constructor(provider: Provider, role: string) {
    super(
      `${API_KEY_ENV[provider].join(" or ")} is required: the ${role} runs on ${provider}`
    );
    this.name = "MissingApiKeyError";
    this.provider = provider;
    this.role = role;
  }
}

function apiKey(provider: Provider, role: string): string {
  const value = apiKeyValue(provider);
  if (value === undefined) throw new MissingApiKeyError(provider, role);
  return value;
}

/** The provider a model id belongs to, when the id makes that clear:
 *  `claude-opus-4-8` is anthropic's, `gpt-5.5` is served over responses. */
export function providerForModel(spec: ModelSpec): Provider | undefined {
  const model = bareModel(spec);
  const service = resolveModel(model).matched ? pickService(model) : undefined;
  switch (service) {
    case "openai":
      return "responses";
    case "anthropic":
    case "gemini":
      return service;
    default:
      return undefined;
  }
}

export type Model = {
  languageModel: LanguageModel;
  provider: Provider;
  /** The model spec as run (`<model>[@<reasoning>]`), normalized — records
   *  and display carry it whole; pare with bareModel for the wire id. */
  model: ModelSpec;
  /** Provider options to pass through to generateText (reasoning settings). */
  providerOptions: ProviderOptions;
};

function createLanguageModel(
  provider: Provider,
  model: string,
  role: string
): LanguageModel {
  const key = apiKey(provider, role);
  switch (provider) {
    case "completions":
      return createOpenAI({ apiKey: key }).chat(model);
    case "responses":
      return createOpenAI({ apiKey: key }).responses(model);
    case "anthropic":
      return createAnthropic({ apiKey: key })(model);
    case "gemini": {
      // Some Gemini models return tool calls without ids, and the SDK makes
      // one up. The id goes back in the next request, so a random one would
      // stop a rerun from matching its recorded requests; count instead.
      let ids = 0;
      return createGoogleGenerativeAI({
        apiKey: key,
        // The OpenAI and Anthropic providers read their *_BASE_URL themselves;
        // the Google one doesn't, so pass it on for it.
        baseURL: process.env.GEMINI_BASE_URL || undefined,
        generateId: () => `gen_${++ids}`,
      })(model);
    }
  }
}

/**
 * The model for one role in a run. `role` (agent, customer, judge, …) only
 * labels the error when the provider's API key is missing, so a run fails
 * before it starts rather than halfway through.
 */
export function get_model(
  provider: Provider,
  spec: ModelSpec | undefined,
  role: string
): Model {
  const model = normalizeModelSpec(provider, spec ?? defaultModels[provider]);
  const { model: wireModel, reasoning } = parseModelSpec(model);

  const providerOptions: ProviderOptions = {};
  if (provider === "responses") {
    // Every turn resends the whole thread, so nothing needs storing upstream.
    providerOptions.openai = { store: false };
  }
  if (reasoning) {
    for (const [key, options] of Object.entries(
      reasoningProviderOptions(provider, wireModel, reasoning)
    )) {
      providerOptions[key] = { ...providerOptions[key], ...options };
    }
  }

  return {
    languageModel: createLanguageModel(provider, wireModel, role),
    provider,
    model,
    providerOptions,
  };
}

/** A provider plus an optional model spec, as the CLI takes one per role. */
export type ModelChoice = { provider: Provider; model?: ModelSpec };

/**
 * The supporting models of a run, beside the agent under test. Unchosen,
 * each runs on OpenAI, or on the first provider with an API key when
 * OPENAI_API_KEY isn't set, with that provider's model for the role. Choosing models makes runs cheaper or keeps
 * them on one provider, but scores are then not directly comparable to runs
 * on the defaults.
 */
export type SupportModelChoices = {
  /** The simulated customer, and the tools that answer with an LLM. */
  customer?: ModelChoice;
  /** The judge: it gates the customer's done and scores the run. */
  judge?: ModelChoice;
};

/** Each model is built on first use, so a run only needs API keys for the
 *  roles it actually exercises. */
export type SupportModels = {
  customer: Model;
  /** LLM-backed tools (e.g. the travel agent's hotel details); the same
   *  model as the customer. */
  tool: Model;
  /** Checks a customer's "done" against the transcript before ending a run,
   *  and scores the finished run (`--judge`). */
  judge: Model;
};

/** The roles' names in messages and in MissingApiKeyError. */
export const SUPPORT_ROLES = {
  customer: "customer and LLM-backed tools",
  judge: "judge",
} as const;

/**
 * A supporting role's model: the run's choice for it, else the role's
 * default provider, else (that provider having no key) the first provider
 * with one, which the run is told about.
 */
function supportModel(
  choice: ModelChoice | undefined,
  defaultProvider: Provider,
  models: Record<Provider, string>,
  role: string
): Model {
  if (choice) {
    return get_model(
      choice.provider,
      choice.model ?? models[choice.provider],
      role
    );
  }
  const fallback = hasApiKey(defaultProvider)
    ? undefined
    : providers.find(hasApiKey);
  if (!fallback) {
    // Its key is set, or none is: then the caller hears about the default.
    return get_model(defaultProvider, models[defaultProvider], role);
  }
  const model = get_model(fallback, models[fallback], role);
  console.log(
    `Running the ${role} on ${fallback}/${model.model} (${API_KEY_ENV[defaultProvider][0]} isn’t set).`
  );
  return model;
}

function lazy(build: () => Model): () => Model {
  let model: Model | undefined;
  return () => (model ??= build());
}

export function get_support_models(
  choices: SupportModelChoices = {}
): SupportModels {
  const customer = lazy(() =>
    supportModel(
      choices.customer,
      "responses",
      customerModels,
      SUPPORT_ROLES.customer
    )
  );
  const judge = lazy(() =>
    supportModel(choices.judge, "responses", judgeModels, SUPPORT_ROLES.judge)
  );
  return {
    get customer() {
      return customer();
    },
    get tool() {
      return customer();
    },
    get judge() {
      return judge();
    },
  };
}
