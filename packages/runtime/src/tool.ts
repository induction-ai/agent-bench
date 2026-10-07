import { Output, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { compactMessages } from "./conversation.ts";
import { bareModel, type Model } from "./model.ts";
import { retryWithLog } from "./retry.ts";
import { agentGenerateText, type RunCostCollector } from "./usage.ts";

/** What a tool can see of the run it is part of. The agent refreshes it
 *  before every turn. */
export type ToolContext = {
  /** The conversation so far, so an LLM-backed tool can stay consistent
   *  with the previous conversation and results. */
  messages: ModelMessage[];
  costs: RunCostCollector;
  /** The model LLM-backed tools answer with. */
  model: Model;
  /** True when a simulated customer drives the run (no human watching), so
   *  tools can trim output that only a human would read. */
  automated: boolean;
};

export abstract class ToolBase<INPUT extends z.ZodType> {
  abstract readonly description: string;
  abstract readonly inputSchema: INPUT;
  context!: ToolContext;

  abstract execute(input: z.infer<INPUT>): unknown;

  tool() {
    return tool({
      description: this.description,
      inputSchema: this.inputSchema,
      execute: (input: z.infer<INPUT>) => this.execute(input),
    });
  }
}

/** A tool whose result an LLM invents, shaped by `outputSchema` — for
 *  simulated backends that would be tedious to write by hand. */
export abstract class ToolFromLLM<
  INPUT extends z.ZodType,
  OUTPUT extends z.ZodType,
> extends ToolBase<INPUT> {
  abstract readonly outputSchema: OUTPUT;
  abstract readonly system: string;

  abstract prompt(input: z.infer<INPUT>): string;

  system_message() {
    const instructions =
      "You MUST stay consistent with the previous conversation and results.";
    return `${this.system}\n\n${instructions}`;
  }

  async execute(input: z.infer<INPUT>): Promise<z.infer<OUTPUT>> {
    const { model, costs, messages } = this.context;
    const result = await retryWithLog("ToolFromLLM", () =>
      agentGenerateText("tools", bareModel(model.model), costs, {
        model: model.languageModel,
        maxRetries: 0,
        output: Output.object({ schema: this.outputSchema }),
        system: this.system_message(),
        messages: [
          ...compactMessages(messages),
          { role: "user" as const, content: this.prompt(input) },
        ],
        providerOptions: model.providerOptions,
      })
    );
    return this.outputSchema.parse(result.output) as z.infer<OUTPUT>;
  }
}

const CacheBusterNeverCallSchema = z.object({});

// A dummy tool with a randomized name, used to bust the prompt cache
// between agent runs and prevent contamination across sessions.
export class CacheBusterNeverCallTool extends ToolBase<
  typeof CacheBusterNeverCallSchema
> {
  readonly description = "Never call this tool.";
  readonly inputSchema = CacheBusterNeverCallSchema;

  execute() {
    return { success: true };
  }
}
