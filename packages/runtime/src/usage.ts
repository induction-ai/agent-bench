import {
  getTokenCost,
  resolveModel,
  type CostServiceTier,
} from "@agent-bench/model-stats/index.js";
import { TokenCount } from "@agent-bench/model-stats/token_count.js";
import {
  EMPTY_COST_USAGE_COUNTS,
  sumCostUsageCounts,
  totalCost,
  type CostUsageCounts,
  type TokenUsageCounts,
} from "@agent-bench/model-stats/usage_counts.js";
import { generateText, type LanguageModelUsage } from "ai";

export type UsageData = {
  /** Full prompt tokens: uncached_input + cached_input + cache_write_input. */
  input: number;
  output: number;
  /** Cache-read tokens (served from a cached prefix). */
  cached_input: number;
  /** Tokens billed at the plain input rate — not read from cache, not
   *  written to it. */
  uncached_input: number;
  /** Tokens written to the prompt cache, billed at the write rate. */
  cache_write_input: number;
  calls: number;
  cost_cents: number;
  /** Theoretical: the same calls repriced as if caching didn't exist (every
   *  input token at the full input rate). Measures what caching bought. */
  cost_if_no_caching_cents: number;
};

function centsOf(cost: CostUsageCounts): number {
  return Number(totalCost(cost).times(100).toNumber().toFixed(2));
}

/** Accumulates the token usage and cost of one model's calls. */
export class UsageTracker {
  private totals = {
    input: 0,
    output: 0,
    cached: 0,
    uncached: 0,
    cache_write: 0,
  };
  private calls = 0;

  // Long-context pricing tiers are decided per call against that call's
  // prompt size, so dollar costs are accumulated as each call lands — they
  // cannot be recovered from the summed token totals once calls are merged.
  private cost_acc: CostUsageCounts = EMPTY_COST_USAGE_COUNTS;
  // Same accumulation, but pricing every input token at the full input rate.
  private uncached_cost_acc: CostUsageCounts = EMPTY_COST_USAGE_COUNTS;

  private readonly model: string;

  constructor(model: string) {
    this.model = model;
  }

  /** Record one HTTP request's usage. */
  private addUsage(usage: LanguageModelUsage, serviceTier: CostServiceTier) {
    const cached = usage.inputTokenDetails?.cacheReadTokens ?? 0;
    const cache_write = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
    const uncached =
      usage.inputTokenDetails?.noCacheTokens ??
      Math.max(0, (usage.inputTokens ?? 0) - cached - cache_write);
    const output = usage.outputTokens ?? 0;
    const input = cached + uncached + cache_write;

    this.totals.input += input;
    this.totals.cached += cached;
    this.totals.cache_write += cache_write;
    this.totals.uncached += uncached;
    this.totals.output += output;

    const callCounts: TokenUsageCounts = {
      model: this.model,
      input: TokenCount.value(input),
      // `uncached` in TokenUsageCounts is base input plus cache writes.
      uncached: TokenCount.value(uncached + cache_write),
      cached: TokenCount.value(cached),
      cache_write: TokenCount.value(cache_write),
      output: TokenCount.value(output),
    };
    this.cost_acc = sumCostUsageCounts([
      this.cost_acc,
      getTokenCost(callCounts, serviceTier),
    ]);

    const noCachingCounts: TokenUsageCounts = {
      model: this.model,
      input: TokenCount.value(input),
      uncached: TokenCount.value(input),
      cached: TokenCount.zero,
      output: TokenCount.value(output),
    };
    this.uncached_cost_acc = sumCostUsageCounts([
      this.uncached_cost_acc,
      getTokenCost(noCachingCounts, serviceTier),
    ]);
  }

  /** Record one generateText call, which may span several HTTP requests
   *  (one per tool-call step). */
  addCall(
    usages: Array<{ usage: LanguageModelUsage; serviceTier: CostServiceTier }>
  ): void {
    for (const { usage, serviceTier } of usages) {
      this.addUsage(usage, serviceTier);
    }
    this.calls++;
  }

  cost(): number {
    return centsOf(this.cost_acc);
  }

  toString() {
    return `\n📊 Token usage: ${this.totals.input} -> ${this.totals.output} (${this.cost()}¢)`;
  }

  toJSON(): UsageData {
    return {
      input: this.totals.input,
      output: this.totals.output,
      cached_input: this.totals.cached,
      uncached_input: this.totals.uncached,
      cache_write_input: this.totals.cache_write,
      calls: this.calls,
      cost_cents: this.cost(),
      cost_if_no_caching_cents: centsOf(this.uncached_cost_acc),
    };
  }
}

/**
 * Collects costs across all generateText calls in a run, keyed by role
 * ("agent", "customer", "tools", "done_check", "judge").
 */
export class RunCostCollector {
  /** Keyed by "role:model" so different models within one role are each
   *  priced at their own rates. */
  private trackers = new Map<string, { role: string; tracker: UsageTracker }>();
  /** Wall-clock LLM latency (ms) per role. */
  private latency_by_role = new Map<string, number>();
  /** Models seen with no price of their own, warned about once each. */
  private unpriced = new Set<string>();

  get llm_latency_ms(): number {
    return this.latency_by_role.get("agent") ?? 0;
  }

  /** Get or create the UsageTracker for a role + model pair. */
  getTracker(role: string, model: string): UsageTracker {
    const key = `${role}:${model}`;
    let entry = this.trackers.get(key);
    if (!entry) {
      entry = { role, tracker: new UsageTracker(model) };
      this.trackers.set(key, entry);
      const resolved = resolveModel(model);
      if (!resolved.matched && !this.unpriced.has(model)) {
        this.unpriced.add(model);
        console.warn(
          `⚠️  No price listed for ${model}; costing it as ${resolved.entry.model_family}`
        );
      }
    }
    return entry.tracker;
  }

  addCall(
    role: string,
    model: string,
    usages: Array<{ usage: LanguageModelUsage; serviceTier: CostServiceTier }>
  ): void {
    this.getTracker(role, model).addCall(usages);
  }

  addLlmLatency(role: string, ms: number) {
    this.latency_by_role.set(role, (this.latency_by_role.get(role) ?? 0) + ms);
  }

  totalCost(): number {
    let total = 0;
    for (const { tracker } of this.trackers.values()) total += tracker.cost();
    return Number(total.toFixed(2));
  }

  /** Usage per role, summed over the models each role used. */
  toJSON(): Record<string, UsageData> {
    const result: Record<string, UsageData> = {};
    for (const { role, tracker } of this.trackers.values()) {
      const data = tracker.toJSON();
      const existing = result[role];
      if (!existing) {
        result[role] = data;
        continue;
      }
      existing.input += data.input;
      existing.output += data.output;
      existing.cached_input += data.cached_input;
      existing.uncached_input += data.uncached_input;
      existing.cache_write_input += data.cache_write_input;
      existing.calls += data.calls;
      existing.cost_cents = Number(
        (existing.cost_cents + data.cost_cents).toFixed(2)
      );
      existing.cost_if_no_caching_cents = Number(
        (
          existing.cost_if_no_caching_cents + data.cost_if_no_caching_cents
        ).toFixed(2)
      );
    }
    return result;
  }
}

/** The price tier a response was served at, from the `service_tier` its
 *  body reports: a priority-processed request bills at the priority rates. */
function costServiceTier(body: unknown): CostServiceTier {
  if (typeof body !== "object" || body === null) return "standard";
  const tier: unknown = Reflect.get(body, "service_tier");
  return tier === "priority" || tier === "fast" ? "priority" : "standard";
}

/**
 * The AI SDK's OpenAI provider does not map `cache_write_tokens` (the paid
 * cache-write SKU gpt-5.6+ reports in `input_tokens_details`): the written
 * tokens land in `noCacheTokens` and the mapped `cacheWriteTokens` stays
 * unset — which would bill them at the plain input rate instead of the write
 * premium. Recover the split from the raw wire usage the SDK preserves on
 * each step. Usage whose provider already mapped the field (Anthropic)
 * passes through unchanged.
 */
function withRecoveredCacheWrites(
  usage: LanguageModelUsage
): LanguageModelUsage {
  const details = usage.inputTokenDetails;
  if (!details || (details.cacheWriteTokens ?? 0) > 0) return usage;
  const raw = usage.raw as
    | {
        input_tokens_details?: { cache_write_tokens?: unknown };
        prompt_tokens_details?: { cache_write_tokens?: unknown };
      }
    | undefined;
  const written =
    raw?.input_tokens_details?.cache_write_tokens ??
    raw?.prompt_tokens_details?.cache_write_tokens;
  if (typeof written !== "number" || written <= 0) return usage;
  const noCache = details.noCacheTokens ?? 0;
  const cacheWrite = Math.min(noCache, written);
  return {
    ...usage,
    inputTokenDetails: {
      ...details,
      noCacheTokens: noCache - cacheWrite,
      cacheWriteTokens: cacheWrite,
    },
  };
}

/**
 * generateText, recording the call's usage and latency in a RunCostCollector
 * under `role`. `modelName` is the bare model id the call is priced as.
 */
export async function agentGenerateText(
  role: string,
  modelName: string,
  collector: RunCostCollector,
  params: Parameters<typeof generateText>[0]
) {
  const t0 = performance.now();
  const result = await generateText(params);
  collector.addLlmLatency(role, performance.now() - t0);

  // Each step is one HTTP request, priced on its own: the response reports
  // its service tier per request, and long-context tiers apply per prompt.
  const usages =
    result.steps.length > 0
      ? result.steps.map((step) => ({
          usage: withRecoveredCacheWrites(step.usage),
          serviceTier: costServiceTier(step.response.body),
        }))
      : [
          {
            usage: withRecoveredCacheWrites(result.usage),
            serviceTier: "standard" as const,
          },
        ];
  collector.addCall(role, modelName, usages);
  return result;
}

export const _test_ = { costServiceTier, withRecoveredCacheWrites };
