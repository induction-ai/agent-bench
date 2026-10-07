import { describeAgent } from "@agent-bench/runtime/testing.js";
import { describe, expect, it } from "vitest";
import BoardMeetingAgent from "../src/index.ts";
import { ListDocumentsTool, ReadDocumentTool } from "../src/tools.ts";

describeAgent(BoardMeetingAgent);

describe("documents", () => {
  it("lists every shipped document", () => {
    const { documents } = new ListDocumentsTool().execute();
    const names = documents.map((d) => d.name);
    expect(names).toContain("financial_summary_q2_2026.md");
    expect(names).toHaveLength(13);
  });

  it("reads a document by name and refuses an unknown one", () => {
    const read = new ReadDocumentTool();
    expect(read.execute({ name: "q2_2026_board_minutes.md" })).toMatchObject({
      content: expect.stringContaining("Atlas 4.0"),
    });
    expect(read.execute({ name: "nope.md" })).toHaveProperty("error");
  });
});
