import { ToolBase } from "@agent-bench/runtime/tool.js";
import { z } from "zod";
import { wikipediaFetch } from "./fetch.ts";

const inputSchema = z.object({
  query: z
    .string()
    .describe("The name or topic of the Wikipedia article to look up"),
});

type TextExtractsResponse = {
  query?: {
    pages?: Record<string, { title?: string; extract?: string }>;
  };
};

const MAX_CHARS = 10_000;

export class WikipediaArticleTool extends ToolBase<typeof inputSchema> {
  readonly description =
    "Look up a Wikipedia article by name or topic and return its plain-text content";
  readonly inputSchema = inputSchema;

  async execute({ query }: z.infer<typeof inputSchema>) {
    // Search for the best matching article title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`;
    const searchResponse = await wikipediaFetch(searchUrl);

    if (!searchResponse.ok) {
      console.error(
        "wikipedia_article search error",
        searchResponse.status,
        searchResponse.statusText
      );
      return {
        success: false,
        error: `Search failed: HTTP ${searchResponse.status}: ${searchResponse.statusText}`,
        query,
      };
    }

    // opensearch returns: ["query", ["Title1", ...], ["Desc1", ...], ["URL1", ...]]
    const searchData = (await searchResponse.json()) as [
      string,
      string[],
      string[],
      string[],
    ];
    const titles = searchData[1];

    if (titles.length === 0) {
      return {
        success: false,
        error: "No Wikipedia article found matching that query",
        query,
      };
    }

    const title = titles[0] ?? query;

    // Fetch plain-text article content via TextExtracts API
    const articleUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&titles=${encodeURIComponent(title)}&format=json`;
    const articleResponse = await wikipediaFetch(articleUrl);

    if (!articleResponse.ok) {
      console.error(
        "wikipedia_article fetch error",
        articleResponse.status,
        articleResponse.statusText
      );
      return {
        success: false,
        error: `Article fetch failed: HTTP ${articleResponse.status}: ${articleResponse.statusText}`,
        query,
        title,
      };
    }

    const data = (await articleResponse.json()) as TextExtractsResponse;
    const pages = data.query?.pages;
    const extracts = Object.values(pages ?? {})
      .map((page) => page.extract)
      .filter((extract): extract is string => !!extract);

    if (extracts.length === 0) {
      return {
        success: false,
        error: "No extract returned for this article",
        query,
        title,
      };
    }

    let text = extracts.join("\n\n");
    if (this.context.automated && text.length > MAX_CHARS) {
      text = `${text.slice(0, MAX_CHARS)} [end of available data]`;
    }

    return {
      success: true,
      query,
      title,
      text,
    };
  }
}
