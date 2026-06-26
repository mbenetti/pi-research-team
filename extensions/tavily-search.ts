import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text, Component } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {

  // ============================================================
  // SMART WEB SEARCH — Primary: Tavily, Fallback: Ollama
  // ============================================================
  pi.registerTool({
    name: "smart_web_search",
    label: "🔍 Smart Web Search",
    description: "Search the web with intelligent fallback. Tries Tavily first (fast, AI-optimized), falls back to Ollama web search if Tavily fails. Handles rate limits, network errors, and missing API keys automatically.",
    promptSnippet: "Search the web with automatic fallback to Ollama",
    promptGuidelines: [
      "Use smart_web_search when you need current information from the internet",
      "This tool automatically handles failures and falls back to backup search",
      "Best for: research, fact-checking, recent news, technical queries",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "The search query" }),
      depth: StringEnum(["basic", "advanced"] as const, {
        description: "Search depth - 'basic' for quick, 'advanced' for thorough research"
      }),
      limit: Type.Optional(Type.Number({
        description: "Maximum number of results (default: 5, max: 10)",
        minimum: 1,
        maximum: 10
      })),
      includeDomains: Type.Optional(Type.Array(Type.String(), {
        description: "Domains to include (Tavily only)"
      })),
      excludeDomains: Type.Optional(Type.Array(Type.String(), {
        description: "Domains to exclude (Tavily only)"
      })),
      forceFallback: Type.Optional(Type.Boolean({
        description: "Skip Tavily and use Ollama directly"
      })),
    }),

    renderCall(args, theme) {
      return new Text(
        theme.fg("accent", theme.bold("🔍 ")) +
        theme.fg("muted", `Searching: "${args.query}"`),
        0, 0
      );
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as {
        source?: "tavily" | "ollama" | "fallback";
        results?: Array<{ title: string; content: string; url: string; score?: number }>;
        answer?: string;
        error?: string;
      };

      // Show source badge
      const sourceBadge = details?.source === "tavily"
        ? theme.fg("success", "✓ Tavily")
        : details?.source === "ollama"
          ? theme.fg("warning", "⚡ Ollama")
          : details?.source === "fallback"
            ? theme.fg("warning", "⚡ Fallback (Ollama)")
            : "";

      if (details?.error) {
        return new Text(
          theme.fg("error", "✗ Search failed") + "\n" +
          theme.fg("muted", details.error),
          0, 0
        );
      }

      if (!details?.results || details.results.length === 0) {
        return new Text(
          sourceBadge + " " +
          theme.fg("warning", "⚠ No results found"),
          0, 0
        );
      }

      let text = sourceBadge + " " + theme.fg("success", `✓ Found ${details.results.length} results`);

      if (details.answer) {
        text += `\n\n${theme.fg("accent", theme.bold("📝 Answer:"))}`;
        text += `\n${theme.fg("muted", details.answer)}`;
      }

      if (expanded) {
        for (let i = 0; i < details.results.length; i++) {
          const r = details.results[i];
          text += `\n\n${theme.fg("accent", theme.bold(`${i + 1}. ${r.title}`))}`;
          text += `\n${theme.fg("dim", r.url)}`;
          if (r.score !== undefined) {
            text += ` ${theme.fg("muted", `(score: ${r.score.toFixed(2)})`)}`;
          }
          text += `\n${theme.fg("muted", r.content.slice(0, 300))}${r.content.length > 300 ? "..." : ""}`;
        }
      }

      return new Text(text, 0, 0);
    },

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const useFallback = params.forceFallback === true;

      // Show progress
      onUpdate?.({
        content: [{ type: "text", text: "Searching the web..." }],
        details: { status: "searching", query: params.query },
      });

      // ========================================
      // PRIMARY: Try Tavily
      // ========================================
      if (!useFallback) {
        try {
          const tavilyResult = await tryTavily(params, signal);
          if (tavilyResult) {
            return {
              content: [{ type: "text", text: tavilyResult.summary }],
              details: {
                source: "tavily" as const,
                results: tavilyResult.results,
                answer: tavilyResult.answer,
              },
            };
          }
        } catch (tavilyError) {
          console.log("Tavily failed, trying fallback:", tavilyError);
        }
      }

      // ========================================
      // FALLBACK: Try Ollama Web Search
      // ========================================
      try {
        const ollamaResult = await tryOllamaWebSearch(params.query, params.limit ?? 5, signal, ctx);
        if (ollamaResult) {
          return {
            content: [{ type: "text", text: ollamaResult.summary }],
            details: {
              source: useFallback ? "fallback" : "ollama",
              results: ollamaResult.results,
            },
          };
        }
      } catch (ollamaError) {
        console.log("Ollama web search also failed:", ollamaError);
      }

      // Both failed
      return {
        content: [{ type: "text", text: "Both search engines failed. Try checking your internet connection." }],
        details: {
          source: "none",
          error: "Tavily and Ollama web search both failed. Check API keys and connection.",
        },
      };
    },
  });

  // ============================================================
  // TAVILY SEARCH — Direct access (for when you need Tavily specifically)
  // ============================================================
  pi.registerTool({
    name: "tavily_search",
    label: "Tavily Search",
    description: "Search the web using Tavily API directly. Returns AI-optimized results with content snippets, relevance scores, and optional AI-generated answers. Requires TAVILY_API_KEY environment variable.",
    promptSnippet: "Use Tavily for web search",
    promptGuidelines: [
      "Use tavily_search when you need high-quality, AI-optimized search results",
      "Supports domain filtering, time ranges, and search depth options",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "The search query" }),
      depth: StringEnum(["basic", "advanced"] as const, {
        description: "Search depth - 'basic' for quick, 'advanced' for thorough research"
      }),
      limit: Type.Optional(Type.Number({
        description: "Maximum number of results (default: 5, max: 10)",
        minimum: 1,
        maximum: 10
      })),
      includeDomains: Type.Optional(Type.Array(Type.String())),
      excludeDomains: Type.Optional(Type.Array(Type.String())),
    }),

    renderCall(args, theme) {
      return new Text(
        theme.fg("accent", theme.bold("🟠 ")) +
        theme.fg("muted", `Tavily: "${args.query}"`),
        0, 0
      );
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as {
        results?: Array<{ title: string; content: string; url: string; score?: number }>;
        answer?: string;
      };

      if (!details?.results || details.results.length === 0) {
        return new Text(theme.fg("warning", "🟠 No results found"), 0, 0);
      }

      let text = theme.fg("success", `🟠 Tavily: Found ${details.results.length} results`);

      if (details.answer) {
        text += `\n\n${theme.fg("accent", theme.bold("📝 Answer:"))}`;
        text += `\n${theme.fg("muted", details.answer)}`;
      }

      if (expanded) {
        for (let i = 0; i < details.results.length; i++) {
          const r = details.results[i];
          text += `\n\n${theme.fg("accent", theme.bold(`${i + 1}. ${r.title}`))}`;
          text += `\n${theme.fg("dim", r.url)}`;
          if (r.score !== undefined) {
            text += ` ${theme.fg("muted", `(score: ${r.score.toFixed(2)})`)}`;
          }
          text += `\n${theme.fg("muted", r.content.slice(0, 300))}${r.content.length > 300 ? "..." : ""}`;
        }
      }

      return new Text(text, 0, 0);
    },

    async execute(_toolCallId, params, signal, onUpdate) {
      const result = await tryTavily(params, signal);
      if (result) {
        return {
          content: [{ type: "text", text: result.summary }],
          details: {
            source: "tavily",
            results: result.results,
            answer: result.answer,
          },
        };
      }
      throw new Error("Tavily search failed");
    },
  });

  // ============================================================
  // OLLAMA WEB SEARCH — Direct fallback access
  // ============================================================
  pi.registerTool({
    name: "ollama_web_search",
    label: "Ollama Web Search",
    description: "Search the web using local Ollama instance's experimental web search API. Requires Ollama running with web search enabled. Lower quality than Tavily but works without API keys.",
    promptSnippet: "Use Ollama for web search (no API key needed)",
    promptGuidelines: [
      "Use ollama_web_search when Tavily is unavailable or for quick local searches",
      "Requires Ollama running locally with web search enabled",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "The search query" }),
      limit: Type.Optional(Type.Number({
        description: "Maximum number of results (default: 5)",
        minimum: 1,
        maximum: 10
      })),
    }),

    renderCall(args, theme) {
      return new Text(
        theme.fg("warning", theme.bold("⚡ ")) +
        theme.fg("muted", `Ollama: "${args.query}"`),
        0, 0
      );
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as {
        results?: Array<{ title: string; content: string; url: string }>;
      };

      if (!details?.results || details.results.length === 0) {
        return new Text(theme.fg("warning", "⚡ No results found"), 0, 0);
      }

      let text = theme.fg("success", `⚡ Ollama: Found ${details.results.length} results`);

      if (expanded) {
        for (let i = 0; i < details.results.length; i++) {
          const r = details.results[i];
          text += `\n\n${theme.fg("accent", theme.bold(`${i + 1}. ${r.title}`))}`;
          text += `\n${theme.fg("dim", r.url)}`;
          text += `\n${theme.fg("muted", r.content.slice(0, 200))}${r.content.length > 200 ? "..." : ""}`;
        }
      }

      return new Text(text, 0, 0);
    },

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const result = await tryOllamaWebSearch(params.query, params.limit ?? 5, signal, ctx);
      if (result) {
        return {
          content: [{ type: "text", text: result.summary }],
          details: {
            source: "ollama",
            results: result.results,
          },
        };
      }
      throw new Error("Ollama web search failed or not available");
    },
  });

  // ============================================================
  // WEB SEARCH ALIAS — Tavily-based, so agents that call `web_search` still work
  // ============================================================

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web for real-time information using Tavily API. Returns AI-optimized results with content snippets and relevance scores. Requires TAVILY_API_KEY environment variable.",
    parameters: Type.Object({
      query: Type.String({ description: "The search query to execute" }),
      max_results: Type.Optional(Type.Number({ description: "Maximum number of search results (default: 5)", default: 5 })),
    }),

    renderCall(args, theme) {
      return new Text(
        theme.fg("accent", theme.bold("🔍 ")) +
        theme.fg("muted", `Searching: "${args.query}"`),
        0, 0
      );
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as any;
      if (!details?.results?.length) {
        return new Text(theme.fg("warning", "No results found"), 0, 0);
      }
      let text = theme.fg("success", `✓ Found ${details.results.length} results`);
      if (expanded) {
        for (let i = 0; i < details.results.length; i++) {
          const r = details.results[i];
          text += `\n\n${theme.fg("accent", theme.bold(`${i + 1}. ${r.title}`))}`;
          text += `\n${theme.fg("dim", r.url)}`;
          text += `\n${theme.fg("muted", (r.content || "").slice(0, 300))}${r.content?.length > 300 ? "..." : ""}`;
        }
      }
      return new Text(text, 0, 0);
    },

    async execute(_toolCallId, params, signal, _onUpdate) {
      const query = params.query;
      const limit = params.max_results ?? 5;

      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        throw new Error("TAVILY_API_KEY not set. Add it to your .env file.");
      }

      try {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            max_results: limit,
            include_answer: true,
          }),
          signal,
        });

        if (!response.ok) {
          throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const results = (data.results ?? []).map((r: any) => ({
          title: r.title,
          content: r.content,
          url: r.url,
          score: r.score,
        }));

        let summary = `Found ${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`;
        if (data.answer) summary += `. ${data.answer}`;

        return {
          content: [{ type: "text", text: summary }],
          details: { results, answer: data.answer },
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        throw new Error(`Web search failed: ${error instanceof Error ? error.message : error}`);
      }
    },
  });

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  interface SearchResult {
    summary: string;
    results: Array<{ title: string; content: string; url: string; score?: number }>;
    answer?: string;
  }

  interface TavilyParams {
    query: string;
    depth?: "basic" | "advanced";
    limit?: number;
    includeDomains?: string[];
    excludeDomains?: string[];
  }

  async function tryTavily(params: TavilyParams, signal: AbortSignal): Promise<SearchResult | null> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.log("No TAVILY_API_KEY found");
      return null;
    }

    try {
      const body: Record<string, unknown> = {
        query: params.query,
        depth: params.depth ?? "basic",
        max_results: params.limit ?? 5,
        include_answer: true,
      };

      if (params.includeDomains) {
        body.include_domains = params.includeDomains;
      }
      if (params.excludeDomains) {
        body.exclude_domains = params.excludeDomains;
      }

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        console.log(`Tavily API error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      const results = (data.results ?? []).map((r: any) => ({
        title: r.title,
        content: r.content,
        url: r.url,
        score: r.score,
      }));

      const resultCount = results.length;
      let summary = `Found ${resultCount} result${resultCount !== 1 ? "s" : ""} for "${params.query}"`;
      if (data.answer) {
        summary += ` with AI answer`;
      }

      return {
        summary,
        results,
        answer: data.answer,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error; // Re-throw abort errors
      }
      console.log("Tavily fetch error:", error);
      return null;
    }
  }

  async function tryOllamaWebSearch(
    query: string,
    limit: number,
    signal: AbortSignal,
    ctx: any
  ): Promise<SearchResult | null> {
    try {
      // Use pi.tools.execute to call the registered ollama web_search tool
      const result = await ctx.tools.execute("web_search", {
        query,
        max_results: limit,
      }, signal);

      // Parse the result from web_search tool
      const text = result?.content?.[0]?.text ?? "";
      
      // Parse results from the text format
      const results: Array<{ title: string; content: string; url: string }> = [];
      const lines = text.split("\n");
      
      let currentResult: any = null;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^\d+\./)) {
          if (currentResult) results.push(currentResult);
          currentResult = { title: trimmed.replace(/^\d+\.\s*/, ""), content: "", url: "" };
        } else if (trimmed.startsWith("URL:") && currentResult) {
          currentResult.url = trimmed.replace("URL:", "").trim();
        } else if (currentResult && !trimmed.startsWith("URL:") && currentResult.title) {
          currentResult.content += (currentResult.content ? " " : "") + trimmed;
        }
      }
      if (currentResult) results.push(currentResult);

      if (results.length === 0) {
        // Try direct API call as fallback
        const response = await fetch("http://localhost:11434/api/experimental/web_search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, max_results: limit }),
          signal,
        });

        if (!response.ok) return null;
        
        const data = await response.json();
        const directResults = (data.results ?? []).map((r: any) => ({
          title: r.title,
          content: r.content,
          url: r.url,
        }));

        return {
          summary: `Ollama found ${directResults.length} results for "${query}"`,
          results: directResults,
        };
      }

      return {
        summary: `Ollama found ${results.length} results for "${query}"`,
        results,
      };
    } catch (error) {
      console.log("Ollama web search error:", error);
      return null;
    }
  }

  // ============================================================
  // CLI COMMANDS
  // ============================================================

  pi.registerCommand("search", {
    description: "Quick web search with automatic fallback",
    async execute(args, _ctx) {
      const query = args.join(" ");
      if (!query) {
        return { type: "error", message: "Usage: /search <query>" };
      }

      // Try Tavily first
      const tavilyResult = await tryTavily({ query, limit: 5 }, new AbortController().signal);
      if (tavilyResult) {
        let output = `🔍 Results for "${query}" (Tavily)\n\n`;
        if (tavilyResult.answer) {
          output += `📝 ${tavilyResult.answer}\n\n`;
        }
        tavilyResult.results.forEach((r, i) => {
          output += `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content.slice(0, 150)}...\n\n`;
        });
        return { type: "text", message: output };
      }

      // Fallback hint
      return {
        type: "error",
        message: `Search failed. Tavily API key may not be set. Try: export TAVILY_API_KEY=your_key`,
      };
    },
  });

  pi.registerCommand("tavily", {
    description: "Quick Tavily search from command line",
    async execute(args, _ctx) {
      const query = args.join(" ");
      if (!query) {
        return { type: "error", message: "Usage: /tavily <search query>" };
      }

      const result = await tryTavily({ query, limit: 5 }, new AbortController().signal);
      if (result) {
        let output = `🟠 Tavily results for "${query}"\n\n`;
        if (result.answer) {
          output += `📝 ${result.answer}\n\n`;
        }
        result.results.forEach((r, i) => {
          output += `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content.slice(0, 150)}...\n\n`;
        });
        return { type: "text", message: output };
      }

      return {
        type: "error",
        message: "Tavily search failed. Check TAVILY_API_KEY environment variable.",
      };
    },
  });
}