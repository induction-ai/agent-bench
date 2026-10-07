/** Checks for an agent's own test suite: `describeAgent(MyAgent)`. */
import { describe, expect, it } from "vitest";
import type { Agent } from "./agent.ts";
import type { Model } from "./model.ts";

/**
 * The checks every agent should pass, without calling a model: it has a
 * system prompt and tools, and each customer constructs, names itself after
 * its key, and states a goal and done criteria.
 */
export function describeAgent(AgentClass: typeof Agent) {
  describe(`${AgentClass.agent_name} definition`, () => {
    it("has a system prompt and tools", () => {
      expect(AgentClass.system.trim()).not.toBe("");
      expect(Object.keys(AgentClass.tools).length).toBeGreaterThan(0);
    });

    it("has customers named after their keys, each with a goal and done criteria", () => {
      // Customers only touch their model when they generate.
      const model = {} as Model;
      expect(Object.keys(AgentClass.customers).length).toBeGreaterThan(0);
      for (const [key, Cls] of Object.entries(AgentClass.customers)) {
        const customer = new Cls({ model });
        expect(customer.name, key).toBe(key);
        expect(customer.goal.trim(), key).not.toBe("");
        expect(customer.doneCriteria.length, key).toBeGreaterThan(0);
      }
    });
  });
}
