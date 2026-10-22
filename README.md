# agent-bench

Simulated-customer benchmarks for tool-using LLM agents.

Each run is a conversation between three LLM roles:

- **The agent under test** gets a system prompt and a set of tools, and
  answers whoever is on the other side.
- **A simulated customer** follows a script toward a goal, and ends the
  conversation by calling a `done` tool once its done criteria look met.
- **A judge** checks those criteria against the transcript: once to confirm
  a `done` before the conversation may end, and once afterwards to score the
  run from 1 to 10.

The same harness lets you play the customer yourself, which is the quickest
way to poke at an agent.

## Quick start

Requires Node 24 and pnpm 11.

```sh
pnpm install
bin/agent
```

`bin/agent` asks for whatever the command line leaves out: the agent, the
customer (0 is always you typing; the agent’s own follow), and the provider. It offers
runs on the first provider whose API key is set (`responses`, `completions`,
`anthropic`, `gemini`, in that order) and says which; with no key at all, it
asks for one (input hidden) for that run. Put keys in `.env` to keep them.
The same run spelled out:

```sh
bin/agent trivia gemini --customer ancient_rome --judge
```

The run prints the conversation as it goes, then writes its results under
`.temp/agents/<run_id>/`. Open `results.html` there for the transcript, the
judge’s verdict on each criterion and the cost by role.

```sh
bin/agent travel_agent --model claude-opus-4-8   # the provider follows the model
bin/agent board_meeting --message "What documents are available?"   # you type
```

Piped or scripted, with no one to ask, a missing choice is an error that
names the argument to pass.

## The agents

| Agent           | What it does                                                                                                                                                             | Tools                                                                                             | Customers                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `travel_agent`  | Plans trips: flights, hotels, attractions and activities, with Wikipedia for destination research. Flight and hotel search are deterministic; the rest an LLM simulates. | `flight_search`, `hotel_search`, `hotel_detail`, `attractions`, `activities`, `wikipedia_article` | `multi_city`, `budget_backpacker`, `luxury_honeymoon`, `family_vacation` |
| `trivia`        | Answers scripted trivia questions from live Wikipedia, quoting the article.                                                                                              | `wikipedia_search`, `wikipedia_read`                                                              | `ancient_rome`, `space_race`, `ww2_pacific`                              |
| `board_meeting` | Prepares a board member or the CEO for a meeting from 13 company documents (financials, minutes, surveys, pipeline). Every expected answer is a specific fact in them.   | `list_documents`, `read_document`                                                                 | `board_member`, `ceo`                                                    |

`trivia` and `board_meeting` accept the customer’s `done` as given, since
their customers work through a fixed list of questions; wrong answers are
caught when the judge scores the run instead. `travel_agent` confirms each `done` with
the judge first.

## How a run works

1. The customer opens, either with its scripted first message or one it
   writes.
2. The agent answers, calling tools as it likes (up to 10 tool round trips
   per turn).
3. From halfway through its expected number of turns, the customer is
   offered the `done` tool, and must mark each of its criteria met or unmet.
   A criterion it marks unmet keeps the conversation going.
4. When the customer calls `done` with everything met, the judge reads
   the transcript and either accepts it, ending the run, or rejects it with
   the criteria still unmet. A rejected customer carries on, with `done`
   withheld for two turns.
5. A run that goes on too long stops with `Turn limit reached`: after twice
   the customer’s expected turns (at least 7), or, past 1.75× its expected
   turns, at the customer’s next `done` without asking the judge.
6. With `--judge`, the judge then scores the transcript: 1 to 8 by the share
   of criteria met, plus up to 2 for efficiency when every criterion is met.

Rate limits are retried with the delay the provider asks for. If a thread
outgrows the agent’s context window, its middle turns are dropped and the
turn is retried. Each turn has a 4-minute limit. Ctrl-C ends the
conversation and still writes the results; a second Ctrl-C quits at once.

## Models

The second argument picks the API the agent is called over. Left out, it
follows `--model`, or the API keys that are set:

| Provider      | API                     | Default model       | Key                 |
| ------------- | ----------------------- | ------------------- | ------------------- |
| `responses`   | OpenAI Responses        | `gpt-6.1-sol`       | `OPENAI_API_KEY`    |
| `completions` | OpenAI Chat Completions | `gpt-6.1-sol`       | `OPENAI_API_KEY`    |
| `anthropic`   | Anthropic Messages      | `claude-sonnet-5-5` | `ANTHROPIC_API_KEY` |
| `gemini`      | Gemini API              | `gemini-4-argon`    | `GEMINI_API_KEY`    |

`--model` takes a model id with an optional reasoning level:
`<model>[@<none|minimal|low|medium|high|xhigh|max|dynamic>]`, for example
`--model gpt-5.5@high` or `--model claude-sonnet-4-6@low`. Each provider maps
the level onto its own setting (OpenAI’s reasoning effort, Anthropic’s
thinking budget or adaptive effort, Gemini’s thinking budget or level). A
level above what a model supports is lowered to its highest, and a spec with
no level runs at `medium` on every provider and is recorded with it, so two
runs that ran alike always carry the same model string. `@dynamic`, letting the model size
its own thinking, is Gemini-only.

`OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL` and `GEMINI_BASE_URL` point a
provider at any compatible endpoint, such as a gateway or a local server.

### Supporting models

Beside the agent under test, a run uses two supporting models: the
**customer** (which also answers the LLM-simulated tools) and the **judge**
(which gates the customer’s `done` and, with `--judge`, scores the run).
Both run on OpenAI by default. When `OPENAI_API_KEY` isn’t set, each moves
to the first provider whose key is, with that provider’s model for the role,
and the run says so:

| Provider                   | Customer, LLM-simulated tools | Judge               |
| -------------------------- | ----------------------------- | ------------------- |
| `responses`, `completions` | `gpt-6-luna`                  | `gpt-6-luna`        |
| `anthropic`                | `claude-haiku-5-5`            | `claude-sonnet-4-6` |
| `gemini`                   | `gemini-3.5-flash-lite`       | `gemini-3.8-flash`  |

So any one key runs everything. To put a role on a particular provider or
model, use `--customer_provider` / `--customer_model` and `--judge_provider` /
`--judge_model`:

```sh
bin/agent travel_agent --customer family_vacation --judge \
  --judge_provider anthropic
```

Scores are only directly comparable between runs whose customer and judge
ran on the same models; `results.json` records them under `support_models`.

## Output and replay

Each run writes `.temp/agents/<run_id>/` (or under `--log_dir`):

| File                         | Contents                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `input.json`                 | The agent, provider, model, customer and options, for rerunning it            |
| `results.json`               | Transcript, score, per-criterion verdicts, token usage and cost by role       |
| `results.html`               | The same, as a page to read (template: `packages/runtime/src/results.liquid`) |
| `agent_log.txt`              | Everything the run printed                                                    |
| `recordings/*/recording.har` | Every HTTP request and response, API keys masked                              |

`bin/agent --run_id <run_id>` reruns a run with its saved settings. Requests
that match the recording are answered from it, so a finished simulated run
replays exactly, in a second and without spending anything. Change the code
and rerun to see how a fix changes a past conversation: requests that now
differ go to the API.

Costs come from list prices in `packages/model-stats`, priced per request
(long-context tiers included). A model with no listed price is costed as its
closest known family, with a warning.

## Building on the framework

The runtime is a library. A **command** is a short program that imports it,
picks the agents it offers, and hands them to `runCli`:

```ts
import BoardMeetingAgent from "@agent-bench/board_meeting";
import { runCli } from "@agent-bench/runtime/cli.js";
import TravelAgent from "@agent-bench/travel_agent";
import TriviaAgent from "@agent-bench/trivia";
import dotenv from "dotenv";

dotenv.config({ path: ".env", quiet: true });

await runCli({ agents: [TravelAgent, TriviaAgent, BoardMeetingAgent] });
```

That is `examples/all_agents/cli.ts`, which `bin/agent` runs, give or take
the paths: the examples load the repo’s `.env` and write runs to the repo’s
`.temp/agents` wherever they are run from. Loading API keys is the
command’s business; `runCli` only reads the environment, and a key typed at
its prompt lasts for that run. Every command gets the same
options (`--customer`, `--judge`, `--run_id` and the rest) and asks for what
they leave out. A command with a single agent drops the agent argument, so
it reads `<command> [provider] [options]`.

| Example               | What it shows                                                                        | Run it                                            |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `examples/all_agents` | Every agent in `agents/` behind one command                                          | `bin/agent`                                       |
| `examples/weather`    | A complete agent of your own (one tool, one customer) in a single file, with its CLI | `bin/example weather gemini --customer picnicker` |

`bin/example <name> [args]` runs any folder in `examples/` that has a
`cli.ts`.

### Writing an agent

An agent is a class with a name, a system prompt, tool classes and customer
classes; `examples/weather/agent.ts` is a complete one in about 80 lines:

```ts
import { Agent } from "@agent-bench/runtime/agent.js";
import { Customer } from "@agent-bench/runtime/customer.js";
import { ToolBase } from "@agent-bench/runtime/tool.js";
import { z } from "zod";

const forecastSchema = z.object({ city: z.string(), date: z.string() });

class ForecastTool extends ToolBase<typeof forecastSchema> {
  readonly description = "Get the weather forecast for a city on a date";
  readonly inputSchema = forecastSchema;

  execute({ city, date }: z.infer<typeof forecastSchema>) {
    return { city, date, conditions: "sunny", high_c: 24 };
  }
}

class Picnicker extends Customer {
  readonly name = "picnicker";
  readonly targetTurns = 4;
  readonly goal = "Decide whether to hold a picnic in Lisbon on 2027-05-15.";
  readonly doneCriteria = [
    "The agent reported the forecast for Lisbon on 2027-05-15",
    "The agent gave a clear recommendation on whether to picnic",
  ];
  readonly system = "You are planning a picnic in Lisbon on 2027-05-15.";
}

export default class WeatherAgent extends Agent {
  static readonly agent_name = "weather";
  static readonly system = "You are a weather assistant. Use get_forecast.";
  static readonly tools = { get_forecast: ForecastTool };
  static readonly customers = { picnicker: Picnicker };
}
```

An agent meant for reuse gets its own package in `agents/<name>/`, like the
three here: a `package.json` whose `exports["."]` is `./src/index.ts`, the
agent as that module’s default export, and tests. To offer it, add it to a
command: import it in `examples/all_agents/cli.ts` (or your own command), add
`"@agent-bench/<name>": "workspace:*"` to that command’s dependencies, and run
`pnpm install`.

Each agent’s tests can start from one line, which checks its definition
without calling a model:

```ts
import { describeAgent } from "@agent-bench/runtime/testing.js";
import WeatherAgent from "../agent.ts";

describeAgent(WeatherAgent);
```

A tool whose answers would be tedious to write by hand can extend
`ToolFromLLM` instead: give it an output schema and a prompt, and an LLM
invents results that stay consistent with the conversation so far (see
`hotel_detail` in `agents/travel_agent/src/tools.ts`). Set
`done_mode = "accept"` on an agent whose customers follow a fixed script, as
`trivia` does, to skip the judge’s check of each `done`.

### Shared tools

Tools more than one agent uses live in `packages/tools`, a folder per family:
`@agent-bench/tools/wikipedia/search.js` and its siblings are used by both
`trivia` and `travel_agent`. Add a family as a new folder there.

## Repository layout

| Folder                 | Contents                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `agents/travel_agent`  | The travel agent: its tools (`tools.ts`), customers (`customers.ts`) and agent (`index.ts`) |
| `agents/trivia`        | The trivia agent and its customers                                                          |
| `agents/board_meeting` | The board meeting agent, its customers, and the company documents it reads (`docs/`)        |
| `examples/all_agents`  | The command behind `bin/agent`                                                              |
| `examples/weather`     | A self-contained agent and command                                                          |
| `packages/runtime`     | The framework: the conversation loop, customers, judges, models, cost tracking, `runCli`    |
| `packages/tools`       | Tools shared by agents (`wikipedia/`)                                                       |
| `packages/model-stats` | Model list prices and cache rates                                                           |

## Development

```sh
bin/test      # every package’s, agent’s and example’s tests; pass paths or --project <folder>
bin/lint      # prettier and tsc
bin/format    # prettier --write
```

`packages/model-stats/src` is generated from the providers’ published price
lists; don’t edit it by hand.

## License

MIT
