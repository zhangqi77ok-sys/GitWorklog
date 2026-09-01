export interface SymbolItem {
  id: number;
  file_id: number;
  name: string;
  container_name?: string | null;
  kind: string;
  range_start_line: number;
  range_start_col: number;
  range_end_line: number;
  range_end_col: number;
  signature?: string | null;
  doc_comment?: string | null;
  is_exported: number;
  file_path: string;
}

export interface SubgraphCallerCallee {
  symbol_id: number;
  name: string;
  kind: string;
  signature?: string | null;
  file_path: string;
  range_start_line: number;
  depth: number;
}

export interface SymbolSubgraphResponse {
  status: string;
  root_symbol: SymbolItem | null;
  callers: SubgraphCallerCallee[];
  callees: SubgraphCallerCallee[];
}

export interface IndexStatusResponse {
  status: string;
  total_files: number;
  total_symbols: number;
  total_references: number;
  db_size_bytes: number;
  workspace?: string;
}

export interface IndexSyncResponse {
  status: string;
  indexed_files: number;
  symbols_count: number;
  duration_ms: number;
}

const getBaseUrl = (): string => {
  return 'http://127.0.0.1:8010';
};

const getAuthHeaders = (): Record<string, string> => {
  let token = '';
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      token = window.localStorage.getItem('tcode_host_token') || '';
    } catch {
      token = '';
    }
  }
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'X-Tcode-Host-Token': token } : {}),
  };
};

export const semanticIndexService = {
  async searchSymbols(query: string, kind?: string, limit = 30): Promise<SymbolItem[]> {
    if (!query.trim()) return [];
    const params = new URLSearchParams({
      q: query.trim(),
      limit: String(limit),
      ...(kind && kind !== 'All' ? { kind } : {}),
    });

    try {
      const res = await fetch(`${getBaseUrl()}/api/index/search?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
      const data = await res.json();
      return data.results || [];
    } catch (e) {
      console.warn('[semanticIndexService] searchSymbols error:', e);
      return [];
    }
  },

  async fetchSubgraph(symbolId: number, depth = 2): Promise<SymbolSubgraphResponse | null> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/index/subgraph?symbol_id=${symbolId}&depth=${depth}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Fetch subgraph failed: ${res.statusText}`);
      return await res.json();
    } catch (e) {
      console.warn('[semanticIndexService] fetchSubgraph error:', e);
      return null;
    }
  },

  async syncWorkspaceIndex(force = false): Promise<IndexSyncResponse | null> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/index/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ force }),
      });
      if (!res.ok) throw new Error(`Sync index failed: ${res.statusText}`);
      return await res.json();
    } catch (e) {
      console.warn('[semanticIndexService] syncWorkspaceIndex error:', e);
      return null;
    }
  },

  async getStatus(): Promise<IndexStatusResponse | null> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/index/status`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Get status failed: ${res.statusText}`);
      return await res.json();
    } catch (e) {
      console.warn('[semanticIndexService] getStatus error:', e);
      return null;
    }
  },
};
