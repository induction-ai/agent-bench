import {
  fallbackDelay,
  getRetryDelay,
  jitter,
  MAX_RETRY_DELAY_MS,
  sleep,
} from "@agent-bench/runtime/retry.js";

// Wikimedia asks API clients to identify themselves:
// https://meta.wikimedia.org/wiki/User-Agent_policy
const USER_AGENT = "agent-bench/0.1 (benchmark tool; fetch wikipedia articles)";

const RETRIES = 3;

/**
 * GET a Wikipedia API URL, retrying rate limits (429) and server errors with
 * the delay the response asks for. Wikipedia throttles bursts of tool calls,
 * and a benchmark score should not depend on whether it did. The last
 * response is returned either way; callers report a non-OK one to the agent.
 */
export async function wikipediaFetch(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt > RETRIES) return response;
    const delay = jitter(
      Math.min(
        getRetryDelay(response.headers) ?? fallbackDelay(attempt),
        MAX_RETRY_DELAY_MS
      )
    );
    console.log(
      `⏳ Wikipedia answered ${response.status}; retrying in ${Math.round(delay / 1000)}s (${attempt}/${RETRIES})`
    );
    await sleep(delay);
  }
}
