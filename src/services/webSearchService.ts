import { nativeService } from "./nativeService";

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  source?: string;
}

export class WebSearchService {
  /**
   * 生产级跨平台互联网检索 (Native IPC + 多引擎容错回退)
   */
  public async search(query: string): Promise<WebSearchResult[]> {
    if (!query || !query.trim()) return [];

    const cleanQuery = query.trim().slice(0, 100);

    // 1. 优先通过 Tauri 原生 Native IPC 执行无 CORS 限制的急速网络抓取
    try {
      const results = await nativeService.webSearch(cleanQuery);
      if (results && results.length > 0) {
        return results.map((r) => ({
          title: r.title || "搜索检索条目",
          snippet: r.snippet || "",
          url: r.url || "",
          source: r.source || "DuckDuckGo",
        }));
      }
    } catch (err) {
      console.warn("[WebSearchService] Native search fallback to web fetch:", err);
    }

    // 2. 备用兜底：Fetch API 快速检索
    try {
      const resp = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`
      );
      if (resp.ok) {
        const json = await resp.json();
        const fallbackResults: WebSearchResult[] = [];

        if (json.AbstractText) {
          fallbackResults.push({
            title: json.Heading || cleanQuery,
            snippet: json.AbstractText,
            url: json.AbstractURL || "https://duckduckgo.com",
            source: json.AbstractSource || "DuckDuckGo Instant",
          });
        }

        if (Array.isArray(json.RelatedTopics)) {
          for (const topic of json.RelatedTopics.slice(0, 4)) {
            if (topic.Text && topic.FirstURL) {
              fallbackResults.push({
                title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 40),
                snippet: topic.Text,
                url: topic.FirstURL,
                source: "DuckDuckGo Topics",
              });
            }
          }
        }

        if (fallbackResults.length > 0) return fallbackResults;
      }
    } catch (fetchErr) {
      console.warn("[WebSearchService] Fetch fallback error:", fetchErr);
    }

    return [];
  }

  /**
   * 格式化搜索结果为大模型注入上下文 Prompt
   */
  public formatSearchResultsForContext(results: WebSearchResult[]): string {
    if (!results || results.length === 0) return "";

    const lines = [
      `### 🌐 实时互联网搜索检索结果 (Live Web Search Citations - ${results.length} 篇参考来源):`,
      `以下为从互联网实时抓取的高相关性权威技术资料与最新动态，请在回答时结合这些事实并标注引用来源：`,
      "",
    ];

    results.forEach((r, idx) => {
      lines.push(`[${idx + 1}] 《${r.title}》`);
      lines.push(`来源链接: ${r.url}`);
      lines.push(`摘要要点: ${r.snippet}`);
      lines.push("");
    });

    return lines.join("\n");
  }
}

export const webSearchService = new WebSearchService();
