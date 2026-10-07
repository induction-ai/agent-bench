import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4GenerateResult,
} from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { _test_, Agent, generate_run_id } from "../src/agent.ts";
import { Customer } from "../src/customer.ts";
import type { Model } from "../src/model.ts";
import { ToolBase } from "../src/tool.ts";

const { customerTurnLimit } = _test_;

describe("customerTurnLimit", () => {
  it("allows at least seven customer turns", () => {
    expect(customerTurnLimit(1)).toBe(7);
    expect(customerTurnLimit(3)).toBe(7);
  });

  it("allows twice the expected turns for longer conversations", () => {
    expect(customerTurnLimit(4)).toBe(8);
    expect(customerTurnLimit(10)).toBe(20);
  });
});

describe("generate_run_id", () => {
  it("leads with the start time so run directories sort by it", () => {
    const id = generate_run_id(new Date(2026, 9, 6, 15, 30, 12));
    expect(id).toMatch(/^r_20261006_153012_[0-9a-f]{6}$/);
  });
});

// --- A whole run against mock models ---

function reply(
  content: LanguageModelV4Content[]
): LanguageModelV4GenerateResult {
  const toolCall = content.some((c) => c.type === "tool-call");
  return {
    content,
    finishReason: {
      unified: toolCall ? "tool-calls" : "stop",
      raw: undefined,
    },
    usage: {
      inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 100, text: 100, reasoning: 0 },
    },
    warnings: [],
  };
}

const text = (t: string) => reply([{ type: "text", text: t }]);
const json = (value: unknown) => text(JSON.stringify(value));
const call = (toolName: string, input: unknown) =>
  reply([
    {
      type: "tool-call",
      toolCallId: `call_${toolName}_${Math.random().toString(36).slice(2)}`,
      toolName,
      input: JSON.stringify(input),
    },
  ]);

function mockModel(
  doGenerate: (
    opts: LanguageModelV4CallOptions
  ) => LanguageModelV4GenerateResult
): Model {
  return {
    languageModel: new MockLanguageModelV4({
      doGenerate: async (opts) => doGenerate(opts),
    }),
    provider: "completions",
    model: "gpt-5.4-mini@medium",
    providerOptions: {},
  };
}

/** The agent looks the answer up on its first turn, then answers. */
function agentModel() {
  return mockModel((opts) => {
    const last = opts.prompt[opts.prompt.length - 1];
    return last?.role === "tool"
      ? text("The answer is 42.")
      : call("lookup", { question: "the answer" });
  });
}

/** The customer calls done whenever the done tool is offered. */
function customerModel() {
  return mockModel((opts) =>
    opts.tools?.some((t) => t.name === "done")
      ? call("done", { criterion_1: { reasoning: "said 42", state: "met" } })
      : text("Can you check that again?")
  );
}

const CRITERION = "The agent stated that the answer is 42";

/** The judge: it gates the customer's done, rejecting the first
 *  `rejections` dones, and scores the run. */
function judgeModel(rejections = 0) {
  let dones = 0;
  return mockModel((opts) => {
    if (
      JSON.stringify(opts.prompt).includes("Done criteria (ALL must be met)")
    ) {
      return dones++ < rejections
        ? json({
            done: false,
            unmetCriteria: [CRITERION],
            reasoning: "Not yet",
          })
        : json({ done: true, unmetCriteria: [], reasoning: "All met" });
    }
    return json({
      criteria: [{ criterion: CRITERION, met: true, evidence: "“42”" }],
      efficiency: 2,
      reasoning: "Answered correctly.",
    });
  });
}

const lookupSchema = z.object({ question: z.string() });
class LookupTool extends ToolBase<typeof lookupSchema> {
  readonly description = "Look up an answer";
  readonly inputSchema = lookupSchema;
  execute() {
    return { answer: 42, automated: this.context.automated };
  }
}

class Asker extends Customer {
  readonly name = "asker";
  readonly targetTurns = 2;
  readonly goal = "Learn the answer.";
  readonly doneCriteria = [CRITERION];
  readonly initialMessage = "What is the answer?";
  readonly system = "You want to know the answer.";
}

class AnswerAgent extends Agent {
  static readonly agent_name = "answer";
  static readonly system = "Answer questions using the lookup tool.";
  static readonly tools = { lookup: LookupTool };
  static readonly customers = { asker: Asker };
}

describe("a simulated run", () => {
  let logDir: string;
  beforeEach(() => {
    logDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-bench-test-"));
  });
  afterEach(() => {
    fs.rmSync(logDir, { recursive: true, force: true });
  });

  function makeAgent(customer: Model, judge: Model = judgeModel()) {
    return new AnswerAgent({
      model: agentModel(),
      support: { customer, tool: customer, judge },
      log_dir: logDir,
      customer: new Asker({ model: customer }),
    });
  }

  it("runs tools, ends on an accepted done, and scores the transcript", async () => {
    const result = await makeAgent(customerModel()).run({
      judge: true,
      quiet: true,
    });

    expect(result.error).toBeNull();
    // All criteria met (base 8) plus the efficiency bonus.
    expect(result.score).toBe(10);
    expect(result.judge?.criteria[0]?.met).toBe(true);
    expect(result.customer_turns).toBe(1);
    expect(result.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
    // The tool ran with its run context in place on the very first turn.
    expect(JSON.stringify(result.messages[2])).toContain('"automated":true');
    // The done check and the scoring each get their own row.
    expect(Object.keys(result.costs).sort()).toEqual([
      "agent",
      "customer",
      "done_check",
      "judge",
    ]);
    expect(result.cost).toBeGreaterThan(0);

    const dir = path.join(logDir, result.run_id);
    for (const file of [
      "input.json",
      "results.json",
      "results.html",
      "agent_log.txt",
    ]) {
      expect(fs.existsSync(path.join(dir, file)), file).toBe(true);
    }
    const saved = JSON.parse(
      fs.readFileSync(path.join(dir, "results.json"), "utf8")
    ) as { score: number; results_json?: string };
    expect(saved.score).toBe(10);
    expect(saved.results_json).toBeUndefined();

    // The supporting models are pinned for a rerun, as resolved.
    const input = JSON.parse(
      fs.readFileSync(path.join(dir, "input.json"), "utf8")
    ) as { support: unknown };
    const mock = { provider: "completions", model: "gpt-5.4-mini@medium" };
    expect(input.support).toEqual({ customer: mock, judge: mock });
  });

  it("keeps the conversation going when the done judge rejects a done", async () => {
    const result = await makeAgent(customerModel(), judgeModel(1)).run({
      quiet: true,
    });

    expect(result.error).toBeNull();
    // The rejected done is replaced by a follow-up turn, and the done tool
    // is withheld until the cooldown passes.
    expect(result.customer_turns).toBe(2);
    expect(result.messages[2 + 2]).toMatchObject({
      role: "user",
      content: "Can you check that again?",
    });
    expect(result.score).toBeNull();
  });

  it("stops at the turn limit when the customer never finishes", async () => {
    const neverDone = mockModel(() => text("Tell me more."));
    const result = await makeAgent(neverDone).run({ quiet: true });

    expect(result.error).toBe("Turn limit reached");
    expect(result.customer_turns).toBe(customerTurnLimit(2));
  });
});
