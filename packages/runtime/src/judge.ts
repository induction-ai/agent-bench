import { Output, type ModelMessage } from "ai";
import { z } from "zod";
import { compactMessages, format_conversation } from "./conversation.ts";
import { bareModel, type Model } from "./model.ts";
import { retryWithLog } from "./retry.ts";
import { agentGenerateText, type RunCostCollector } from "./usage.ts";

const judge_criterion_schema = z.object({
  criterion: z.string().describe("The criterion text, verbatim"),
  met: z.boolean().describe("Whether the criterion was met"),
  evidence: z
    .string()
    .describe(
      "Brief quote or paraphrase of the transcript evidence. Empty if not met."
    ),
});

const judge_llm_schema = z.object({
  criteria: z
    .array(judge_criterion_schema)
    .describe("One entry per done criterion, in the same order as given"),
  efficiency: z
    .number()
    .int()
    .min(0)
    .max(2)
    .describe(
      "Efficiency bonus (only applied when all criteria met): 0 = inefficient or unremarkable, 1 = good flow, 2 = exceptional efficiency with no issues"
    ),
  reasoning: z.string().describe("1–2 sentence summary of the evaluation"),
});

export type JudgeResult = {
  success: "yes" | "partial" | "no";
  score: number;
  criteria: z.infer<typeof judge_criterion_schema>[];
  efficiency: number;
  reasoning: string;
};

// Tool results rendered into judge transcripts are evidence, not content to
// reproduce: cap each at 4000 chars (head + tail). Full-size results also
// make some transcripts exceed what a flash-sized judge will accept.
const JUDGE_TOOL_RESULT_CAP = 4000;
// The done judge runs on a large-context model; its looser cap only guards
// the context window against pathological multi-hundred-KB results.
const DONE_JUDGE_TOOL_RESULT_CAP = 24000;

const done_schema = z.object({
  done: z.boolean().describe("Whether all done criteria have been met"),
  unmetCriteria: z
    .array(z.string())
    .describe("List of criteria that are NOT yet met (empty if done)"),
  reasoning: z
    .string()
    .describe("Brief explanation of what is still needed, or why done"),
});

export type DoneResult = z.infer<typeof done_schema>;

/**
 * Check whether the done criteria have been met in the conversation.
 * Returns which criteria are still unmet so the customer can continue.
 */
export async function judge_done_criteria(
  doneCriteria: string[],
  messages: ModelMessage[],
  collector: RunCostCollector,
  judge: Model
): Promise<DoneResult> {
  const transcript = format_conversation(compactMessages(messages), {
    toolResultCap: DONE_JUDGE_TOOL_RESULT_CAP,
  });
  const criteriaList = doneCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n");

  const system = `
You are a judge checking whether a conversation has met all done criteria.

Important context:
This is a PLANNING agent, not a booking agent. "Selected" means the customer and agent agreed on a specific option (e.g. a specific flight, hotel, or activity). It does NOT require a real booking, confirmation number, or payment.

Be strict: a criterion is only met if there is clear evidence in the transcript.
`;

  const prompt = `
Done criteria (ALL must be met):
${criteriaList}

Conversation transcript:
${transcript}

For each criterion, determine if it was met (yes/no) with evidence from the transcript.
Return done=true only if ALL criteria are met. List any unmet criteria exactly as written above.
`;

  const result = await retryWithLog("Judge (done)", () =>
    // Its own cost row: the done check runs whether or not the run is
    // scored, and shouldn't read as scoring in the usage table.
    agentGenerateText("done_check", bareModel(judge.model), collector, {
      model: judge.languageModel,
      maxRetries: 0,
      output: Output.object({ schema: done_schema }),
      system,
      prompt,
      providerOptions: judge.providerOptions,
    })
  );

  return done_schema.parse(result.output);
}

/**
 * Judge whether the agent helped the customer achieve their goal.
 */
export async function judge_run(
  goal: string,
  doneCriteria: string[],
  messages: ModelMessage[],
  collector: RunCostCollector,
  judge: Model
): Promise<JudgeResult> {
  const transcript = format_conversation(compactMessages(messages), {
    toolResultCap: JUDGE_TOOL_RESULT_CAP,
  });
  const criteriaList = doneCriteria.map((c) => `- ${c}`).join("\n");

  const system = `
You are a STRICT judge evaluating whether a customer achieved their goal.

Important context:
This is a PLANNING agent, not a booking agent. "Selected" means the customer and agent agreed on a specific option (e.g. a specific flight, hotel, or activity). It does NOT require a real booking, confirmation number, or payment. A criterion like "selected a flight" is met if a specific flight was identified and the customer accepted it.

A criterion counts as met only if there is clear evidence in the transcript. If the agent gave incorrect information for a criterion, that criterion is NOT met.

Your job is to return structured data: for each done criterion, whether it was met (with evidence), plus an efficiency rating (0–2) that only applies if all criteria are met. The final numeric score is computed from this data — do not output a score yourself.

Efficiency rating:
- 0 = inefficient, redundant, or unremarkable flow
- 1 = good flow with minimal issues
- 2 = exceptional efficiency with no issues
`;

  const prompt = `
Customer goal:
${goal}

Done criteria:
${criteriaList}

Conversation transcript:
${transcript}

Return one entry per done criterion (in the same order as above), with met=true/false and brief evidence. Then rate efficiency 0–2.
`;

  const result = await retryWithLog("Judge", () =>
    agentGenerateText("judge", bareModel(judge.model), collector, {
      model: judge.languageModel,
      maxRetries: 0,
      // No temperature: reasoning models (OpenAI's, Anthropic's with
      // thinking) refuse anything but their own.
      output: Output.object({ schema: judge_llm_schema }),
      system,
      prompt,
      providerOptions: judge.providerOptions,
    })
  );

  return computeJudgeResult(judge_llm_schema.parse(result.output));
}

export function computeJudgeResult(
  output: z.infer<typeof judge_llm_schema>
): JudgeResult {
  const total = output.criteria.length;
  const met = output.criteria.filter((c) => c.met).length;
  const percent = total > 0 ? met / total : 0;
  const base = Math.max(1, Math.min(8, Math.round(1 + 7 * percent)));
  const allMet = total > 0 && met === total;
  const score = allMet ? Math.min(10, base + output.efficiency) : base;

  let success: "yes" | "partial" | "no";
  if (allMet) success = "yes";
  else if (met === 0) success = "no";
  else success = "partial";

  return {
    success,
    score,
    criteria: output.criteria,
    efficiency: output.efficiency,
    reasoning: output.reasoning,
  };
}
