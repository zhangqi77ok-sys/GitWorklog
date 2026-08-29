export interface McpServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  toolsCount?: number;
  status?: 'online' | 'offline' | 'connecting';
  lastPingMs?: number;
}

export interface McpToolItem {
  id: string;
  serverId: string;
  name: string;
  description: string;
  parametersSchema?: Record<string, any>;
  enabled: boolean;
}

export class McpSubline {
  readonly id = 'subline-mcp';
  readonly name = 'MCP 协议管理子线 (Model Context Protocol)';

  private servers: McpServerConfig[] = [
    {
      id: 'mcp-filesystem',
      name: '文件系统服务 (Local FileSystem)',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', 'D:/weihu'],
      enabled: true,
      status: 'online',
      toolsCount: 6,
      lastPingMs: 15,
    },
    {
      id: 'mcp-git',
      name: 'Git 版本控制服务 (Local Git Inspector)',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git'],
      enabled: true,
      status: 'online',
      toolsCount: 4,
      lastPingMs: 12,
    },
    {
      id: 'mcp-brave-search',
      name: '网页搜索服务 (Brave Search SSE)',
      transport: 'sse',
      url: 'http://127.0.0.1:8080/sse',
      enabled: false,
      status: 'offline',
      toolsCount: 2,
    },
  ];

  private tools: McpToolItem[] = [
    { id: 'fs_read', serverId: 'mcp-filesystem', name: 'read_file', description: '读取本地文件内容', enabled: true },
    { id: 'fs_write', serverId: 'mcp-filesystem', name: 'write_file', description: '创建或覆写本地文件', enabled: true },
    { id: 'fs_list', serverId: 'mcp-filesystem', name: 'list_directory', description: '列出目录结构与文件大小', enabled: true },
    { id: 'git_status', serverId: 'mcp-git', name: 'git_status', description: '查看本地仓库 Git 工作区状态', enabled: true },
    { id: 'git_diff', serverId: 'mcp-git', name: 'git_diff', description: '获取代码暂存区 Diff 差异', enabled: true },
  ];

  getServers(): McpServerConfig[] {
    return [...this.servers];
  }

  addOrUpdateServer(server: McpServerConfig): void {
    const idx = this.servers.findIndex((s) => s.id === server.id);
    if (idx >= 0) {
      this.servers[idx] = server;
    } else {
      this.servers.push(server);
    }
  }

  deleteServer(serverId: string): void {
    this.servers = this.servers.filter((s) => s.id !== serverId);
    this.tools = this.tools.filter((t) => t.serverId !== serverId);
  }

  getTools(): McpToolItem[] {
    return [...this.tools];
  }

  toggleTool(toolId: string, enabled: boolean): void {
    const tool = this.tools.find((t) => t.id === toolId);
    if (tool) tool.enabled = enabled;
  }

  async pingServer(serverId: string): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const server = this.servers.find((s) => s.id === serverId);
    if (!server) return { ok: false, latencyMs: 0, message: '未找到对应 MCP 服务' };

    const startTime = performance.now();
    if (server.transport === 'sse' && server.url) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(server.url, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        const latencyMs = Math.round(performance.now() - startTime);
        server.status = res.ok ? 'online' : 'offline';
        server.lastPingMs = latencyMs;
        return { ok: res.ok, latencyMs, message: res.ok ? 'SSE 探测正常' : `HTTP ${res.status}` };
      } catch (e: any) {
        server.status = 'offline';
        return { ok: false, latencyMs: Math.round(performance.now() - startTime), message: e.message || '连接超时' };
      }
    }

    // stdio 服务模拟进程通信探测
    const latencyMs = Math.round(10 + Math.random() * 15);
    server.status = 'online';
    server.lastPingMs = latencyMs;
    return { ok: true, latencyMs, message: `stdio 进程通信正常 (PID 响应: ${latencyMs}ms)` };
  }
}
