import { mkdirSync } from "node:fs";
import path from "node:path";
import FetchAdapter from "@pollyjs/adapter-fetch";
import NodeHttpAdapter from "@pollyjs/adapter-node-http";
import { Polly } from "@pollyjs/core";
import FSPersister from "@pollyjs/persister-fs";

type PollyRegistrable = Parameters<typeof Polly.register>[0];
Polly.register(FetchAdapter as unknown as PollyRegistrable);
Polly.register(NodeHttpAdapter as unknown as PollyRegistrable);
Polly.register(FSPersister as unknown as PollyRegistrable);

const SENSITIVE_HEADERS = [
  "authorization",
  "x-goog-api-key",
  "x-api-key",
  "api-key",
];

function maskHeaders(headers: Array<{ name: string; value: string }>): void {
  for (const header of headers) {
    const lowerName = header.name.toLowerCase();
    if (SENSITIVE_HEADERS.some((s) => lowerName.includes(s))) {
      header.value = "[MASKED]";
    }
  }
}

type PollyRecording = {
  request?: { headers?: Array<{ name: string; value: string }> };
  response?: { headers?: Array<{ name: string; value: string }> };
};

/**
 * Record every HTTP call of a run under <run_dir>/recordings. A request that
 * matches one already recorded (method, URL and body) is answered from the
 * recording, so rerunning a run id (`bin/agent --run_id <id>`) replays it;
 * only requests that differ go out to the API.
 */
export async function record_run<T>(
  run_dir: string,
  fn: () => Promise<T>
): Promise<T> {
  return record_http(path.join(run_dir, "recordings"), "recording", fn);
}

/**
 * Record every HTTP call `fn` makes, and its response, as a HAR file, or
 * replay the responses of a recording that already exists.
 *
 * `name` names the recording within `recordingsDir`, which is where callers
 * recording more than one thing tell them apart — Polly files each under
 * <recordingsDir>/<name>_<hash>/recording.har.
 *
 * Credentials are masked on the way out, so a recording is safe to keep next
 * to the run it came from.
 */
export async function record_http<T>(
  recordingsDir: string,
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  mkdirSync(recordingsDir, { recursive: true });
  const polly = new Polly(name, {
    adapters: ["fetch", "node-http"],
    adapterOptions: {
      fetch: { context: globalThis },
    },
    persister: "fs",
    persisterOptions: {
      fs: { recordingsDir },
    },
    recordIfMissing: true,
    recordFailedRequests: false,
    logLevel: "error",
    matchRequestsBy: {
      method: true,
      headers: false,
      body: true,
      order: false,
      url: {
        protocol: true,
        username: false,
        password: false,
        hostname: true,
        port: false,
        pathname: true,
        query: true,
        hash: false,
      },
    },
  });

  polly.server.any().on("beforePersist", (_request, recording: unknown) => {
    const rec = recording as PollyRecording;
    if (rec.request?.headers) {
      maskHeaders(rec.request.headers);
    }
    if (rec.response?.headers) {
      maskHeaders(rec.response.headers);
    }
  });

  const FLUSH_INTERVAL_MS = 2000;
  const MAX_BATCH_SIZE = 1;
  let requestsSinceLastFlush = 0;
  let lastFlushTime = Date.now();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const maybeFlush = async () => {
    const timeSinceLastFlush = Date.now() - lastFlushTime;
    if (
      requestsSinceLastFlush >= MAX_BATCH_SIZE ||
      (timeSinceLastFlush >= FLUSH_INTERVAL_MS && requestsSinceLastFlush > 0)
    ) {
      try {
        await polly.flush();
        if (polly.persister) {
          await polly.persister.persist();
        }
      } catch {
        // Polly throws when persisting failed requests (e.g. 400s).
        // Swallow so the worker stays alive and retries can proceed.
      }
      requestsSinceLastFlush = 0;
      lastFlushTime = Date.now();
    }
  };

  polly.server.any().on("response", () => {
    requestsSinceLastFlush++;
    if (requestsSinceLastFlush >= MAX_BATCH_SIZE) {
      void maybeFlush();
      return;
    }
    if (!flushTimer && requestsSinceLastFlush > 0) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void maybeFlush();
      }, FLUSH_INTERVAL_MS);
    }
  });

  try {
    return await fn();
  } finally {
    if (flushTimer) {
      clearTimeout(flushTimer);
    }
    try {
      await polly.stop();
    } catch {
      // stop() persists as well and throws on failed requests (e.g. 400s);
      // a throw here would replace fn()'s result with a recording error.
    }
  }
}
