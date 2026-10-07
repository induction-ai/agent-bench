import type { LanguageModelUsage } from "ai";
import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import { computeJudgeResult } from "../src/judge.ts";
import {
  renderResultsHtml,
  type RunResultRecord,
} from "../src/results_html.ts";
import { getRetryDelay, isContextOverflow } from "../src/retry.ts";
import { _test_, RunCostCollector, UsageTracker } from "../src/usage.ts";

function usage(u: {
  noCache?: number;
  cacheRead?: number;
  cacheWrite?: number;
  output?: number;
  raw?: unknown;
}): LanguageModelUsage {
  const input = (u.noCache ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
  return {
    inputTokens: input,
    inputTokenDetails: {
      noCacheTokens: u.noCache ?? 0,
      cacheReadTokens: u.cacheRead ?? 0,
      cacheWriteTokens: u.cacheWrite ?? 0,
    },
    outputTokens: u.output ?? 0,
    outputTokenDetails: { textTokens: u.output ?? 0, reasoningTokens: 0 },
    totalTokens: input + (u.output ?? 0),
    ...(u.raw !== undefined && { raw: u.raw }),
  } as LanguageModelUsage;
}

describe("UsageTracker", () => {
  it("prices each bucket at the model's own rate", () => {
    // claude-opus-4-8: $5/M input, $25/M output, $0.50/M cache read,
    // $6.25/M cache write.
    const tracker = new UsageTracker("claude-opus-4-8");
    tracker.addCall([
      {
        usage: usage({
          noCache: 1_000_000,
          cacheRead: 1_000_000,
          cacheWrite: 1_000_000,
          output: 1_000_000,
        }),
        serviceTier: "standard",
      },
    ]);
    const json = tracker.toJSON();
    expect(json.cost_cents).toBe(500 + 50 + 625 + 2500);
    // Without caching, all three million input tokens bill at $5/M.
    expect(json.cost_if_no_caching_cents).toBe(1500 + 2500);
    expect(json.input).toBe(3_000_000);
    expect(json.calls).toBe(1);
  });

  it("counts a multi-step generateText as one call", () => {
    const tracker = new UsageTracker("gpt-5.5");
    const step = {
      usage: usage({ noCache: 10, output: 1 }),
      serviceTier: "standard" as const,
    };
    tracker.addCall([step, step]);
    expect(tracker.toJSON()).toMatchObject({ calls: 1, input: 20, output: 2 });
  });
});

describe("RunCostCollector", () => {
  it("sums each role over the models it used", () => {
    const costs = new RunCostCollector();
    // 100K input tokens: under gpt-6-luna's 272K long-context tier.
    const step = {
      usage: usage({ noCache: 100_000 }),
      serviceTier: "standard" as const,
    };
    costs.addCall("judge", "gemini-3.5-flash", [step]);
    costs.addCall("judge", "gpt-6-luna", [step]);
    const judge = costs.toJSON().judge!;
    expect(judge.calls).toBe(2);
    expect(judge.cost_cents).toBe(15 + 1);
    expect(costs.totalCost()).toBe(16);
  });

  it("prices a prompt past the long-context threshold at the higher tier", () => {
    const costs = new RunCostCollector();
    const step = {
      usage: usage({ noCache: 1_000_000 }),
      serviceTier: "standard" as const,
    };
    costs.addCall("judge", "gpt-6-luna", [step]);
    expect(costs.totalCost()).toBe(20);
  });
});

describe("costServiceTier", () => {
  it("reads priority (or fast) processing off the response body", () => {
    expect(_test_.costServiceTier({ service_tier: "priority" })).toBe(
      "priority"
    );
    expect(_test_.costServiceTier({ service_tier: "fast" })).toBe("priority");
    expect(_test_.costServiceTier({ service_tier: "default" })).toBe(
      "standard"
    );
    expect(_test_.costServiceTier(undefined)).toBe("standard");
  });
});

describe("withRecoveredCacheWrites", () => {
  it("moves OpenAI's unmapped cache writes out of the plain input", () => {
    const recovered = _test_.withRecoveredCacheWrites(
      usage({
        noCache: 1000,
        raw: { input_tokens_details: { cache_write_tokens: 400 } },
      })
    );
    expect(recovered.inputTokenDetails).toMatchObject({
      noCacheTokens: 600,
      cacheWriteTokens: 400,
    });
  });

  it("leaves usage alone when the provider mapped the writes itself", () => {
    const u = usage({ noCache: 1000, cacheWrite: 50 });
    expect(_test_.withRecoveredCacheWrites(u)).toBe(u);
  });
});

describe("computeJudgeResult", () => {
  const criteria = (met: boolean[]) =>
    met.map((m, i) => ({ criterion: `c${i}`, met: m, evidence: "" }));

  it("adds the efficiency bonus only when every criterion is met", () => {
    expect(
      computeJudgeResult({
        criteria: criteria([true, true]),
        efficiency: 2,
        reasoning: "",
      })
    ).toMatchObject({ success: "yes", score: 10 });
    expect(
      computeJudgeResult({
        criteria: criteria([true, false]),
        efficiency: 2,
        reasoning: "",
      })
    ).toMatchObject({ success: "partial", score: 5 });
  });

  it("floors a run that met nothing at 1", () => {
    expect(
      computeJudgeResult({
        criteria: criteria([false, false]),
        efficiency: 0,
        reasoning: "",
      })
    ).toMatchObject({ success: "no", score: 1 });
  });
});

describe("getRetryDelay", () => {
  it("reads each provider's retry header", () => {
    expect(getRetryDelay({ "retry-after-ms": "250" })).toBe(250);
    expect(getRetryDelay({ "Retry-After": "3" })).toBe(3000);
    expect(getRetryDelay({ "x-ratelimit-reset-requests": "1m2s" })).toBe(
      62_000
    );
    expect(getRetryDelay({})).toBeNull();
  });
});

describe("isContextOverflow", () => {
  const apiError = (statusCode: number, responseBody: string) =>
    new APICallError({
      message: "Bad Request",
      url: "https://example.test",
      requestBodyValues: {},
      statusCode,
      responseBody,
    });

  it("recognizes a prompt-too-long 400", () => {
    expect(
      isContextOverflow(
        apiError(400, "prompt is too long: 250000 tokens > 200000 maximum")
      )
    ).toBe(true);
  });

  it("ignores other 400s and other statuses", () => {
    expect(isContextOverflow(apiError(400, "invalid tool schema"))).toBe(false);
    expect(isContextOverflow(apiError(500, "context length"))).toBe(false);
  });
});

describe("renderResultsHtml", () => {
  const record: RunResultRecord = {
    run_id: "r_1",
    timestamp: "2026-10-06T15:30:12.000Z",
    git_sha: null,
    git_url: null,
    agent: "travel_agent",
    provider: "anthropic",
    model: "claude-opus-4-8@medium",
    customer: "multi_city",
    support_models: {},
    score: 7,
    reasoning: "Missed one criterion.",
    judge: {
      success: "partial",
      score: 7,
      efficiency: 0,
      reasoning: "Missed one criterion.",
      criteria: [{ criterion: "Picked a hotel", met: false, evidence: "" }],
    },
    error: null,
    usage: {
      input: 0,
      output: 0,
      cached_input: 0,
      uncached_input: 0,
      cache_write_input: 0,
      calls: 0,
      cost_cents: 0,
      cost_if_no_caching_cents: 0,
    },
    cost: 12.5,
    costs: {},
    messages: [
      { role: "user", content: "<script>alert(1)</script>" },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "c1",
            toolName: "flight_search",
            input: { origin: "LAX" },
          },
        ],
      },
    ],
    customer_turns: 1,
    client_turns: 1,
    llm_latency_ms: 1500,
  };

  it("escapes transcript text", async () => {
    const html = await renderResultsHtml(record);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("shows the score, the judge's verdicts, and tool calls", async () => {
    const html = await renderResultsHtml(record);
    expect(html).toContain("7/10");
    expect(html).toContain("Picked a hotel");
    expect(html).toContain("flight_search");
    expect(html).toContain("12.5¢");
  });
});
