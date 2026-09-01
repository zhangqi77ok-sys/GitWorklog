import { create } from 'zustand';

export interface McpServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  is_builtin?: boolean;
}

export interface SkillConfig {
  id: string;
  name: string;
  trigger: string; // e.g. "/review", "/tdd", "/security"
  description: string;
  prompt: string;
  enabled: boolean;
  is_builtin?: boolean;
}

interface McpSkillState {
  mcpServers: McpServerConfig[];
  skills: SkillConfig[];

  // MCP Actions
  addMcpServer: (server: Omit<McpServerConfig, 'id'>) => void;
  updateMcpServer: (id: string, updates: Partial<McpServerConfig>) => void;
  deleteMcpServer: (id: string) => void;
  toggleMcpServer: (id: string) => void;
  importClaudeJson: (jsonStr: string) => { success: boolean; count: number; error?: string };
  addPresetMcp: (presetId: string) => void;

  // Skill Actions
  addSkill: (skill: Omit<SkillConfig, 'id'>) => void;
  updateSkill: (id: string, updates: Partial<SkillConfig>) => void;
  deleteSkill: (id: string) => void;
  toggleSkill: (id: string) => void;
}

const STORAGE_KEY_MCP = 'tcode_mcp_servers';
const STORAGE_KEY_SKILLS = 'tcode_skills';

const INITIAL_MCP_SERVERS: McpServerConfig[] = [
  {
    id: 'mcp-builtin-fs',
    name: 'Built-in Filesystem MCP',
    transport: 'stdio',
    command: 'tcode-builtin-fs',
    args: ['--safe-sandbox'],
    enabled: true,
    is_builtin: true,
  },
  {
    id: 'mcp-builtin-terminal',
    name: 'Built-in Terminal Runner MCP',
    transport: 'stdio',
    command: 'powershell.exe',
    args: ['-NoProfile'],
    enabled: true,
    is_builtin: true,
  },
];

const INITIAL_SKILLS: SkillConfig[] = [
  {
    id: 'skill-code-review',
    name: '严苛架构与代码审查 (Thermo-Nuclear Review)',
    trigger: '/review',
    description: '深度审查函数规模、圈复杂度、分层纯度与 Code Judo 降维',
    prompt: '你是一名世界顶级架构审查专家。请对当前代码进行严苛审查，列出坏味道并给出最简降维优化方案。',
    enabled: true,
    is_builtin: true,
  },
  {
    id: 'skill-tdd-workflow',
    name: 'TDD 红绿重构测试生成器',
    trigger: '/tdd',
    description: '前置编写失败单元测试，严格践行 Red-Green-Refactor 工作流',
    prompt: '请严格遵循 TDD 规范，为目标需求或 Bug 编写断言精准且防过度 Mock 的前置回归测试用例。',
    enabled: true,
    is_builtin: true,
  },
  {
    id: 'skill-security-guard',
    name: '安全与漏洞防护守卫 (Security Guard)',
    trigger: '/security',
    description: '检查 SQL 注入、路径遍历、命令注入与敏感凭据泄漏风险',
    prompt: '请对代码与配置执行全量安全扫描，识别越权、命令执行、未授权访问与反序列化漏洞。',
    enabled: true,
    is_builtin: true,
  },
];

export const useMcpSkillStore = create<McpSkillState>((set, get) => {
  const loadStoredMcp = (): McpServerConfig[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MCP);
      if (raw) return JSON.parse(raw);
    } catch {}
    return INITIAL_MCP_SERVERS;
  };

  const loadStoredSkills = (): SkillConfig[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SKILLS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return INITIAL_SKILLS;
  };

  return {
    mcpServers: loadStoredMcp(),
    skills: loadStoredSkills(),

    addMcpServer: (server) => {
      const newServer: McpServerConfig = {
        ...server,
        id: `mcp_${Date.now()}`,
      };
      const updated = [...get().mcpServers, newServer];
      set({ mcpServers: updated });
      try {
        localStorage.setItem(STORAGE_KEY_MCP, JSON.stringify(updated));
      } catch {}
    },

    updateMcpServer: (id, updates) => {
      const updated = get().mcpServers.map((s) => (s.id === id ? { ...s, ...updates } : s));
      set({ mcpServers: updated });
      try {
        localStorage.setItem(STORAGE_KEY_MCP, JSON.stringify(updated));
      } catch {}
    },

    deleteMcpServer: (id) => {
      const updated = get().mcpServers.filter((s) => s.id !== id);
      set({ mcpServers: updated });
      try {
        localStorage.setItem(STORAGE_KEY_MCP, JSON.stringify(updated));
      } catch {}
    },

    toggleMcpServer: (id) => {
      const updated = get().mcpServers.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      );
      set({ mcpServers: updated });
      try {
        localStorage.setItem(STORAGE_KEY_MCP, JSON.stringify(updated));
      } catch {}
    },

    importClaudeJson: (jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr);
        const servers = parsed.mcpServers || parsed;
        if (!servers || typeof servers !== 'object') {
          return { success: false, count: 0, error: '未找到有效 mcpServers 对象' };
        }

        const newEntries: McpServerConfig[] = [];
        for (const [name, cfg] of Object.entries(servers)) {
          const c = cfg as any;
          newEntries.push({
            id: `mcp_${name}_${Date.now()}`,
            name,
            transport: c.url ? 'sse' : 'stdio',
            command: c.command,
            args: c.args || [],
            env: c.env || {},
            url: c.url,
            enabled: true,
            is_builtin: false,
          });
        }

        const updated = [...get().mcpServers, ...newEntries];
        set({ mcpServers: updated });
        localStorage.setItem(STORAGE_KEY_MCP, JSON.stringify(updated));
        return { success: true, count: newEntries.length };
      } catch (err: any) {
        return { success: false, count: 0, error: String(err) };
      }
    },

    addPresetMcp: (presetId: string) => {
      const presets: Record<string, Omit<McpServerConfig, 'id'>> = {
        postgres: {
          name: 'PostgreSQL MCP Server',
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
          enabled: true,
        },
        sqlite: {
          name: 'SQLite MCP Server',
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', './data.db'],
          enabled: true,
        },
        github: {
          name: 'GitHub Official MCP Server',
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
          enabled: true,
        },
        brave_search: {
          name: 'Brave Search MCP',
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-brave-search'],
          env: { BRAVE_API_KEY: '' },
          enabled: true,
        },
      };

      const preset = presets[presetId];
      if (preset) {
        get().addMcpServer(preset);
      }
    },

    addSkill: (skill) => {
      const newSkill: SkillConfig = {
        ...skill,
        id: `skill_${Date.now()}`,
      };
      const updated = [...get().skills, newSkill];
      set({ skills: updated });
      try {
        localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(updated));
      } catch {}
    },

    updateSkill: (id, updates) => {
      const updated = get().skills.map((s) => (s.id === id ? { ...s, ...updates } : s));
      set({ skills: updated });
      try {
        localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(updated));
      } catch {}
    },

    deleteSkill: (id) => {
      const updated = get().skills.filter((s) => s.id !== id);
      set({ skills: updated });
      try {
        localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(updated));
      } catch {}
    },

    toggleSkill: (id) => {
      const updated = get().skills.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      );
      set({ skills: updated });
      try {
        localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(updated));
      } catch {}
    },
  };
});
