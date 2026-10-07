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
const envFile = path.join(ROOT, ".env");
dotenv.config({ path: envFile, quiet: true });

await runCli({
  agents: [WeatherAgent],
  name: "bin/example weather",
  envFile,
  logDir: path.join(ROOT, ".temp", "agents"),
});
