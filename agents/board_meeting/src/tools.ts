import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ToolBase } from "@agent-bench/runtime/tool.js";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, "..", "docs");

// --- list_documents ---
const listDocumentsSchema = z.object({});

export class ListDocumentsTool extends ToolBase<typeof listDocumentsSchema> {
  readonly description =
    "List all available board meeting documents. Returns filenames and file sizes. Use this first to see what documents are available.";
  readonly inputSchema = listDocumentsSchema;

  execute() {
    const files = fs.readdirSync(DOCS_DIR);
    const docs = files.map((name) => {
      const stat = fs.statSync(path.join(DOCS_DIR, name));
      return { name, size_bytes: stat.size };
    });
    return { documents: docs };
  }
}

// --- read_document ---
const readDocumentSchema = z.object({
  name: z
    .string()
    .describe(
      "Filename of the document to read (e.g. 'q2_2026_board_minutes.md')"
    ),
});

export class ReadDocumentTool extends ToolBase<typeof readDocumentSchema> {
  readonly description =
    "Read the full text of a board meeting document by filename. Use list_documents first to see available files.";
  readonly inputSchema = readDocumentSchema;

  execute({ name }: z.infer<typeof readDocumentSchema>) {
    const filePath = path.join(DOCS_DIR, name);
    if (!fs.existsSync(filePath)) {
      return {
        error: `Document '${name}' not found. Use list_documents to see available files.`,
      };
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return { name, content };
  }
}
