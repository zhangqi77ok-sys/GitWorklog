export interface GraphNode {
  id: number;
  name: string;
  kind: string;
  container_name?: string | null;
  signature?: string | null;
  file_path: string;
  range_start_line: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  id: number;
  source: number;
  target: number;
  relation: string;
}

export interface WorkspaceGraphResponse {
  status: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface BlastRadiusNode {
  symbol_id: number;
  name: string;
  kind: string;
  file_path: string;
  range_start_line: number;
  hop: number;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE';
}

export interface BlastRadiusResponse {
  status: string;
  root_symbol: GraphNode | null;
  impacted_nodes: BlastRadiusNode[];
  total_impacted: number;
}

export interface CodeLineageItem {
  id: number;
  file_path: string;
  line_start: number;
  line_end: number;
  author_type: 'AI_AGENT' | 'HUMAN';
  model_id?: string;
  prompt_hash?: string;
  prompt_preview?: string;
  approved_by?: string;
  approval_timestamp?: number;
  license_risk: 'SAFE' | 'CAUTION' | 'HIGH_RISK';
  checkpoint_ref?: string;
  created_at: number;
}

export interface AuditEventItem {
  id: number;
  session_id?: string;
  event_type: string;
  actor: string;
  summary: string;
  metadata_json?: string;
  timestamp: number;
}

const getBaseUrl = (): string => 'http://127.0.0.1:8010';

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
    ...(token ? { 'X-Tcode-Token': token, 'X-Tcode-Host-Token': token } : {}),
  };
};

export const codeGraphService = {
  async fetchWorkspaceGraph(kind?: string, limit = 120): Promise<WorkspaceGraphResponse> {
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        ...(kind && kind !== 'All' ? { kind } : {}),
      });
      const res = await fetch(`${getBaseUrl()}/api/graph/workspace?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Fetch graph failed: ${res.statusText}`);
      return await res.json();
    } catch (e) {
      console.warn('[codeGraphService] fetchWorkspaceGraph error:', e);
      return { status: 'error', nodes: [], edges: [] };
    }
  },

  async fetchBlastRadius(symbolId: number, hops = 2): Promise<BlastRadiusResponse | null> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/graph/blast_radius?symbol_id=${symbolId}&hops=${hops}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Fetch blast radius failed: ${res.statusText}`);
      return await res.json();
    } catch (e) {
      console.warn('[codeGraphService] fetchBlastRadius error:', e);
      return null;
    }
  },

  async fetchFileLineage(filePath: string): Promise<CodeLineageItem[]> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/lineage/file?path=${encodeURIComponent(filePath)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Fetch lineage failed: ${res.statusText}`);
      const data = await res.json();
      return data.lineage || [];
    } catch (e) {
      console.warn('[codeGraphService] fetchFileLineage error:', e);
      return [];
    }
  },

  async fetchAuditTimeline(limit = 40): Promise<AuditEventItem[]> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/lineage/timeline?limit=${limit}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Fetch audit timeline failed: ${res.statusText}`);
      const data = await res.json();
      return data.events || [];
    } catch (e) {
      console.warn('[codeGraphService] fetchAuditTimeline error:', e);
      return [];
    }
  },

  async recordLineage(payload: Partial<CodeLineageItem> & { prompt?: string }): Promise<boolean> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/lineage/record`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (e) {
      console.warn('[codeGraphService] recordLineage error:', e);
      return false;
    }
  },
};
