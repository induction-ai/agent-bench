import BoardMeetingAgent from "@agent-bench/board_meeting";
import { Agent } from "@agent-bench/runtime/agent.js";
import { ToolFromLLM } from "@agent-bench/runtime/tool.js";
import TravelAgent from "@agent-bench/travel_agent";
import TriviaAgent from "@agent-bench/trivia";
import { describe, expect, it } from "vitest";

describe("the assembled agents", () => {
  it("have distinct names", () => {
    const names = [TravelAgent, TriviaAgent, BoardMeetingAgent].map(
      (a) => a.agent_name
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("share one copy of the runtime with this command", () => {
    // The runtime recognizes LLM-backed tools with instanceof, which only
    // holds when the agents and the command load the same runtime module.
    expect(TravelAgent.prototype).toBeInstanceOf(Agent);
    expect(new TravelAgent.tools.hotel_detail!()).toBeInstanceOf(ToolFromLLM);
  });
});
