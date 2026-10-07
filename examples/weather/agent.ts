/**
 * A complete agent defined outside agents/: one tool, one customer, and the
 * agent that ties them together.
 */
import { Agent } from "@agent-bench/runtime/agent.js";
import { Customer } from "@agent-bench/runtime/customer.js";
import { ToolBase } from "@agent-bench/runtime/tool.js";
import { z } from "zod";

const forecastSchema = z.object({
  city: z.string().describe("City name, e.g. Lisbon"),
  date: z.string().describe("Date to forecast (YYYY-MM-DD)"),
});

const CONDITIONS = [
  "sunny",
  "partly cloudy",
  "overcast",
  "light rain",
  "storms",
];

/** A made-up forecast that is the same every time for the same city and
 *  date, so runs are repeatable. */
export class ForecastTool extends ToolBase<typeof forecastSchema> {
  readonly description = "Get the weather forecast for a city on a date";
  readonly inputSchema = forecastSchema;

  execute({ city, date }: z.infer<typeof forecastSchema>) {
    let hash = 0;
    for (const ch of `${city.toLowerCase()}|${date}`) {
      hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    }
    return {
      city,
      date,
      conditions: CONDITIONS[hash % CONDITIONS.length],
      high_c: 14 + (hash % 15),
      low_c: 6 + (hash % 8),
      chance_of_rain_pct: (hash >> 4) % 101,
    };
  }
}

export class Picnicker extends Customer {
  readonly name = "picnicker";
  readonly targetTurns = 4;
  readonly initialMessage =
    "I'm thinking of a picnic in Lisbon on 2027-05-15. What's the weather looking like?";
  readonly goal = "Decide whether to hold a picnic in Lisbon on 2027-05-15.";
  readonly doneCriteria = [
    "The agent reported the forecast for Lisbon on 2027-05-15",
    "The agent gave a clear recommendation on whether to picnic",
  ];
  readonly system = `
You are planning a picnic in Lisbon on 2027-05-15 with a few friends.
Ask about the weather, then ask whether you should go ahead or pick another day.
Keep each message to one or two sentences.
`.trim();
}

export default class WeatherAgent extends Agent {
  static readonly agent_name = "weather";
  static readonly system = `
You are a weather assistant. Use get_forecast for any question about the
weather; never guess. Give the forecast in one or two sentences, then answer
what was asked.
`.trim();
  static readonly tools = { get_forecast: ForecastTool };
  static readonly customers = { picnicker: Picnicker };

  // The customer's own done call ends the run; the --judge score still
  // checks its criteria afterwards.
  protected override done_mode = "accept" as const;
}
