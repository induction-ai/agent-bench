/**
 * An agent of your own behind its own command.
 *
 *   bin/example weather gemini --customer picnicker --judge
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "@agent-bench/runtime/cli.js";
import dotenv from "dotenv";
import WeatherAgent from "./agent.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// API keys from this repo's .env; variables already set win.
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

await runCli({
  agents: [WeatherAgent],
  name: "bin/example weather",
  logDir: path.join(ROOT, ".temp", "agents"),
});
