/**
 * Renders a run's results.json as a single self-contained results.html (no
 * scripts, no external assets, readable straight off disk) from the Liquid
 * template results.liquid beside this file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelMessage } from "ai";
import { Liquid } from "liquidjs";
import type { JudgeResult } from "./judge.ts";
import type { UsageData } from "./usage.ts";

/** Contents of results.json written for each run. */
export type RunResultRecord = {
  run_id: string;
  timestamp: string;
  git_sha: string | null;
  git_url: string | null;
  agent: string;
  provider: string;
  /** The model spec as run, reasoning level included (`gpt-5.5@high`). */
  model: string;
  customer: string | null;
  /** The models behind the customer and judges, as `provider/model`. */
  support_models: Record<string, string>;
  score: number | null;
  reasoning: string | null;
  /** The judge's per-criterion verdicts, when the run was judged. */
  judge: JudgeResult | null;
  error: string | null;
  /** The agent's own usage. */
  usage: UsageData;
  /** Total cost of the run in cents, every role included. */
  cost: number;
  /** Usage by role (agent, customer, tools, done_check, judge). */
  costs: Record<string, UsageData>;
  messages: ModelMessage[];
  customer_turns: number;
  client_turns: number;
  llm_latency_ms: number;
};

function formatCents(cents: number): string {
  if (cents < 1) return `${cents.toFixed(2)}¢`;
  if (cents < 100) return `${cents.toFixed(1)}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

/** A tool call's input or a tool result's output, as display text. Strings
 *  that hold JSON are pretty-printed. */
function payloadText(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        // not JSON after all
      }
    }
    return value;
  }
  return JSON.stringify(value, null, 2) ?? "";
}

function toolOutputValue(output: unknown): unknown {
  if (typeof output !== "object" || output === null) return output;
  const o = output as { type?: unknown; value?: unknown; reason?: unknown };
  switch (o.type) {
    case "text":
    case "error-text":
    case "json":
    case "error-json":
    case "content":
      return o.value;
    case "execution-denied":
      return { type: "execution-denied", reason: o.reason };
    default:
      return output;
  }
}

/** Payloads up to this many characters start expanded. */
const INLINE_CHARS = 1500;

/** One part of a message, as the template draws it. */
type PartView =
  | { kind: "text" | "reasoning"; text: string }
  | {
      kind: "call" | "result";
      tool: string;
      text: string;
      summary: string;
      open: boolean;
    }
  | { kind: "omitted"; type: string };

function payloadView(
  kind: "call" | "result",
  tool: unknown,
  value: unknown
): PartView {
  const text = payloadText(value);
  const lines = text.split("\n").length;
  return {
    kind,
    tool: String(tool),
    text,
    summary: `${formatNumber(lines)} ${lines === 1 ? "line" : "lines"} · ${formatNumber(text.length)} chars`,
    open: text.length <= INLINE_CHARS,
  };
}

function partView(part: unknown): PartView | null {
  if (typeof part !== "object" || part === null) return null;
  const p = part as Record<string, unknown>;
  switch (p.type) {
    case "text":
    case "reasoning":
      return typeof p.text === "string" && p.text.trim()
        ? { kind: p.type, text: p.text }
        : null;
    case "tool-call":
      return payloadView("call", p.toolName, p.input);
    case "tool-result":
      return payloadView("result", p.toolName, toolOutputValue(p.output));
    default:
      return { kind: "omitted", type: String(p.type) };
  }
}

const ROLE_LABELS: Record<string, string> = {
  user: "Customer",
  assistant: "Agent",
  tool: "Tools",
  system: "System",
};

function prepareMessages(messages: ModelMessage[]) {
  return messages.map((msg) => ({
    role: msg.role,
    label: ROLE_LABELS[msg.role] ?? msg.role,
    parts:
      typeof msg.content === "string"
        ? [{ kind: "text", text: msg.content }]
        : msg.content.map(partView).filter((p): p is PartView => p !== null),
  }));
}

const liquid = new Liquid({
  root: path.dirname(fileURLToPath(import.meta.url)),
  extname: ".liquid",
  // Transcripts are arbitrary model and tool text: escape every output.
  outputEscape: "escape",
  cache: true,
});
liquid.registerFilter("format_cost", formatCents);
liquid.registerFilter("format_number", formatNumber);
liquid.registerFilter("format_latency", formatLatency);
liquid.registerFilter("datetime", (iso: string) =>
  new Date(iso).toLocaleString("en-US")
);

export async function renderResultsHtml(
  data: RunResultRecord
): Promise<string> {
  return liquid.renderFile("results", {
    ...data,
    title: `${data.agent} / ${data.customer ?? "human"}`,
    support: Object.entries(data.support_models).map(([role, model]) => ({
      role,
      model,
    })),
    usage_rows: Object.entries(data.costs).map(([role, usage]) => ({
      role,
      ...usage,
    })),
    messages: prepareMessages(data.messages),
  }) as Promise<string>;
}

export async function writeResultsHtml(
  dir_path: string,
  data: RunResultRecord
): Promise<void> {
  fs.writeFileSync(
    path.join(dir_path, "results.html"),
    await renderResultsHtml(data)
  );
}
