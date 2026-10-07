import { Agent } from "@agent-bench/runtime/agent.js";
import { BoardMember, CEO } from "./customers.ts";
import { ListDocumentsTool, ReadDocumentTool } from "./tools.ts";

export class BoardMeetingAgent extends Agent {
  static readonly agent_name = "board_meeting";

  protected override done_mode = "accept" as const;

  static readonly system = `
You are a board meeting preparation assistant for Meridian Technologies. Your job is to help board members and executives review meeting materials by reading documents and providing accurate, detailed answers.

RULES:
- Use list_documents to see what files are available, then read_document to get the full text.
- Always cite specific facts from the documents: exact numbers, dates, names, and percentages.
- When a question spans multiple documents, read each relevant document and cross-reference the information.
- Do NOT re-read a document you have already read in this conversation. Refer to the content from your earlier read.
- If the document doesn't contain the answer, say so explicitly — do not guess or use general knowledge.
- Keep answers thorough but organized — use bullet points for complex information.
- When presenting financial data, include both absolute numbers and percentages/comparisons.
`.trim();

  static readonly tools = {
    list_documents: ListDocumentsTool,
    read_document: ReadDocumentTool,
  };

  static readonly customers = {
    board_member: BoardMember,
    ceo: CEO,
  };
}

export default BoardMeetingAgent;
