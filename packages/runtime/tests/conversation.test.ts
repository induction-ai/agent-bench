import type { JSONValue, ModelMessage } from "ai";
import { describe, expect, it } from "vitest";
import { format_conversation } from "../src/conversation.ts";

function toolMessage(value: JSONValue): ModelMessage {
  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId: "call_1",
        toolName: "KB_search",
        output: { type: "json", value },
      },
    ],
  };
}

describe("format_conversation", () => {
  it("caps a large tool result at toolResultCap keeping its head and tail", () => {
    const value = { text: "a".repeat(9000), verdict: "APPROVED" };
    const rendered = format_conversation([toolMessage(value)], {
      toolResultCap: 4000,
    });
    expect(rendered.length).toBeLessThan(4200);
    expect(rendered).toContain('{"text":"aaa');
    expect(rendered).toContain("chars truncated");
    expect(rendered).toContain('APPROVED"}');
  });

  it("renders a small tool result in full when toolResultCap is set", () => {
    const rendered = format_conversation([toolMessage({ balance: 42 })], {
      toolResultCap: 4000,
    });
    expect(rendered).toContain('{"balance":42}');
    expect(rendered).not.toContain("truncated");
  });
});
