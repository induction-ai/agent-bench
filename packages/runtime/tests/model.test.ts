import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultModelFor,
  get_support_models,
  MissingApiKeyError,
  normalizeModelSpec,
  parseModelSpec,
  providerForModel,
  reasoningProviderOptions,
} from "../src/model.ts";

describe("parseModelSpec", () => {
  it("returns the bare model when the spec names no reasoning level", () => {
    expect(parseModelSpec("gpt-5.5")).toEqual({ model: "gpt-5.5" });
  });

  it("reads the reasoning level off the model", () => {
    expect(parseModelSpec("gpt-5.5@high")).toEqual({
      model: "gpt-5.5",
      reasoning: "high",
    });
    expect(parseModelSpec("claude-opus-4-8@none")).toEqual({
      model: "claude-opus-4-8",
      reasoning: "none",
    });
  });

  it("returns the bare model when the spec leaves the thinking to the model", () => {
    expect(parseModelSpec("gemini-3.5-flash@dynamic")).toEqual({
      model: "gemini-3.5-flash",
    });
  });

  it("rejects an unknown reasoning level", () => {
    expect(() => parseModelSpec("gpt-5.5@huge")).toThrow(/Invalid model spec/);
  });

  it("rejects a spec with no model before the level", () => {
    expect(() => parseModelSpec("@high")).toThrow(/Invalid model spec/);
  });
});

describe("normalizeModelSpec", () => {
  it("records the clamped level when the spec asks for more than the model supports", () => {
    expect(normalizeModelSpec("completions", "gpt-5.5@max")).toBe(
      "gpt-5.5@xhigh"
    );
    expect(normalizeModelSpec("gemini", "gemini-3.5-flash@max")).toBe(
      "gemini-3.5-flash@high"
    );
  });

  it("keeps a spec the model supports unchanged", () => {
    expect(normalizeModelSpec("responses", "gpt-5.6-sol@max")).toBe(
      "gpt-5.6-sol@max"
    );
    expect(normalizeModelSpec("completions", "gpt-5.5@xhigh")).toBe(
      "gpt-5.5@xhigh"
    );
    expect(normalizeModelSpec("anthropic", "claude-opus-4-8@none")).toBe(
      "claude-opus-4-8@none"
    );
    expect(normalizeModelSpec("gemini", "gemini-3.5-flash@dynamic")).toBe(
      "gemini-3.5-flash@dynamic"
    );
  });

  it("records the clamped level for a claude model with no xhigh", () => {
    expect(normalizeModelSpec("anthropic", "claude-sonnet-4-6@xhigh")).toBe(
      "claude-sonnet-4-6@high"
    );
    expect(normalizeModelSpec("anthropic", "claude-opus-4-8@xhigh")).toBe(
      "claude-opus-4-8@xhigh"
    );
  });

  it("records the default level when the spec names none", () => {
    expect(normalizeModelSpec("responses", "gpt-5.6-sol")).toBe(
      "gpt-5.6-sol@medium"
    );
    expect(normalizeModelSpec("completions", "gpt-5.5")).toBe("gpt-5.5@medium");
    expect(normalizeModelSpec("anthropic", "claude-opus-4-8")).toBe(
      "claude-opus-4-8@medium"
    );
    expect(normalizeModelSpec("gemini", "gemini-3.1-pro-preview")).toBe(
      "gemini-3.1-pro-preview@medium"
    );
    expect(normalizeModelSpec("gemini", "gemini-2.5-pro")).toBe(
      "gemini-2.5-pro@medium"
    );
  });

  it("leaves a model that takes no reasoning parameter unqualified", () => {
    expect(normalizeModelSpec("responses", "gpt-4o")).toBe("gpt-4o");
    expect(normalizeModelSpec("completions", "gpt-4.1-mini")).toBe(
      "gpt-4.1-mini"
    );
    expect(normalizeModelSpec("responses", "gpt-5.2-chat-latest")).toBe(
      "gpt-5.2-chat-latest"
    );
    expect(normalizeModelSpec("anthropic", "claude-3-5-haiku-20241022")).toBe(
      "claude-3-5-haiku-20241022"
    );
  });

  it("records a level for the reasoning models of each family", () => {
    expect(normalizeModelSpec("responses", "o4-mini")).toBe("o4-mini@medium");
    expect(normalizeModelSpec("responses", "gpt-5.4-mini")).toBe(
      "gpt-5.4-mini@medium"
    );
    expect(normalizeModelSpec("anthropic", "claude-haiku-4-5")).toBe(
      "claude-haiku-4-5@medium"
    );
  });

  it("rejects a model that cannot size its own thinking", () => {
    expect(() =>
      normalizeModelSpec("responses", "gpt-5.6-sol@dynamic")
    ).toThrow(/only gemini/);
    expect(() =>
      normalizeModelSpec("anthropic", "claude-opus-4-8@dynamic")
    ).toThrow(/only gemini/);
  });
});

describe("defaultModelFor", () => {
  it("names each provider's default model", () => {
    expect(defaultModelFor("responses")).toBe("gpt-6.1-sol");
    expect(defaultModelFor("completions")).toBe("gpt-6.1-sol");
    expect(defaultModelFor("anthropic")).toBe("claude-sonnet-5-5");
    expect(defaultModelFor("gemini")).toBe("gemini-4-argon");
  });
});

describe("reasoningProviderOptions", () => {
  it("passes the level through as OpenAI reasoning effort", () => {
    expect(reasoningProviderOptions("completions", "gpt-5.5", "xhigh")).toEqual(
      { openai: { reasoningEffort: "xhigh" } }
    );
    expect(reasoningProviderOptions("responses", "gpt-5.6-sol", "max")).toEqual(
      { openai: { reasoningEffort: "max" } }
    );
    expect(reasoningProviderOptions("responses", "gpt-5.5", "none")).toEqual({
      openai: { reasoningEffort: "none" },
    });
  });

  it("maps the level to an Anthropic thinking budget", () => {
    expect(
      reasoningProviderOptions("anthropic", "claude-sonnet-4-5", "high")
    ).toEqual({
      anthropic: { thinking: { type: "enabled", budgetTokens: 4096 } },
    });
    expect(
      reasoningProviderOptions("anthropic", "claude-sonnet-4-5", "max")
    ).toEqual({
      anthropic: { thinking: { type: "enabled", budgetTokens: 16384 } },
    });
  });

  it("uses adaptive thinking with an effort for claude 4.6 and newer", () => {
    expect(
      reasoningProviderOptions("anthropic", "claude-opus-4-8", "medium")
    ).toEqual({
      anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
    });
    expect(
      reasoningProviderOptions("anthropic", "claude-sonnet-4-6", "high")
    ).toEqual({
      anthropic: { thinking: { type: "adaptive" }, effort: "high" },
    });
    expect(
      reasoningProviderOptions("anthropic", "claude-opus-4-7", "minimal")
    ).toEqual({
      anthropic: { thinking: { type: "adaptive" }, effort: "low" },
    });
    expect(
      reasoningProviderOptions("anthropic", "claude-sonnet-4-6", "max")
    ).toEqual({
      anthropic: { thinking: { type: "adaptive" }, effort: "max" },
    });
  });

  it("uses adaptive thinking with an effort for claude 5 models", () => {
    for (const model of [
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
      "claude-opus-5",
      "claude-fable-5-1",
    ]) {
      expect(reasoningProviderOptions("anthropic", model, "medium")).toEqual({
        anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
      });
    }
  });

  it("maps the level to a thinking budget for dated claude models below 4.6", () => {
    for (const model of [
      "claude-opus-4-20250514",
      "claude-haiku-4-5-20251001",
      "claude-3-5-haiku-20241022",
    ]) {
      expect(reasoningProviderOptions("anthropic", model, "high")).toEqual({
        anthropic: { thinking: { type: "enabled", budgetTokens: 4096 } },
      });
    }
  });

  it("disables Anthropic thinking for none", () => {
    expect(
      reasoningProviderOptions("anthropic", "claude-opus-4-8", "none")
    ).toEqual({ anthropic: { thinking: { type: "disabled" } } });
    expect(
      reasoningProviderOptions("anthropic", "claude-sonnet-4-6", "none")
    ).toEqual({ anthropic: { thinking: { type: "disabled" } } });
  });

  it("maps the level to a gemini thinking budget", () => {
    expect(
      reasoningProviderOptions("gemini", "gemini-2.5-flash", "low")
    ).toEqual({ google: { thinkingConfig: { thinkingBudget: 1024 } } });
    expect(
      reasoningProviderOptions("gemini", "gemini-2.5-pro", "none")
    ).toEqual({ google: { thinkingConfig: { thinkingBudget: 0 } } });
  });

  it("uses each gemini model's own minimal thinking budget", () => {
    const budget = (model: string) =>
      reasoningProviderOptions("gemini", model, "minimal");
    expect(budget("gemini-2.5-flash")).toEqual({
      google: { thinkingConfig: { thinkingBudget: 1 } },
    });
    expect(budget("gemini-2.5-flash-lite")).toEqual({
      google: { thinkingConfig: { thinkingBudget: 512 } },
    });
    expect(budget("gemini-2.5-pro")).toEqual({
      google: { thinkingConfig: { thinkingBudget: 128 } },
    });
  });

  it("selects a thinking level for gemini 3 models", () => {
    expect(
      reasoningProviderOptions("gemini", "gemini-3.5-flash", "medium")
    ).toEqual({ google: { thinkingConfig: { thinkingLevel: "medium" } } });
    expect(
      reasoningProviderOptions("gemini", "gemini-3.5-flash", "none")
    ).toEqual({ google: { thinkingConfig: { thinkingLevel: "minimal" } } });
    expect(
      reasoningProviderOptions("gemini", "gemini-3-pro-preview", "minimal")
    ).toEqual({ google: { thinkingConfig: { thinkingLevel: "low" } } });
  });

  it("selects a thinking level for gemini 4 models", () => {
    expect(
      reasoningProviderOptions("gemini", "gemini-4-argon", "high")
    ).toEqual({ google: { thinkingConfig: { thinkingLevel: "high" } } });
    expect(
      reasoningProviderOptions("gemini", "gemini-4-argon", "minimal")
    ).toEqual({ google: { thinkingConfig: { thinkingLevel: "low" } } });
  });

  it("clamps max to xhigh for OpenAI models below gpt-5.6", () => {
    expect(reasoningProviderOptions("completions", "gpt-5.5", "max")).toEqual({
      openai: { reasoningEffort: "xhigh" },
    });
    expect(reasoningProviderOptions("responses", "gpt-5-mini", "max")).toEqual({
      openai: { reasoningEffort: "xhigh" },
    });
  });

  it("clamps xhigh to high for claude models that lack it", () => {
    expect(
      reasoningProviderOptions("anthropic", "claude-sonnet-4-6", "xhigh")
    ).toEqual({
      anthropic: { thinking: { type: "adaptive" }, effort: "high" },
    });
    expect(
      reasoningProviderOptions("anthropic", "claude-opus-4-8", "xhigh")
    ).toEqual({
      anthropic: { thinking: { type: "adaptive" }, effort: "xhigh" },
    });
  });

  it("clamps xhigh and max to high for gemini models", () => {
    expect(
      reasoningProviderOptions("gemini", "gemini-2.5-flash", "xhigh")
    ).toEqual({ google: { thinkingConfig: { thinkingBudget: 4096 } } });
    expect(
      reasoningProviderOptions("gemini", "gemini-3.5-flash", "max")
    ).toEqual({ google: { thinkingConfig: { thinkingLevel: "high" } } });
  });
});

describe("providerForModel", () => {
  it("reads the provider off a known model id", () => {
    expect(providerForModel("gpt-5.5@high")).toBe("responses");
    expect(providerForModel("claude-opus-4-8")).toBe("anthropic");
    expect(providerForModel("gemini-3.8-flash")).toBe("gemini");
  });

  it("leaves an unknown model to the caller", () => {
    expect(providerForModel("my-local-model")).toBeUndefined();
  });
});

describe("get_support_models", () => {
  const KEYS = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
  ];
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.restoreAllMocks();
  });
  const label = (m: { provider: string; model: string }) =>
    `${m.provider}/${m.model}`;

  it("runs every role on OpenAI when its key is set", () => {
    process.env.OPENAI_API_KEY = "test";
    process.env.GEMINI_API_KEY = "test";
    const support = get_support_models();
    expect(label(support.customer)).toBe("responses/gpt-6-luna@medium");
    expect(support.tool).toBe(support.customer);
    expect(label(support.judge)).toBe("responses/gpt-6-luna@medium");
  });

  it("moves each role to a provider whose key is set, with its model for the role", () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const anthropic = get_support_models();
    expect(label(anthropic.customer)).toBe("anthropic/claude-haiku-5-5@medium");
    expect(label(anthropic.judge)).toBe("anthropic/claude-sonnet-4-6@medium");

    delete process.env.ANTHROPIC_API_KEY;
    process.env.GEMINI_API_KEY = "test";
    const gemini = get_support_models();
    expect(label(gemini.customer)).toBe("gemini/gemini-3.5-flash-lite@medium");
    expect(label(gemini.judge)).toBe("gemini/gemini-3.8-flash@medium");
  });

  it("asks for OpenAI's key when no key is set", () => {
    const support = get_support_models();
    expect(() => support.judge).toThrow(MissingApiKeyError);
    expect(() => support.judge).toThrow(/OPENAI_API_KEY/);
  });

  it("uses a chosen provider's model for the role", () => {
    process.env.OPENAI_API_KEY = "test";
    process.env.ANTHROPIC_API_KEY = "test";
    const support = get_support_models({ judge: { provider: "anthropic" } });
    expect(label(support.judge)).toBe("anthropic/claude-sonnet-4-6@medium");
  });
});
