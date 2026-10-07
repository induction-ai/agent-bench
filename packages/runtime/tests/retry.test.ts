import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import { retryWithLog } from "../src/retry.ts";

const apiError = (statusCode: number) =>
  new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
  });

describe("retryWithLog", () => {
  it("gives up at once on an error the provider says not to retry", async () => {
    let calls = 0;
    await expect(
      retryWithLog("Test", async () => {
        calls++;
        throw apiError(401);
      })
    ).rejects.toThrow("HTTP 401");
    expect(calls).toBe(1);
  });

  it("returns the first success", async () => {
    let calls = 0;
    const result = await retryWithLog("Test", async () => ++calls);
    expect(result).toBe(1);
  });
});
