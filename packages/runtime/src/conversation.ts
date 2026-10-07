import type {
  AssistantModelMessage,
  ModelMessage,
  ToolModelMessage,
  ToolResultPart,
  UserModelMessage,
} from "ai";

/** `ModelMessage["content"]` when it is an array (per role), not a string. */
type NonStringModelContent =
  | Exclude<AssistantModelMessage["content"], string>
  | Exclude<UserModelMessage["content"], string>
  | ToolModelMessage["content"];

/** Any part that can appear in a model message whose `content` is an array. */
type ModelMessageArrayPart = NonStringModelContent extends readonly (infer P)[]
  ? P
  : never;

function isToolResultPart(part: ModelMessageArrayPart): part is ToolResultPart {
  return part.type === "tool-result";
}

function isModelMessageArrayContent(
  content: ModelMessage["content"]
): content is NonStringModelContent {
  return Array.isArray(content);
}

/**
 * Returns a shallow copy of messages with large tool results truncated and
 * Gemini thought signatures stripped. Tool-specific rules (e.g. Wikipedia
 * HTML) live in `compactToolResult`.
 */
export function compactMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((msg) => {
    if (!isModelMessageArrayContent(msg.content)) return msg;
    const parts = msg.content;

    let changed = false;
    const compacted = parts.map((part) => {
      let next = stripThoughtSignature(part);
      if (isToolResultPart(next)) next = compactToolResult(next);
      if (next !== part) changed = true;
      return next;
    });
    if (!changed) return msg;
    // Spread loses the discriminated union — assert back to the original type.
    return { ...msg, content: compacted } as typeof msg;
  });
}

// Signatures are scoped to the originating request's thinking chain; they
// don't validate when replayed in a fresh conversation (the customer's, the
// judge's, or an LLM-backed tool's). Dropping the field is a no-op for
// providers that don't read it.
function stripThoughtSignature(
  part: ModelMessageArrayPart
): ModelMessageArrayPart {
  if (!("providerOptions" in part)) return part;
  const providerOptions = part.providerOptions;
  if (!providerOptions) return part;
  let changed = false;
  const next: typeof providerOptions = {};
  for (const [providerKey, providerValue] of Object.entries(providerOptions)) {
    if (
      providerValue &&
      typeof providerValue === "object" &&
      "thoughtSignature" in providerValue
    ) {
      const { thoughtSignature: _ts, ...rest } = providerValue;
      next[providerKey] = rest;
      changed = true;
    } else {
      next[providerKey] = providerValue;
    }
  }
  if (!changed) return part;
  return { ...part, providerOptions: next };
}

function toolResultOutputForStringify(
  output: ToolResultPart["output"]
): unknown {
  switch (output.type) {
    case "text":
    case "error-text":
      return output.value;
    case "json":
    case "error-json":
      return output.value;
    case "execution-denied":
      return { type: "execution-denied", reason: output.reason };
    case "content":
      return output.value;
    default:
      return output;
  }
}

type JsonToolResultValue = Extract<
  ToolResultPart["output"],
  { type: "json" }
>["value"];

/** Truncate `html` in JSON tool output when present (Wikipedia article bodies). */
function compactWikipediaHtmlInJson(
  value: JsonToolResultValue
): JsonToolResultValue {
  const maxHtmlChars = 200;
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("text" in value)
  ) {
    return value;
  }
  const text = value.text;
  if (typeof text !== "string" || text.length <= maxHtmlChars) {
    return value;
  }
  return { ...value, text: `${text.slice(0, maxHtmlChars)}… [truncated]` };
}

function compactToolResult(part: ToolResultPart): ToolResultPart {
  switch (part.toolName) {
    case "wikipedia_article": {
      if (part.output.type !== "json") return part;
      const nextValue = compactWikipediaHtmlInJson(part.output.value);
      if (nextValue === part.output.value) return part;
      return {
        ...part,
        output: { ...part.output, value: nextValue },
      };
    }
    default:
      return part;
  }
}

/**
 * Drop middle turns to reduce context size. Splits on "user" message
 * boundaries so we never orphan a tool result from its tool call.
 * Keeps the first turn and the last ~half of turns.
 * Returns a new array, or null if nothing could be safely dropped.
 */
export function compactThread(messages: ModelMessage[]): ModelMessage[] | null {
  // Find safe split points (the index of each "user" message).
  const turnStarts: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]!.role === "user") turnStarts.push(i);
  }
  if (turnStarts.length < 3) return null; // need at least 3 turns to drop anything

  // Keep first turn, drop middle, keep last ~half.
  const keepTurns = Math.max(1, Math.ceil(turnStarts.length / 2));
  const dropAfterIdx = 1; // index into turnStarts: keep first turn
  const keepFromIdx = turnStarts.length - keepTurns;
  if (keepFromIdx <= dropAfterIdx) return null;

  const dropStart = turnStarts[dropAfterIdx]!;
  const dropEnd = turnStarts[keepFromIdx]!;
  return [...messages.slice(0, dropStart), ...messages.slice(dropEnd)];
}

export function format_conversation(
  messages: ModelMessage[],
  options?: {
    excludeToolResults?: boolean;
    truncateToolResults?: boolean;
    /** Cap each rendered tool result at this many chars, keeping the head
     *  and the tail — outcome evidence often sits at the end of a large
     *  result. */
    toolResultCap?: number;
  }
): string {
  const transcript = messages
    .map((m) => {
      let text: string;
      if (typeof m.content === "string") {
        text = m.content;
      } else if (isModelMessageArrayContent(m.content)) {
        const parts = m.content;
        text = parts
          .map((part) => {
            if (part.type === "text") return part.text;
            if (options?.excludeToolResults) return undefined;
            if (part.type === "tool-call")
              return `[Tool call: ${part.toolName}(${JSON.stringify(part.input)})]`;
            if (isToolResultPart(part)) {
              const json = JSON.stringify(
                toolResultOutputForStringify(part.output)
              );
              let preview = json;
              const cap = options?.toolResultCap;
              if (cap && preview.length > cap) {
                const head = Math.floor(cap * 0.75);
                const tail = cap - head;
                preview = `${preview.slice(0, head)} …[${json.length - cap} chars truncated]… ${preview.slice(-tail)}`;
              } else if (options?.truncateToolResults && preview.length > 500) {
                preview = `${preview.slice(0, 500)}...`;
              }
              return `[Tool result: ${part.toolName} → ${preview}]`;
            }
            return JSON.stringify(part);
          })
          .filter((t) => !!t)
          .join("\n");
      } else {
        text = JSON.stringify(m.content);
      }
      return `[${m.role}]: ${text}`;
    })
    .join("\n\n");
  return transcript;
}
