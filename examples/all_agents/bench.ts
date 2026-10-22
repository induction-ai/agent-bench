/**
 * bin/bench: every agent in this repo behind one bench command.
 *
 *   bin/bench travel_agent anthropic --customer multi_city --count 8
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import BoardMeetingAgent from "@agent-bench/board_meeting";
import { runBenchCli } from "@agent-bench/runtime/cli.js";
import TravelAgent from "@agent-bench/travel_agent";
import TriviaAgent from "@agent-bench/trivia";
import dotenv from "dotenv";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// API keys from this repo's .env; variables already set win.
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

await runBenchCli({
  agents: [TravelAgent, TriviaAgent, BoardMeetingAgent],
  logDir: path.join(ROOT, ".temp", "benches"),
});
