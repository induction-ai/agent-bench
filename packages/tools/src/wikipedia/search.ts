import { ToolBase } from "@agent-bench/runtime/tool.js";
import { z } from "zod";
import { wikipediaFetch } from "./fetch.ts";

const inputSchema = z.object({
  query: z.string().describe("The search query to find Wikipedia articles"),
});

type SearchResult = {
  ns: number;
  title: string;
  pageid: number;
  snippet: string;
};

type SearchResponse = {
  query?: {
    search?: SearchResult[];
  };
};

export class WikipediaSearchTool extends ToolBase<typeof inputSchema> {
  readonly description =
    "Search Wikipedia for articles matching a query. Returns a list of results with page_id and title. Use wikipedia_read to get the full text of a specific result.";
  readonly inputSchema = inputSchema;

  async execute({ query }: z.infer<typeof inputSchema>) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json`;
    const response = await wikipediaFetch(url);

    if (!response.ok) {
      console.error(
        "wikipedia_search error",
        response.status,
        response.statusText
      );
      return {
        success: false,
        error: `Search failed: HTTP ${response.status}: ${response.statusText}`,
        query,
      };
    }

    const data = (await response.json()) as SearchResponse;
    const results = data.query?.search;

    if (!results || results.length === 0) {
      return {
        success: false,
        error: "No Wikipedia articles found matching that query",
        query,
      };
    }

    return {
      success: true,
      query,
      results: results.map((r) => ({
        page_id: r.pageid,
        title: r.title,
        snippet: r.snippet.replace(/<[^>]*>/g, ""),
      })),
    };
  }
}
