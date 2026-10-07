import { APICallError } from "ai";

/** Retries after the first attempt, for the customer, judge and LLM-backed
 *  tool calls (the agent's own turn has its own loop in agent.ts). */
const RETRY_ATTEMPTS = 3;
export const MIN_RETRY_DELAY_MS = 1_000;
export const MAX_RETRY_DELAY_MS = 120_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Add ±25% random jitter to a delay value. */
export function jitter(ms: number): number {
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

/** Exponential backoff: 2s, 4s, 8s, … capped at MAX_RETRY_DELAY_MS. */
export function fallbackDelay(attempt: number): number {
  return Math.min(2 ** attempt * 1_000, MAX_RETRY_DELAY_MS);
}

function clampDelay(ms: number): number {
  return Math.max(MIN_RETRY_DELAY_MS, Math.min(ms, MAX_RETRY_DELAY_MS));
}

/** Check whether an error is a 429 rate-limit response. */
export function is429(err: unknown): err is APICallError {
  return APICallError.isInstance(err) && err.statusCode === 429;
}

/**
 * Substrings that identify a context-overflow ("prompt too long") 400 across
 * providers. Matched case-insensitively against the error message and response
 * body. A bare 400 is NOT one of these — invalid params, malformed tool schemas,
 * bad content blocks, and oversized individual fields all return 400 too, and
 * compacting the thread does nothing for them.
 */
const CONTEXT_OVERFLOW_SIGNATURES = [
  "prompt is too long", // Anthropic: "prompt is too long: N tokens > 200000 maximum"
  "context length", // OpenAI: "This model's maximum context length is N tokens..."
  "context_length_exceeded", // OpenAI error code
  "context window", // OpenAI-compatible gateways
  "maximum number of tokens", // Gemini: "...exceeds the maximum number of tokens allowed"
  "input token count", // Gemini
  "reduce the length of the messages", // OpenAI remediation hint
];

/**
 * Whether an error is a 400 caused by the prompt exceeding the model's context
 * window — the only 400 worth recovering from by compacting the thread. Other
 * 400s (bad request shape, invalid arguments) are not retryable this way.
 */
export function isContextOverflow(err: unknown): boolean {
  if (!APICallError.isInstance(err) || err.statusCode !== 400) return false;
  const haystack = [err.message, err.responseBody]
    .filter((s): s is string => typeof s === "string")
    .join(" ")
    .toLowerCase();
  return CONTEXT_OVERFLOW_SIGNATURES.some((sig) => haystack.includes(sig));
}

/** The provider-suggested retry delay (ms) from a caught 429, or `null`. */
export function getRetryDelayFromError(err: unknown): number | null {
  if (!is429(err)) return null;
  return getRetryDelay(err.responseHeaders ?? {});
}

/** The delay a 429 should wait: the provider's hint when it gives one,
 *  otherwise exponential backoff; clamped and jittered either way. */
export function rateLimitDelay(err: unknown, attempt: number): number {
  return jitter(
    clampDelay(getRetryDelayFromError(err) ?? fallbackDelay(attempt))
  );
}

/**
 * Retry an async function up to RETRY_ATTEMPTS times, logging each failure.
 * On 429 errors, respects the provider-suggested retry delay from response
 * headers, falling back to exponential backoff. An API error the provider
 * marks as not worth retrying (a rejected key, a malformed request) is
 * thrown at once; anything else, such as output that failed to parse, is
 * retried.
 *
 * @param label - A short label for log messages (e.g. "Judge", "Customer").
 */
export async function retryWithLog<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).replace(
        /\.$/,
        ""
      );
      if (APICallError.isInstance(err) && !err.isRetryable) throw err;
      if (attempt > RETRY_ATTEMPTS) {
        console.error(
          `[${label}] All ${RETRY_ATTEMPTS + 1} attempts failed: ${msg}`
        );
        throw err;
      }
      if (is429(err)) {
        const delay = rateLimitDelay(err, attempt);
        console.log(
          `[Retry: ${label}] 429 rate limited. Waiting ${Math.round(delay / 1000)}s before retry ${attempt}/${RETRY_ATTEMPTS + 1}`
        );
        await sleep(delay);
      } else {
        const delay = jitter(fallbackDelay(attempt));
        console.error(
          `[Retry: ${label}] Attempt ${attempt}/${RETRY_ATTEMPTS + 1} failed: ${msg}. Retrying in ${Math.round(delay / 1000)}s`
        );
        await sleep(delay);
      }
    }
  }
}

// --- Retry-delay headers ---

type HeaderBag = Headers | Record<string, string | null | undefined>;

function getHeader(name: string, headers: HeaderBag): string | null {
  if (headers instanceof Headers) return headers.get(name);
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && value != null) return value;
  }
  return null;
}

function parseMs(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value.trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();

  // Retry-After: seconds
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  // Retry-After: HTTP date
  const at = Date.parse(trimmed);
  if (!Number.isNaN(at)) return Math.max(0, at - Date.now());

  return null;
}

function parseOpenAIReset(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();

  // Examples: "1s", "6m0s", "500ms", "1h2m3s"
  let total = 0;
  const re = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  let matched = false;

  for (let m = re.exec(trimmed); m; m = re.exec(trimmed)) {
    matched = true;
    const amount = Number(m[1]);
    const unit = m[2];
    if (unit === "ms") total += amount;
    else if (unit === "s") total += amount * 1000;
    else if (unit === "m") total += amount * 60_000;
    else if (unit === "h") total += amount * 3_600_000;
  }

  return matched ? Math.round(total) : null;
}

function parseAnthropicReset(value: string | null): number | null {
  if (!value) return null;
  const at = Date.parse(value.trim());
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

/** How long a rate-limited response asks the client to wait, in ms, from
 *  whichever of the providers' retry headers is present; `null` if none. */
export function getRetryDelay(headers: HeaderBag): number | null {
  // 1) Non-standard but useful when present
  const retryAfterMs = parseMs(getHeader("retry-after-ms", headers));
  if (retryAfterMs != null) return retryAfterMs;

  // 2) Standard HTTP header
  const retryAfter = parseRetryAfter(getHeader("retry-after", headers));
  if (retryAfter != null) return retryAfter;

  // 3) OpenAI duration-style reset headers
  for (const name of [
    "x-ratelimit-reset-requests",
    "x-ratelimit-reset-tokens",
  ]) {
    const delay = parseOpenAIReset(getHeader(name, headers));
    if (delay != null) return delay;
  }

  // 4) Anthropic absolute reset timestamps
  for (const name of [
    "anthropic-ratelimit-requests-reset",
    "anthropic-ratelimit-tokens-reset",
    "anthropic-ratelimit-input-tokens-reset",
    "anthropic-ratelimit-output-tokens-reset",
  ]) {
    const delay = parseAnthropicReset(getHeader(name, headers));
    if (delay != null) return delay;
  }

  return null;
}
