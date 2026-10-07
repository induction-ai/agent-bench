import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import z from "zod";

const { XDG_STATE_HOME } = z
  .object({
    XDG_STATE_HOME: z.string().optional(),
  })
  .parse(process.env);

class ReadlineHistory {
  private rl: readline.Interface | null = null;
  private readonly historyFile: string;
  private readonly maxHistorySize = 1000;

  constructor() {
    const stateDir =
      XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
    this.historyFile = path.join(stateDir, "agent-bench", "history");

    process.on("exit", () => {
      this.close();
    });
  }

  private loadHistory(): string[] {
    try {
      const content = fs.readFileSync(this.historyFile, "utf-8");
      const lines = content
        .split("\n")
        .filter((line) => line.trim().length > 0);
      return lines.slice(-this.maxHistorySize);
    } catch {
      return [];
    }
  }

  private saveHistory(): void {
    if (!this.rl) return;
    try {
      fs.mkdirSync(path.dirname(this.historyFile), { recursive: true });
      const history = (this.rl as readline.Interface & { history: string[] })
        .history;
      const limitedHistory = history.slice(-this.maxHistorySize);
      const content = limitedHistory.join("\n") + "\n";
      fs.writeFileSync(this.historyFile, content, "utf-8");
    } catch (error) {
      console.error("Failed to save history:", error);
    }
  }

  private ensureInitialized(): readline.Interface {
    if (!this.rl) {
      const savedHistory = this.loadHistory();
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        history: savedHistory,
        historySize: this.maxHistorySize,
      });

      this.rl.on("SIGINT", () => {
        // exit with 0; avoids node's "warning: detected unsettled top level await...."
        process.exit(0);
      });
    }
    return this.rl;
  }

  question(prompt: string): Promise<string> {
    const rl = this.ensureInitialized();
    return new Promise((resolve) => {
      rl.question(prompt, (input) => {
        const trimmed = input.trim();
        resolve(trimmed);
      });
    });
  }

  close(): void {
    if (this.rl) {
      this.saveHistory();
      this.rl.close();
      this.rl = null;
    }
  }
}

const instance = new ReadlineHistory();

export const question = instance.question.bind(instance);
export const close = instance.close.bind(instance);

/** Ask for a secret, such as an API key, without echoing what is typed or
 *  keeping it in the history file. */
export function questionHidden(prompt: string): Promise<string> {
  close(); // one reader on stdin at a time
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  rl.on("SIGINT", () => process.exit(130));
  let muted = false;
  // readline echoes through _writeToOutput; silence it after the prompt.
  const echo = rl as unknown as { _writeToOutput: (s: string) => void };
  echo._writeToOutput = (s) => {
    if (!muted) process.stdout.write(s);
  };
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
    muted = true;
  });
}
