import { ToolBase } from "@agent-bench/runtime/tool.js";
import { z } from "zod";
import { wikipediaFetch } from "./fetch.ts";

const inputSchema = z.object({
  page_id: z.number().describe("The page_id from a wikipedia_search result"),
});

type TextExtractsResponse = {
  query?: {
    pages?: Record<
      string,
      { pageid?: number; title?: string; extract?: string }
    >;
  };
};

const MAX_CHARS = 10_000;

export class WikipediaReadTool extends ToolBase<typeof inputSchema> {
  readonly description =
    "Read the full plain-text content of a Wikipedia article by its page_id (returned from wikipedia_search).";
  readonly inputSchema = inputSchema;

  async execute({ page_id }: z.infer<typeof inputSchema>) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&pageids=${page_id}&format=json`;
    const response = await wikipediaFetch(url);

    if (!response.ok) {
      console.error(
        "wikipedia_read error",
        response.status,
        response.statusText
      );
      return {
        success: false,
        error: `Read failed: HTTP ${response.status}: ${response.statusText}`,
        page_id,
      };
    }

    const data = (await response.json()) as TextExtractsResponse;
    const pages = data.query?.pages;
    const page = pages ? Object.values(pages)[0] : undefined;

    if (!page?.extract) {
      return {
        success: false,
        error: "No content returned for this page",
        page_id,
      };
    }

    let text = page.extract;
    if (this.context.automated && text.length > MAX_CHARS) {
      text = `${text.slice(0, MAX_CHARS)} [end of available data]`;
    }

    return {
      success: true,
      page_id,
      title: page.title,
      text,
    };
  }
}
