import { describeAgent } from "@agent-bench/runtime/testing.js";
import { describe, expect, it } from "vitest";
import TravelAgent from "../src/index.ts";
import { FlightSearchTool, HotelSearchTool } from "../src/tools.ts";

describeAgent(TravelAgent);

describe("searches", () => {
  it("returns the same flights for the same query", () => {
    const search = new FlightSearchTool();
    const query = {
      origin: "LAX",
      destination: "LHR",
      departure_date: "2027-09-01",
      offset: 0,
    };
    expect(search.execute(query)).toEqual(search.execute(query));
  });

  it("returns the same hotels for the same query", () => {
    const search = new HotelSearchTool();
    const query = {
      location: "Orlando",
      check_in: "2025-07-20",
      check_out: "2025-07-27",
      guests: 4,
      offset: 0,
    };
    expect(search.execute(query)).toEqual(search.execute(query));
  });
});
