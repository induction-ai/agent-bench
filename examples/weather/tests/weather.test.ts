import { describeAgent } from "@agent-bench/runtime/testing.js";
import { describe, expect, it } from "vitest";
import WeatherAgent, { ForecastTool } from "../agent.ts";

describeAgent(WeatherAgent);

describe("get_forecast", () => {
  it("forecasts the same weather for the same city and date", () => {
    const tool = new ForecastTool();
    const query = { city: "Lisbon", date: "2027-05-15" };
    expect(tool.execute(query)).toEqual(tool.execute(query));
  });
});
