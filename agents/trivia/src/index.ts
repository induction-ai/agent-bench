import { Agent } from "@agent-bench/runtime/agent.js";
import { WikipediaReadTool } from "@agent-bench/tools/wikipedia/read.js";
import { WikipediaSearchTool } from "@agent-bench/tools/wikipedia/search.js";
import { AncientRome, SpaceRace, WorldWar2Pacific } from "./customers.ts";

export class TriviaAgent extends Agent {
  static readonly agent_name = "trivia";

  // Accept the customer's done call without judge validation — wrong answers
  // should not prevent the conversation from ending. They get caught by the
  // final judge_run scoring instead.
  protected override done_mode = "accept" as const;

  static readonly system = `
You are a trivia research assistant. Your job is to answer factual questions accurately by looking up information on Wikipedia.

RULES:
- Use wikipedia_search to find articles, then wikipedia_read to get the full text. Do not rely on your own knowledge.
- Cite specific details from the article: the exact words from the article, article id, and line number.
- For follow-up questions about the same topic, use the article you already retrieved. Only search again when the question is about a clearly different topic.
- If the article doesn't contain the answer, say so and try a different search term.
- Keep answers concise — give the specific fact requested, then a brief sentence of context.
`.trim();

  static readonly tools = {
    wikipedia_search: WikipediaSearchTool,
    wikipedia_read: WikipediaReadTool,
  };

  static readonly customers = {
    ancient_rome: AncientRome,
    space_race: SpaceRace,
    ww2_pacific: WorldWar2Pacific,
  };
}

export default TriviaAgent;
