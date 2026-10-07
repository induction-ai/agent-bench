import { tool, type ModelMessage } from "ai";
import { z } from "zod";
import { bareModel, type Model } from "./model.ts";
import { retryWithLog } from "./retry.ts";
import { agentGenerateText, type RunCostCollector } from "./usage.ts";

const criterion_result = z.object({
  reasoning: z.string(),
  state: z.enum(["met", "unmet"]),
});

type CriterionResult = z.infer<typeof criterion_result>;

function make_done_tool(doneCriteria: string[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  doneCriteria.forEach((criterion, i) => {
    shape[`criterion_${i + 1}`] = criterion_result.describe(criterion);
  });
  return tool({
    description:
      "End the conversation. Call this once the agent has addressed your main needs. Mark a criterion met if a reasonable selection was provided, even if minor details are pending.",
    inputSchema: z.object(shape),
  });
}

/** Number of turns to suppress the done tool after a judge rejection. */
const DONE_COOLDOWN = 2;

export type CustomerOptions = {
  /** The model that plays the customer. */
  model: Model;
};

export type CustomerClass = new (opts: CustomerOptions) => Customer;

export abstract class Customer {
  abstract readonly name: string;
  abstract readonly goal: string;
  abstract readonly doneCriteria: string[];
  abstract readonly system: string;
  readonly targetTurns: number = 10;
  /** When set, used verbatim as the customer's first message instead of generating one via the LLM. */
  readonly initialMessage?: string;
  protected turn_number = 0;

  private messages: ModelMessage[] = [];
  /** Saved after a done call so rejectDone() can add a matching tool result. */
  private lastDoneCallId?: string;
  private doneBlockedForTurns = 0;
  private llm: Model;
  costs!: RunCostCollector;

  private get includeDone() {
    const minTurn = Math.ceil(this.targetTurns / 2.0);
    return this.doneBlockedForTurns <= 0 && this.turn_number >= minTurn;
  }

  constructor(opts: CustomerOptions) {
    this.llm = opts.model;
  }

  system_message() {
    let msg = (this.system || "") + `\n\nYour goal: ${this.goal}`;
    msg += `\n\nDone criteria:`;
    msg += `\n${this.doneCriteria.map((c) => `- ${c}`).join("\n")}`;
    msg += `\n\nAim for about ${this.targetTurns} turns.`;
    if (this.includeDone) {
      msg += ` You MUST call the done tool to end the conversation — never just say "all set" or "we're done" in text. Call the done tool once the agent has addressed your main needs. Don't wait for perfection — call done when reasonable selections have been made.`;
    }
    msg += `\n\nIMPORTANT: You are in a turn-based conversation. Produce ONLY your single next message — one short reply, then stop. Do NOT script multiple turns or simulate the agent's responses. Wait for the agent to actually reply before continuing.`;
    return msg;
  }

  /**
   * Record a done-tool rejection in the customer's history as a tool result
   * and suppress the done tool for a few turns so the customer continues.
   */
  rejectDone(reason: string) {
    if (!this.lastDoneCallId) return;
    this.messages.push({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: this.lastDoneCallId,
          toolName: "done",
          output: { type: "text", value: reason },
        },
      ],
    });
    this.lastDoneCallId = undefined;
    this.doneBlockedForTurns = DONE_COOLDOWN;
  }

  async generate(
    agentReply?: string
  ): Promise<{ message: string; done: boolean }> {
    this.turn_number++;
    if (this.doneBlockedForTurns > 0) this.doneBlockedForTurns--;

    const turnSuffix = `\n\n[Current turn: ${this.turn_number}]`;
    if (agentReply) {
      this.messages.push({ role: "user", content: agentReply + turnSuffix });
    } else if (this.messages.length === 0) {
      // First turn: use initialMessage if provided instead of calling the LLM
      if (this.initialMessage) {
        this.messages.push({
          role: "user",
          content: "How can I help you?" + turnSuffix,
        });
        const text = this.initialMessage;
        this.messages.push({ role: "assistant", content: text });
        return { message: text, done: false };
      }
      this.messages.push({
        role: "user",
        content: "How can I help you?" + turnSuffix,
      });
    }

    const tools = this.includeDone
      ? { done: make_done_tool(this.doneCriteria) }
      : undefined;

    // The customer's own thread, sent as is: it holds no tool output to trim,
    // and Gemini 3 needs the thought signatures on its earlier done calls.
    const messages = this.messages;

    const result = await retryWithLog("Customer", () =>
      agentGenerateText("customer", bareModel(this.llm.model), this.costs, {
        model: this.llm.languageModel,
        maxRetries: 0,
        system: this.system_message(),
        messages,
        tools,
        providerOptions: this.llm.providerOptions,
      })
    );

    // Detect done call — skip on first turn
    const doneCall =
      this.includeDone && agentReply !== undefined
        ? result.steps[0]?.toolCalls.find((tc) => tc.toolName === "done")
        : undefined;

    if (doneCall) {
      // Push the full response messages (includes assistant message with tool call)
      this.messages.push(...result.responseMessages);

      const input = doneCall.input as Record<string, CriterionResult>;
      const unmetCriteria = this.doneCriteria.filter((_, i) => {
        const check = input[`criterion_${i + 1}`];
        return !check || check.state === "unmet";
      });

      if (unmetCriteria.length > 0) {
        // Customer itself admits criteria are unmet — reject via tool result
        this.messages.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: doneCall.toolCallId,
              toolName: "done",
              output: {
                type: "text",
                value: `Not done. Unmet criteria:\n${unmetCriteria.map((c) => `- ${c}`).join("\n")}`,
              },
            },
          ],
        });
        const feedback =
          `Actually, I still need help with:\n` +
          unmetCriteria.map((c) => `- ${c}`).join("\n");
        return { message: feedback, done: false };
      }

      // All criteria met per customer — save call ID for potential judge rejection
      this.lastDoneCallId = doneCall.toolCallId;
      const text = result.text || "Thanks, that covers everything!";
      return { message: text, done: true };
    }

    const text = result.text || "Let's keep going.";
    this.messages.push({ role: "assistant", content: text });
    return { message: text, done: false };
  }
}
