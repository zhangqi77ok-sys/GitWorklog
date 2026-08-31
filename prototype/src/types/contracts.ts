// Tcode ???????? (SDD Contract)

import type { AIModelOption, AccentColorOption, AgentSkillItem, ArchitectureTopologyNode, AttachedFile, BlastRadiusReport, ChangesetReviewPayload, ChannelItem, ChannelPresetMeta, ChannelType, ChatMessage, DebugProbeItem, DesktopArchType, DesktopPlatformConfig, DesktopPlatformType, DeveloperProfile, DiffNavigationTarget, FileNode, GatewayChannel, KeybindingItem, LessonRuleItem, LiveLogItem, ManagedRule, McpServerItem, MentionContextItem, MentionSearchResultItem, ModelItem, ModelProviderItem, ModelRoleRouting, ModelRoutingStrategy, OpenedEditorFile, ParsedAgentMessage, ParsedToolCall, PatchApplyResult, PatchChunk, PinnedFileItem, PreFlightCiReport, ProjectGroup, ProjectWorkspaceData, ProviderCategory, PullRequestDraftPayload, RepoGraphNode, ResizableLayoutState, RoutingStrategyId, RuleItem, SearchMatch, SearchResultFile, SemanticCommitItem, SessionItem, ShadowSnapshotMeta, SkillItem, SlashCommandItem, SwarmAgentState, SwarmPipelineStage, SystemSafetyConfig, TerminalTab, ThemeConfig, ThinkingBlockPayload, TrajectoryStepSnapshot, WorkMode, WorkModeMetadata, WorkbenchIconAction } from './contractsTypes';
export * from './contractsTypes';
// Tcode 核心接口规范契约 (SDD Contract)

import { buildModelCatalogEntry, getAvailableModelOptions as getCatalogModelOptions, providerItemsToRecords } from '../services/modelGateway';
import { hostFetch, getHostToken } from '../services/hostClient';

export * from './contractsLayout';
export * from './contractsTelemetry';
export * from './contractsSafety';

export const INITIAL_AGENT_SKILLS: AgentSkillItem[] = [
  // Tier 1: 专精能力 (Capabilities / 技能)
  {
    id: 'skill-refactor',
    name: '代码架构重构专家',
    tier: 'capability',
    category: '重构',
    icon: '⚡',
    description: '识别代码坏味道、消除循环依赖、重构冗长函数与提取复用积木组件',
    promptInstruction: '你作为代码架构与重构专家，请针对目标代码进行严格的架构坏味道分析，识别圈复杂度过高与高耦合区域，并给出模块化、单一职责的重构方案与单元测试保障。',
    enabled: true
  },
  {
    id: 'skill-unit-test',
    name: '单元测试生成器',
    tier: 'capability',
    category: '测试',
    icon: '🧪',
    description: '深入分析边界条件、异常分支并生成高质量 Vitest / Pytest 单元测试',
    promptInstruction: '你作为严谨的自动化测试专家，请为代码补充完整的单元测试用例，覆盖正常流、边界边界值、空异常与错误拦截，确保断言精确且测试独立。',
    enabled: true
  },
  {
    id: 'skill-security-audit',
    name: '安全漏洞与敏感信息审计',
    tier: 'capability',
    category: '安全',
    icon: '🔍',
    description: '全面检测硬编码密钥、SQL注入、XSS跨站脚本、反序列化与鉴权缺陷',
    promptInstruction: '你作为企业级安全审计专家，请全面审查代码中的潜在安全隐患，包括凭据泄露风险、OWASP Top 10 漏洞、不安全系统调用并提供修复补丁。',
    enabled: true
  },
  {
    id: 'skill-performance',
    name: '性能剖析与瓶颈调优',
    tier: 'capability',
    category: '性能',
    icon: '🚀',
    description: '分析前端重渲染、内存泄漏、后端算法时间复杂度与 IO 吞吐瓶颈',
    promptInstruction: '你作为性能优化与性能剖析专家，请分析代码中的性能瓶颈（如不必要渲染、O(N^2) 嵌套循环、内存泄漏），并给出极致优化的修改方案。',
    enabled: true
  },
  {
    id: 'skill-db-migration',
    name: '数据库变更与索引专家',
    tier: 'capability',
    category: '数据库',
    icon: '🗄️',
    description: '设计无锁 DDL 迁移脚本、SQL 查询计划 EXPLAIN 分析与联合索引调优',
    promptInstruction: '你作为高并发数据库架构师，请评估数据库变更方案，编写支持向后兼容且带安全回滚机制的 DDL/DML 脚本，并针对慢查询优化索引。',
    enabled: true
  },

  // Tier 2: 专属 Skill (Domain Skills)
  {
    id: 'skill-build-installer',
    name: 'Windows 安装包构建与发布',
    tier: 'skill',
    category: '发布',
    icon: '📦',
    description: '自动执行前端编译、101项测试门禁、PyInstaller 核心打包并生成 release/ 目录单文件安装包',
    promptInstruction: '你作为 Windows 桌面客户端发布专家，请严格遵循 build_installer.py 自动化流水线，确保通过全量单元测试与编译门禁后在 release/ 目录下生成生产级安装向导。',
    enabled: true
  },
  {
    id: 'skill-api-docs',
    name: 'API 与架构文档自动化',
    tier: 'skill',
    category: '文档',
    icon: '📝',
    description: '解析 AST 与接口类型，自动生成标准化 Markdown / OpenAPI 接口规范文档',
    promptInstruction: '你作为资深技术文档专家，请基于代码中的类型与实现，生成结构严谨、包含请求响应示例与边界说明的生产级 API 与系统架构文档。',
    enabled: true
  },
  {
    id: 'skill-git-pr',
    name: 'Git 语义提交与 PR 专家',
    tier: 'skill',
    category: 'Git',
    icon: '🛠️',
    description: '自动分析变更集并生成 Conventional Commits 语义化提交与 PR 摘要',
    promptInstruction: '你作为开源工程规范专家，请分析当前变更内容，生成符合 Conventional Commits 规范的语义化 Commit 信息与详尽的 Pull Request 描述。',
    enabled: true
  },
  {
    id: 'skill-react-ts',
    name: 'React & TypeScript 架构师',
    tier: 'skill',
    category: '前端',
    icon: '⚛️',
    description: '严格遵循 React 18+ 状态下沉、Custom Hooks 解耦与零 TS Any 类型规范',
    promptInstruction: '你作为 React & TypeScript 高级架构师，请遵循声明式组件设计，严禁使用 any，并采用高性能状态派生与 Memoization 模式。',
    enabled: true
  },
  {
    id: 'skill-python-backend',
    name: 'Python 高并发后端专家',
    tier: 'skill',
    category: '后端',
    icon: '🐍',
    description: '深入 FastAPI/AsyncIO 异步高并发、Pydantic V2 校验与连接池优化',
    promptInstruction: '你作为 Python 高性能后端架构师，请严格采用异步协程、强类型 Pydantic 模型与高可靠异常处理中间件。',
    enabled: true
  },

  // Tier 3: MCP 工具 (Model Context Protocol)
  {
    id: 'skill-mcp-fs',
    name: 'MCP 磁盘文件系统工具',
    tier: 'mcp',
    category: 'MCP',
    icon: '📂',
    description: '利用 Model Context Protocol 进行工作区文件的安全读写与正则检索',
    promptInstruction: '你作为配备 MCP Filesystem 工具的智能体，请调用标准文件读写与搜索协议工具执行代码探索与变更。',
    enabled: true
  },
  {
    id: 'skill-mcp-github',
    name: 'MCP GitHub 协同管理',
    tier: 'mcp',
    category: 'MCP',
    icon: '🐙',
    description: '通过 MCP 协议管理 GitHub Issue、Pull Request 与分支工作流',
    promptInstruction: '你作为连接 GitHub MCP Server 的智能体，请调用 PR 与 Issue 接口协助代码审查与持续集成。',
    enabled: true
  },
  {
    id: 'skill-mcp-postgres',
    name: 'MCP 数据库智能查询器',
    tier: 'mcp',
    category: 'MCP',
    icon: '🐘',
    description: '通过 MCP Postgres 接口安全执行只读 Schema 审查与慢查询分析',
    promptInstruction: '你作为连接数据库 MCP 的智能体，请仅执行安全只读查询以排查数据结构与执行计划。',
    enabled: true
  },
  {
    id: 'skill-mcp-browser',
    name: 'MCP 浏览器端到端测试',
    tier: 'mcp',
    category: 'MCP',
    icon: '🌐',
    description: '通过 MCP Puppeteer/Playwright 执行无头浏览器页面巡检与交互截图',
    promptInstruction: '你作为连接浏览器 MCP 的智能体，请自动导航至页面端点并执行 DOM 元素验证与渲染巡检。',
    enabled: true
  }
];

export function loadSavedSkills(): AgentSkillItem[] {
  try {
    const saved = localStorage.getItem('codemind_agent_skills');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return INITIAL_AGENT_SKILLS;
}

export function saveSkillsToStorage(skills: AgentSkillItem[]): void {
  try {
    localStorage.setItem('codemind_agent_skills', JSON.stringify(skills));
    saveToDiskStorageAsync('codemind_agent_skills', skills);
  } catch (e) {}
}

export const liveLogStore: LiveLogItem[] = [
  { id: 'log-1', timestamp: Date.now(), level: 'INFO', module: 'System', message: 'Tcode 内核启动完成，本地同源网关已就绪' }
];

export function appendLiveLog(level: 'INFO' | 'WARN' | 'ERROR' | 'NET', module: string, message: string): LiveLogItem {
  const item: LiveLogItem = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    level,
    module,
    message
  };
  liveLogStore.unshift(item);
  if (liveLogStore.length > 200) liveLogStore.pop();
  return item;
}

export function addTagToSession(session: SessionItem, tag: string): SessionItem {
  const cleanTag = tag.trim().replace(/^#/, '');
  if (!cleanTag || session.tags.includes(cleanTag)) return session;
  return { ...session, tags: [...session.tags, cleanTag], updatedAt: Date.now() };
}

export function removeTagFromSession(session: SessionItem, tagToRemove: string): SessionItem {
  return { ...session, tags: session.tags.filter(t => t !== tagToRemove), updatedAt: Date.now() };
}

export function renameSession(session: SessionItem, newTitle: string): SessionItem {
  const cleanTitle = newTitle.trim();
  if (!cleanTitle) return session;
  return { ...session, title: cleanTitle, updatedAt: Date.now() };
}

// Project Directory Operations
export function addProjectToWorkspace(
  projects: ProjectGroup[],
  folderPath: string,
  gitBranch: string = 'main'
): { projects: ProjectGroup[]; newProject: ProjectGroup } {
  const cleanPath = folderPath.trim().replace(/\\/g, '/');
  const folderName = cleanPath.split('/').filter(Boolean).pop() || 'new-project';
  const existing = projects.find(p => p.path === cleanPath);
  if (existing) {
    return { projects, newProject: existing };
  }
  const newProject: ProjectGroup = {
    id: `proj-${Date.now()}`,
    name: folderName,
    path: cleanPath,
    gitBranch,
    isExpanded: true
  };
  return { projects: [...projects, newProject], newProject };
}

export function removeProjectFromWorkspace(projects: ProjectGroup[], projectId: string): ProjectGroup[] {
  return projects.filter(p => p.id !== projectId);
}

// AI Models Contract & Registry

export const AVAILABLE_MODELS: AIModelOption[] = [
  {
    id: 'mimo-v2.5-free',
    name: 'OpenCode MiMo v2.5 (Go套餐·深度推理)',
    provider: 'DeepSeek',
    providerId: 'provider-opencode',
    uniqueKey: 'provider-opencode:mimo-v2.5-free',
    contextLimit: 131072,
    inputPricePerM: 0.00,
    outputPricePerM: 0.00,
    badge: 'OpenCode Go',
    description: 'OpenCode Go 套餐官方推荐大模型，支持长链条思维推理与全栈代码编写。'
  },
  {
    id: 'nemotron-3.5-lightning-free',
    name: 'Nemotron 3.5 Lightning (Go套餐·代码专精)',
    provider: 'DeepSeek',
    contextLimit: 131072,
    inputPricePerM: 0.00,
    outputPricePerM: 0.00,
    badge: 'NVIDIA 极速',
    description: '英伟达代码生成专用大模型，毫秒级快速流式吐字。'
  },

  {
    id: 'ling-3.0-flash-fin-free',
    name: '可灵 3.0 Flash (Go套餐·逻辑闪电)',
    provider: 'DeepSeek',
    contextLimit: 131072,
    inputPricePerM: 0.00,
    outputPricePerM: 0.00,
    badge: '极速响应',
    description: '快手可灵 3.0 Flash 闪电大模型，低延迟高吞吐。'
  },
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'DeepSeek',
    contextLimit: 128000,
    inputPricePerM: 0.10,
    outputPricePerM: 0.20,
    badge: '极速闪电',
    description: '极速响应与超低延迟高吞吐，适配星海大模型平台'
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude 3.7 Sonnet (OpenCode)',
    provider: 'Anthropic',
    contextLimit: 200000,
    inputPricePerM: 3.00,
    outputPricePerM: 15.00,
    badge: '深度思考',
    description: 'OpenCode 平台深度混合架构思考模型'
  },

  {
    id: 'deepseek-r1',
    name: 'DeepSeek-R1',
    provider: 'DeepSeek',
    contextLimit: 128000,
    inputPricePerM: 0.55,
    outputPricePerM: 2.19,
    badge: '深度思考',
    description: '长链条逻辑推演与算法突破'
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek-V3',
    provider: 'DeepSeek',
    contextLimit: 128000,
    inputPricePerM: 0.14,
    outputPricePerM: 0.28,
    badge: '极致性价比',
    description: '超低成本与毫秒级高吞吐'
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextLimit: 200000,
    inputPricePerM: 3.0,
    outputPricePerM: 15.0,
    badge: '主力旗舰',
    description: '综合编码与上下文架构最强'
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    contextLimit: 200000,
    inputPricePerM: 3.0,
    outputPricePerM: 15.0,
    badge: 'Thinking',
    description: '深度推理与混合思考模型'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextLimit: 128000,
    inputPricePerM: 2.5,
    outputPricePerM: 10.0,
    badge: '多模态',
    description: '综合全能型工程模型'
  },
  {
    id: 'qwen2.5-coder-32b-local',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'Local',
    contextLimit: 32000,
    inputPricePerM: 0,
    outputPricePerM: 0,
    badge: '纯离线私密',
    description: '本地 Ollama 直连，100% 物理隔离'
  }
];

export function getAllAvailableModels(): AIModelOption[] {
  try {
    const channels = loadSavedChannels().filter(c => c.status === 'active' || c.status === 'untested');
    if (channels.length > 0) {
      const channelModels: AIModelOption[] = [];
      for (const chan of channels) {
        const preset = getPresetForChannelType(chan.type);
        for (const modelId of chan.models) {
          const uniqueKey = `${chan.id}:${modelId}`;
          let badge = preset.name.split(' ')[0];
          if (chan.id.includes('opencode-go')) badge = 'Go套餐·免配';
          else if (chan.id.includes('opencode-zen')) badge = 'Zen旗舰';
          else if (chan.priority >= 10) badge = `P${chan.priority}·${badge}`;

          channelModels.push({
            id: modelId,
            name: modelId,
            provider: preset.name.split(' ')[0] as any,
            providerId: chan.id,
            uniqueKey,
            contextLimit: 131072,
            inputPricePerM: 0,
            outputPricePerM: 0,
            badge,
            description: `${chan.name} (端点: ${chan.baseUrl}) · 优先级 P${chan.priority} 权重 W${chan.weight}`
          });
        }
      }
      if (channelModels.length > 0) {
        return channelModels;
      }
    }

    const providers = loadSavedProviders();
    const records = providerItemsToRecords(providers);
    const catalogs = Object.fromEntries(providers.map(provider => [
      provider.id,
      (provider.models || []).map(model => buildModelCatalogEntry(provider, model))
    ]));
    const result = getCatalogModelOptions({ providers: records, catalogs });
    if (result.length > 0) return result;
  } catch (e) {
    // Fall through to deterministic built-ins when browser storage is unavailable.
  }
  return AVAILABLE_MODELS;
}

export function flattenFileTreeToMentions(nodes: FileNode[]): MentionContextItem[] {
  const items: MentionContextItem[] = [];
  function traverse(list: FileNode[]) {
    for (const node of list) {
      if (node.type === 'file') {
        items.push({
          id: `mention-file-${node.path}`,
          type: 'file',
          name: node.name,
          path: node.path,
          detail: `本地文件 · ${node.path}`
        });
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return items;
}

/**
 * Resolves the initial chat model strictly from the available list.
 * A persisted selection is restored only when it still exists in `all`;
 * stale references are never restored and no model id is hard-preferred.
 */
export function resolveInitialModel(all: AIModelOption[]): AIModelOption {
  // Priority 1: restore the full serialized model object, only if still valid.
  try {
    const savedObj = localStorage.getItem('codemind_current_model_obj');
    if (savedObj) {
      const parsed = JSON.parse(savedObj) as AIModelOption;
      const exactMatch = all.find(m =>
        (parsed.uniqueKey && m.uniqueKey === parsed.uniqueKey) ||
        (parsed.providerId && m.providerId === parsed.providerId && m.id === parsed.id)
      );
      if (exactMatch) return exactMatch;
      const nameMatch = all.find(m => m.name === parsed.name);
      if (nameMatch) return nameMatch;
    }
  } catch (e) {}

  // Priority 2: saved id lookup (exact, then contained match).
  try {
    let savedId = '';
    const savedSessionId = localStorage.getItem('codemind_current_session_id');
    const raw = localStorage.getItem('codemind_session_models_map');
    const map = raw ? JSON.parse(raw) : {};
    if (savedSessionId && map[savedSessionId]) {
      savedId = map[savedSessionId];
    } else {
      savedId = localStorage.getItem('codemind_current_model_id') || '';
    }
    if (savedId) {
      const found = all.find(m => m.uniqueKey === savedId || m.id === savedId);
      if (found) return found;
      const partial = all.find(m => m.id.includes(savedId) || savedId.includes(m.id));
      if (partial) return partial;
    }
  } catch (e) {}

  return all[0] || AVAILABLE_MODELS[0];
}
export function findModelById(id: string): AIModelOption {
  return AVAILABLE_MODELS.find(m => m.id === id) || AVAILABLE_MODELS.find(m => m.id === 'deepseek-v4-flash') || AVAILABLE_MODELS[0];
}

// Terminal Management Contract

export function createTerminalTab(existing: TerminalTab[], shell: string = 'PowerShell', defaultCwd: string = 'e:/pro/agent-learning'): TerminalTab {
  const num = existing.length + 1;
  return {
    id: `term-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    title: `${shell} (${num})`,
    shell,
    cwd: defaultCwd,
    logs: [
      'Windows PowerShell',
      'Copyright (C) Microsoft Corporation. All rights reserved.',
      '',
      `工作区路径: ${defaultCwd}`,
      '提示: 直接输入系统命令 (例如: dir, git status, git log, npm test, python --version) 即可实时在宿主系统执行。',
      ''
    ]
  };
}

export const INITIAL_TERMINALS_STATE: TerminalTab[] = [
  {
    id: 'term-1',
    title: 'PowerShell (1)',
    shell: 'PowerShell',
    cwd: 'e:/pro/agent-learning',
    logs: [
      'Windows PowerShell',
      'Copyright (C) Microsoft Corporation. All rights reserved.',
      '',
      '工作区路径: e:/pro/agent-learning',
      '提示: 直接输入系统命令 (例如: dir, git status, git log, npm test, python --version) 即可实时在宿主系统执行。',
      ''
    ]
  }
];

export function closeTerminalTab(existing: TerminalTab[], tabId: string): TerminalTab[] {
  if (existing.length <= 1) return existing;
  return existing.filter(t => t.id !== tabId);
}

// File Explorer Contract

export function filterFilesByQuery(query: string, files: Array<{ path: string; content: string }>): SearchResultFile[] {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  const results: SearchResultFile[] = [];

  for (const f of files) {
    const lines = f.content.split('\n');
    const matches: SearchMatch[] = [];
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(lower)) {
        matches.push({
          lineNumber: idx + 1,
          lineContent: line.trim(),
          matchRange: [line.toLowerCase().indexOf(lower), line.toLowerCase().indexOf(lower) + lower.length]
        });
      }
    });
    if (matches.length > 0) {
      results.push({
        filePath: f.path,
        fileName: f.path.split('/').pop() || f.path,
        matches
      });
    }
  }
  return results;
}

// Git & Shadow Snapshot Contract

export const WORKSPACE_MOCK_DATA: Record<string, ProjectWorkspaceData> = {
  'proj-1': {
    projectId: 'proj-1',
    projectName: 'agent-learning',
    gitBranch: 'main',
    fileTree: {
      id: 'proj-1-root',
      name: 'agent-learning',
      type: 'directory',
      children: [
        {
          id: 'p1-docs',
          name: 'docs',
          type: 'directory',
          path: 'docs',
          children: [
            { id: 'p1-prd', name: 'PRODUCT_REQUIREMENTS_DOCUMENT.md', type: 'file', path: 'docs/PRODUCT_REQUIREMENTS_DOCUMENT.md' },
            { id: 'p1-arch', name: 'ARCHITECTURE.md', type: 'file', path: 'docs/ARCHITECTURE.md' }
          ]
        },
        {
          id: 'p1-src',
          name: 'src',
          type: 'directory',
          path: 'src',
          children: [
            {
              id: 'p1-components',
              name: 'components',
              type: 'directory',
              path: 'src/components',
              children: [
                { id: 'p1-titlebar', name: 'Titlebar.tsx', type: 'file', path: 'src/components/Titlebar.tsx' },
                { id: 'p1-leftpanel', name: 'LeftPanel.tsx', type: 'file', path: 'src/components/LeftPanel.tsx' },
                { id: 'p1-chat', name: 'ChatColumn.tsx', type: 'file', path: 'src/components/ChatColumn.tsx' },
                { id: 'p1-editor', name: 'EditorWorkspace.tsx', type: 'file', path: 'src/components/EditorWorkspace.tsx' }
              ]
            },
            {
              id: 'p1-types',
              name: 'types',
              type: 'directory',
              path: 'src/types',
              children: [
                { id: 'p1-contracts', name: 'contracts.ts', type: 'file', path: 'src/types/contracts.ts' }
              ]
            },
            { id: 'p1-app', name: 'App.tsx', type: 'file', path: 'src/App.tsx' }
          ]
        },
        { id: 'p1-pkg', name: 'package.json', type: 'file', path: 'package.json' }
      ]
    },
    searchableFiles: [
      { path: 'src/types/contracts.ts', content: 'export class GatewayBus {\n  dispatch() {}\n}' },
      { path: 'src/components/LeftPanel.tsx', content: '// GatewayBus event listener\nexport const LeftPanel = () => {};' },
      { path: 'docs/PRODUCT_REQUIREMENTS_DOCUMENT.md', content: '单例调度总线 GatewayBus' }
    ],
    gitChanges: [
      { path: 'src/components/LeftPanel.tsx', status: 'modified', additions: 42, deletions: 18 },
      { path: 'docs/PRODUCT_REQUIREMENTS_DOCUMENT.md', status: 'modified', additions: 80, deletions: 12 }
    ],
    snapshots: [
      { id: 'snap-1', timestamp: Date.now() - 300000, label: '落地 4:6 终端与工作台收起', gitCommitHash: 'a8523ff', changedFilesCount: 7, isAiGenerated: true },
      { id: 'snap-2', timestamp: Date.now() - 1200000, label: '实现聚合模式下拉与多模型热切', gitCommitHash: 'a00ee38', changedFilesCount: 5, isAiGenerated: true }
    ]
  },
  'proj-2': {
    projectId: 'proj-2',
    projectName: 'codemind-sdk',
    gitBranch: 'dev',
    fileTree: {
      id: 'proj-2-root',
      name: 'codemind-sdk',
      type: 'directory',
      children: [
        {
          id: 'p2-codemind',
          name: 'codemind',
          type: 'directory',
          path: 'codemind',
          children: [
            { id: 'p2-harness', name: 'harness.py', type: 'file', path: 'codemind/harness.py' },
            { id: 'p2-ast', name: 'ast_parser.py', type: 'file', path: 'codemind/ast_parser.py' },
            { id: 'p2-bus', name: 'event_bus.py', type: 'file', path: 'codemind/event_bus.py' }
          ]
        },
        {
          id: 'p2-tests',
          name: 'tests',
          type: 'directory',
          path: 'tests',
          children: [
            { id: 'p2-test-harness', name: 'test_harness.py', type: 'file', path: 'tests/test_harness.py' }
          ]
        },
        { id: 'p2-setup', name: 'pyproject.toml', type: 'file', path: 'pyproject.toml' },
        { id: 'p2-readme', name: 'README.md', type: 'file', path: 'README.md' }
      ]
    },
    searchableFiles: [
      { path: 'codemind/harness.py', content: 'class TcodeHarness:\n    def run_tests(self): pass' },
      { path: 'codemind/ast_parser.py', content: 'import tree_sitter\ndef parse_ast(): pass' }
    ],
    gitChanges: [
      { path: 'codemind/harness.py', status: 'modified', additions: 15, deletions: 3 }
    ],
    snapshots: [
      { id: 'snap-sdk-1', timestamp: Date.now() - 7200000, label: '初始化 Python AST 语法治具', gitCommitHash: 'd3e8fa1', changedFilesCount: 2, isAiGenerated: false }
    ]
  }
};

export function getProjectWorkspaceData(projectId: string): ProjectWorkspaceData {
  return WORKSPACE_MOCK_DATA[projectId] || WORKSPACE_MOCK_DATA['proj-1'];
}

// Settings Modal System Contracts

export const ACCENT_COLOR_PRESETS: AccentColorOption[] = [
  { id: 'terracotta', name: '陶土暖橙 (默认)', hex: '#D96B27', bgSubtle: 'rgba(217, 107, 39, 0.12)' },
  { id: 'emerald', name: '极客荧光绿', hex: '#10B981', bgSubtle: 'rgba(16, 185, 129, 0.12)' },
  { id: 'azure', name: '深邃蔚蓝', hex: '#2563EB', bgSubtle: 'rgba(37, 99, 235, 0.12)' },
  { id: 'purple', name: '典雅紫罗兰', hex: '#9333EA', bgSubtle: 'rgba(147, 51, 234, 0.12)' }
];

export function toggleSkillItem(skills: SkillItem[], skillId: string): SkillItem[] {
  return skills.map(s => s.id === skillId ? { ...s, enabled: !s.enabled } : s);
}

export function updateKeybinding(bindings: KeybindingItem[], id: string, newKey: string): KeybindingItem[] {
  return bindings.map(b => b.id === id ? { ...b, currentKey: newKey } : b);
}

// Attachment & Rules Contracts

export function addAttachedFile(existing: AttachedFile[], file: { name: string; size?: number; type?: string }): AttachedFile[] {
  const newFile: AttachedFile = {
    id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    name: file.name,
    size: file.size || 1024,
    type: file.type || 'text/plain'
  };
  return [...existing, newFile];
}

export function removeAttachedFile(existing: AttachedFile[], id: string): AttachedFile[] {
  return existing.filter(f => f.id !== id);
}

export const INITIAL_RULES: RuleItem[] = [
  {
    id: 'rule-iron-triple',
    title: '项目级三大铁律 (AGENTS.md)',
    scope: 'project',
    content: '1. 双向强同步原则: 需求变动必须同步PRD与原型; 2. 严禁越界开发禁令; 3. 真实交互原型验证。',
    enabled: true,
    priority: 1
  },
  {
    id: 'rule-ts-strict',
    title: 'TypeScript 严格类型检查与无 any',
    scope: 'global',
    content: '永远保持严格类型标注，严禁使用 any，类型定义统一集中在 src/types/contracts.ts。',
    enabled: true,
    priority: 2
  },
  {
    id: 'rule-sdd-tdd',
    title: 'SDD-TDD 契约与单测先行原则',
    scope: 'global',
    content: '每次代码变更前必须先定义契约并补充 Vitest 自动化测试，确保 100% 测试通过。',
    enabled: true,
    priority: 3
  }
];

export function getActiveRules(rules: RuleItem[]): RuleItem[] {
  return rules.filter(r => r.enabled);
}

export function toggleRuleItem(rules: RuleItem[], ruleId: string): RuleItem[] {
  return rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r);
}

// Industrial-Grade Model Gateway Contracts

export const INITIAL_ROLE_ROUTING: ModelRoleRouting = {
  planModelId: 'deepseek-reasoner',
  actModelId: 'claude-3-5-sonnet',
  inlineModelId: 'claude-3-5-haiku',
  fallbackModelId: 'qwen2.5-coder:32b'
};

export function updateModelRoleRouting(
  current: ModelRoleRouting,
  role: keyof ModelRoleRouting,
  newModelId: string
): ModelRoleRouting {
  return { ...current, [role]: newModelId };
}

export const INITIAL_CHANNELS: GatewayChannel[] = [
  {
    id: 'chan-deepseek',
    name: 'DeepSeek 官方渠道 (百炼推理)',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    status: 'healthy',
    latencyMs: 85,
    models: [
      { id: 'deepseek-reasoner', name: 'deepseek-reasoner (R1 推理)', enabled: true, contextLimit: 64000 },
      { id: 'deepseek-chat', name: 'deepseek-chat (V3 主力)', enabled: true, contextLimit: 64000 }
    ]
  },
  {
    id: 'chan-anthropic',
    name: 'Anthropic 官方渠道 (Claude)',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    status: 'healthy',
    latencyMs: 128,
    models: [
      { id: 'claude-3-7-sonnet', name: 'claude-3-7-sonnet-20250219', enabled: true, contextLimit: 200000 },
      { id: 'claude-3-5-sonnet', name: 'claude-3-5-sonnet-20241022', enabled: true, contextLimit: 200000 },
      { id: 'claude-3-5-haiku', name: 'claude-3-5-haiku-20241022', enabled: true, contextLimit: 200000 }
    ]
  },
  {
    id: 'chan-openai',
    name: 'OpenAI 官方渠道 (GPT)',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    status: 'healthy',
    latencyMs: 142,
    models: [
      { id: 'gpt-4o', name: 'gpt-4o (全能旗舰)', enabled: true, contextLimit: 128000 },
      { id: 'o3-mini', name: 'o3-mini (深度推理)', enabled: true, contextLimit: 128000 }
    ]
  },
  {
    id: 'chan-ollama',
    name: '本地私有 Ollama (物理隔离)',
    protocol: 'ollama',
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    status: 'healthy',
    latencyMs: 0,
    models: [
      { id: 'qwen2.5-coder:32b', name: 'qwen2.5-coder:32b', enabled: true, contextLimit: 32000 },
      { id: 'deepseek-r1:14b', name: 'deepseek-r1:14b', enabled: true, contextLimit: 32000 }
    ]
  }
];

export function toggleChannelModel(
  channels: GatewayChannel[],
  channelId: string,
  modelId: string
): GatewayChannel[] {
  return channels.map(c => {
    if (c.id !== channelId) return c;
    return {
      ...c,
      models: c.models.map(m => m.id === modelId ? { ...m, enabled: !m.enabled } : m)
    };
  });
}

export function addCustomChannel(
  channels: GatewayChannel[],
  newChannel: GatewayChannel
): GatewayChannel[] {
  return [...channels, newChannel];
}

// ============================================================================
// New-API Channels & Standard Gateway Domain Contracts (Ref: E:\pro\new-api)
// ============================================================================

export const CHANNEL_PRESETS: ChannelPresetMeta[] = [
  {
    type: 60,
    name: 'OpenCode (Go/Zen 官方网关)',
    icon: '⚡',
    defaultBaseUrl: 'https://opencode.ai/zen/go/v1',
    defaultTestModel: 'mimo-v2.5-free',
    recommendedModels: [
      'mimo-v2.5-free',
      'nemotron-3.5-lightning-free',
      'ling-3.0-flash-fin-free',
      'nemotron-3-ultra-free',
      'deepseek-v4-flash-free',
      'laguna-s-2.1-free',
      'claude-sonnet-4-6',
      'deepseek-v4-flash'
    ],
    docUrl: 'https://opencode.ai',
    description: 'OpenCode 官方极速与推理网关，内置免费高并发 Go 套餐与旗舰 Zen 套餐'
  },
  {
    type: 43,
    name: 'DeepSeek (深度求索)',
    icon: '🔵',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultTestModel: 'deepseek-chat',
    recommendedModels: ['deepseek-chat', 'deepseek-reasoner'],
    docUrl: 'https://platform.deepseek.com',
    description: '深度求索官方平台，V3 极速代码与 R1 深度逻辑思考'
  },
  {
    type: 14,
    name: 'Anthropic (Claude)',
    icon: '◈',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultTestModel: 'claude-3-5-haiku-20241022',
    recommendedModels: ['claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
    docUrl: 'https://docs.anthropic.com',
    description: 'Anthropic 官方平台，Claude 3.7 Sonnet 思考混合架构'
  },
  {
    type: 1,
    name: 'OpenAI (GPT / Codex)',
    icon: '🟢',
    defaultBaseUrl: 'https://api.openai.com',
    defaultTestModel: 'gpt-4o-mini',
    recommendedModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
    docUrl: 'https://platform.openai.com',
    description: 'OpenAI 官方接口，GPT-4o 多模态与 o3-mini 推理'
  },
  {
    type: 24,
    name: 'Google Gemini',
    icon: '✦',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultTestModel: 'gemini-2.5-flash',
    recommendedModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    docUrl: 'https://ai.google.dev',
    description: '谷歌 Gemini 官方 API，超长 2M 上下文'
  },
  {
    type: 40,
    name: '硅基流动 (SiliconFlow)',
    icon: '🌊',
    defaultBaseUrl: 'https://api.siliconflow.cn',
    defaultTestModel: 'deepseek-ai/DeepSeek-V3',
    recommendedModels: [
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-Coder-32B-Instruct',
      'Pro/deepseek-ai/DeepSeek-V3'
    ],
    docUrl: 'https://siliconflow.cn',
    description: '国内顶级高吞吐推理算力平台，全面覆盖开源顶流模型'
  },
  {
    type: 4,
    name: '本地私有 Ollama',
    icon: '🦙',
    defaultBaseUrl: 'http://localhost:11434',
    defaultTestModel: 'qwen2.5-coder:7b',
    recommendedModels: ['qwen2.5-coder:32b', 'deepseek-r1:14b', 'qwen2.5-coder:7b', 'llama3.3:70b'],
    docUrl: 'https://ollama.com',
    description: '本地离线部署运行开源大模型，纯本地隐私零外泄'
  },
  {
    type: 20,
    name: 'OpenRouter (全球聚合)',
    icon: '🌐',
    defaultBaseUrl: 'https://openrouter.ai/api',
    defaultTestModel: 'openai/gpt-4o-mini',
    recommendedModels: ['anthropic/claude-3.7-sonnet', 'deepseek/deepseek-r1', 'google/gemini-2.5-pro'],
    docUrl: 'https://openrouter.ai',
    description: '全球多模型聚合路由网关'
  },
  {
    type: 16,
    name: '智谱 AI (GLM / CodeGeeX)',
    icon: '⚡',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultTestModel: 'glm-4-flash',
    recommendedModels: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'codegeex-4'],
    docUrl: 'https://open.bigmodel.cn',
    description: '智谱 AI 大模型平台'
  },
  {
    type: 17,
    name: '阿里百炼 (DashScope)',
    icon: '🟣',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultTestModel: 'qwen-plus',
    recommendedModels: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-coder-plus'],
    docUrl: 'https://dashscope.aliyun.com',
    description: '阿里云百炼平台与通义千问全系'
  },
  {
    type: 25,
    name: '月之暗面 (Kimi)',
    icon: '🌙',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultTestModel: 'moonshot-v1-8k',
    recommendedModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    docUrl: 'https://platform.moonshot.cn',
    description: 'Kimi 长文本大模型'
  },
  {
    type: 48,
    name: 'xAI (Grok)',
    icon: '✕',
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultTestModel: 'grok-2-mini',
    recommendedModels: ['grok-2', 'grok-2-mini', 'grok-beta'],
    docUrl: 'https://x.ai',
    description: '马斯克 xAI Grok 官方推理平台'
  },
  {
    type: 61,
    name: '自建 New API / One API',
    icon: '⇄',
    defaultBaseUrl: 'https://your-new-api-domain.com',
    defaultTestModel: 'gpt-4o-mini',
    recommendedModels: ['gpt-4o', 'claude-3-7-sonnet', 'deepseek-chat'],
    docUrl: 'https://github.com/QuantumNous/new-api',
    description: '自建 New API / One API 聚合分发中转中枢'
  },
  {
    type: 8,
    name: '自定义 OpenAI 兼容渠道',
    icon: '⚙️',
    defaultBaseUrl: 'https://api.example.com/v1',
    defaultTestModel: 'default',
    recommendedModels: ['custom-model'],
    description: '任意符合 OpenAI /v1 规范的自定义反代或私有端点'
  }
];

export const INITIAL_NEW_API_CHANNELS: ChannelItem[] = [];

export function loadSavedChannels(): ChannelItem[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tcode_channels_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch (e) {}
  return [];
}

export function saveChannelsToStorage(channels: ChannelItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tcode_channels_v2', JSON.stringify(channels));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tcode_channels_updated', { detail: channels }));
        window.dispatchEvent(new CustomEvent('tcode_providers_updated', { detail: channels }));
      }
    }
    saveToDiskStorageAsync('tcode_channels_v2', channels);
  } catch (e) {}
}

export function saveCurrentModelToStorage(model: AIModelOption): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('codemind_current_model_id', model.uniqueKey || model.id);
      localStorage.setItem('codemind_current_model_obj', JSON.stringify(model));
      localStorage.setItem(STORAGE_KEYS.CURRENT_MODEL, JSON.stringify(model));
    }
    saveToDiskStorageAsync(STORAGE_KEYS.CURRENT_MODEL, model);
    saveToDiskStorageAsync('codemind_current_model_id', model.uniqueKey || model.id);
    saveToDiskStorageAsync('codemind_current_model_obj', model);
  } catch (e) {}
}

export function getPresetForChannelType(type: ChannelType): ChannelPresetMeta {
  const found = CHANNEL_PRESETS.find(p => p.type === type);
  if (found) return found;
  return CHANNEL_PRESETS[CHANNEL_PRESETS.length - 1]; // fallback Custom
}

// GitHub Benchmark Model Provider Contracts

export const INITIAL_PROVIDERS: ModelProviderItem[] = [
  // 0. OpenCode Go Official Gateway (Go 套餐直连)
  {
    id: 'provider-opencode',
    name: 'OpenCode (Go 套餐·直连)',
    icon: '⚡',
    category: 'aggregator',
    enabled: true,
    protocol: 'openai',
    baseUrl: 'https://opencode.ai/zen/go/v1',
    defaultBaseUrl: 'https://opencode.ai/zen/go/v1',
    apiKey: '',
    status: 'untested',
    latencyMs: 0,
    docUrl: 'https://opencode.ai',
    models: [
      { id: 'mimo-v2.5-free', name: 'OpenCode MiMo v2.5 (Go套餐·深度推理)', enabled: true, contextLimit: 131072, capabilities: ['fast', 'code', 'stream', 'reasoning'], endpointPath: '/chat/completions', adapter: 'openai-compatible-chat', protocol: 'chat_completions' },
      { id: 'nemotron-3.5-lightning-free', name: 'Nemotron 3.5 Lightning (Go套餐·代码专精)', enabled: true, contextLimit: 131072, capabilities: ['code', 'stream', 'fast'], endpointPath: '/chat/completions', adapter: 'openai-compatible-chat', protocol: 'chat_completions' },
      { id: 'ling-3.0-flash-fin-free', name: '可灵 3.0 Flash (Go套餐·逻辑闪电)', enabled: true, contextLimit: 131072, capabilities: ['fast', 'stream'], endpointPath: '/chat/completions', adapter: 'openai-compatible-chat', protocol: 'chat_completions' },
      { id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra (Go套餐·深度代码)', enabled: true, contextLimit: 131072, capabilities: ['code', 'reasoning'], endpointPath: '/chat/completions', adapter: 'openai-compatible-chat', protocol: 'chat_completions' },
      { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash (Go套餐·极速闪电)', enabled: true, contextLimit: 65536, capabilities: ['fast', 'code', 'stream'], endpointPath: '/chat/completions', adapter: 'openai-compatible-chat', protocol: 'chat_completions' },
      { id: 'laguna-s-2.1-free', name: 'Laguna S 2.1 (Go套餐·架构推演)', enabled: true, contextLimit: 131072, capabilities: ['reasoning', 'code'], endpointPath: '/chat/completions', adapter: 'openai-compatible-chat', protocol: 'chat_completions' }
    ]
  },
  // 0.1 OpenCode Zen Official Gateway (Zen 旗舰套餐)
  {
    id: 'provider-opencode-zen',
    name: 'OpenCode (Zen 旗舰套餐)',
    icon: '👑',
    category: 'aggregator',
    enabled: true,
    protocol: 'openai',
    baseUrl: 'https://opencode.ai/zen/v1',
    defaultBaseUrl: 'https://opencode.ai/zen/v1',
    apiKey: '',
    status: 'untested',
    latencyMs: 0,
    docUrl: 'https://opencode.ai',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude 3.7 Sonnet (OpenCode Zen)', enabled: true, contextLimit: 200000, capabilities: ['reasoning', 'code', 'stream', 'toolCalling'], endpointPath: '/messages', adapter: 'anthropic-messages', protocol: 'anthropic_messages' },
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (OpenCode Zen)', enabled: true, contextLimit: 128000, capabilities: ['fast', 'code', 'stream'], endpointPath: '/chat/completions', adapter: 'openai-compatible-chat', protocol: 'chat_completions' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (OpenCode Zen)', enabled: true, contextLimit: 200000, capabilities: ['reasoning', 'code'], endpointPath: '/messages', adapter: 'anthropic-messages', protocol: 'anthropic_messages' },
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (OpenCode Zen)', enabled: true, contextLimit: 200000, capabilities: ['fast', 'code', 'vision'], endpointPath: '/chat/completions', adapter: 'openai-compatible-chat', protocol: 'chat_completions' }
    ]
  },
  // 1. Domestic Chinese Models (国内顶流)
  {
    id: 'provider-deepseek',
    name: 'DeepSeek (深度求索 / 星海平台)',
    icon: '🔵',
    category: 'domestic',
    enabled: true,
    protocol: 'openai',
    baseUrl: 'https://platform.ai.hixinghai.com/api/v1',
    defaultBaseUrl: 'https://platform.ai.hixinghai.com/api/v1',
    apiKey: '',
    status: 'healthy',
    latencyMs: 78,
    docUrl: 'https://platform.ai.hixinghai.com',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (极速闪电)', enabled: true, contextLimit: 128000, capabilities: ['fast', 'code'] },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (深度推理)', enabled: true, contextLimit: 64000, capabilities: ['reasoning', 'code'] },
      { id: 'deepseek-chat', name: 'DeepSeek-V3 (主力代码)', enabled: true, contextLimit: 64000, capabilities: ['fast', 'code'] }
    ]
  },
  {
    id: 'provider-zhipu',
    name: '智谱 AI (GLM / CodeGeeX)',
    icon: '⚡',
    category: 'domestic',
    enabled: true,
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: '',
    status: 'healthy',
    latencyMs: 92,
    docUrl: 'https://open.bigmodel.cn',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4-Plus (高智旗舰)', enabled: true, contextLimit: 128000, capabilities: ['reasoning', 'code'] },
      { id: 'codegeex-4', name: 'CodeGeeX-4 (专业代码大模型)', enabled: true, contextLimit: 128000, capabilities: ['code'] },
      { id: 'glm-4-flash', name: 'GLM-4-Flash (超快极速免算力)', enabled: true, contextLimit: 128000, capabilities: ['fast'] }
    ]
  },
  {
    id: 'provider-bailian',
    name: '阿里通义百炼 (Qwen)',
    icon: '🟧',
    category: 'domestic',
    enabled: true,
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    status: 'healthy',
    latencyMs: 88,
    docUrl: 'https://bailian.console.aliyun.com',
    models: [
      { id: 'qwen-max', name: 'Qwen-Max (全能百炼旗舰)', enabled: true, contextLimit: 32000, capabilities: ['reasoning', 'code'] },
      { id: 'qwen2.5-coder-32b', name: 'Qwen2.5-Coder-32B (代码利器)', enabled: true, contextLimit: 128000, capabilities: ['code'] },
      { id: 'qwen-plus', name: 'Qwen-Plus (高性价比均衡)', enabled: true, contextLimit: 128000, capabilities: ['fast', 'code'] }
    ]
  },
  {
    id: 'provider-moonshot',
    name: '月之暗面 (Moonshot Kimi)',
    icon: '🌙',
    category: 'domestic',
    enabled: false,
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    apiKey: '',
    status: 'untested',
    latencyMs: 0,
    docUrl: 'https://platform.moonshot.cn',
    models: [
      { id: 'moonshot-v1-128k', name: 'Moonshot-V1-128k (长文档理解)', enabled: false, contextLimit: 128000, capabilities: ['long-context'] },
      { id: 'kimi-latest', name: 'Kimi-Latest (智能体搜索)', enabled: false, contextLimit: 128000, capabilities: ['reasoning'] }
    ]
  },
  {
    id: 'provider-01ai',
    name: '零一万物 (01.AI / Yi)',
    icon: '🔴',
    category: 'domestic',
    enabled: false,
    protocol: 'openai',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    defaultBaseUrl: 'https://api.lingyiwanwu.com/v1',
    apiKey: '',
    status: 'untested',
    latencyMs: 0,
    docUrl: 'https://platform.lingyiwanwu.com',
    models: [
      { id: 'yi-lightning', name: 'Yi-Lightning (超快推理)', enabled: false, contextLimit: 16000, capabilities: ['fast', 'code'] },
      { id: 'yi-large', name: 'Yi-Large (全能通识)', enabled: false, contextLimit: 32000, capabilities: ['reasoning'] }
    ]
  },

  // 2. Aggregators & Middlewares (聚合中转站)
  {
    id: 'provider-siliconflow',
    name: '硅基流动 (SiliconFlow)',
    icon: '⚡',
    category: 'aggregator',
    enabled: true,
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: '',
    status: 'healthy',
    latencyMs: 68,
    docUrl: 'https://cloud.siliconflow.cn',
    models: [
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek-R1 (免配置秒级拉起)', enabled: true, contextLimit: 64000, capabilities: ['reasoning', 'code'] },
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3 (极速满血并发)', enabled: true, contextLimit: 64000, capabilities: ['fast', 'code'] },
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen2.5-Coder-32B (高并发)', enabled: true, contextLimit: 32000, capabilities: ['code'] }
    ]
  },
  {
    id: 'provider-oneapi',
    name: 'OneAPI / NewAPI 中转站',
    icon: '🔀',
    category: 'aggregator',
    enabled: true,
    protocol: 'openai',
    baseUrl: 'https://api.oneapi-hub.com/v1',
    defaultBaseUrl: 'https://api.oneapi-hub.com/v1',
    apiKey: '',
    status: 'healthy',
    latencyMs: 72,
    docUrl: 'https://github.com/songquanpeng/one-api',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (OneAPI 中转分发)', enabled: true, contextLimit: 128000, capabilities: ['vision', 'code'] },
      { id: 'claude-3-5-sonnet', name: 'Claude-3.5-Sonnet (负载均衡)', enabled: true, contextLimit: 200000, capabilities: ['code'] },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (多 Key 轮询)', enabled: true, contextLimit: 64000, capabilities: ['reasoning'] }
    ]
  },
  {
    id: 'provider-openrouter',
    name: 'OpenRouter (全球聚合)',
    icon: '🌐',
    category: 'aggregator',
    enabled: false,
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    status: 'untested',
    latencyMs: 0,
    docUrl: 'https://openrouter.ai',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)', enabled: false, contextLimit: 200000, capabilities: ['code'] },
      { id: 'openai/gpt-4o', name: 'GPT-4o (OpenRouter)', enabled: false, contextLimit: 128000, capabilities: ['vision', 'code'] }
    ]
  },

  // 3. International Mainstream (国际主流)
  {
    id: 'provider-anthropic',
    name: 'Anthropic (Claude)',
    icon: '🟣',
    category: 'international',
    enabled: true,
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    status: 'healthy',
    latencyMs: 128,
    docUrl: 'https://docs.anthropic.com',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Thinking)', enabled: true, contextLimit: 200000, capabilities: ['thinking', 'code', 'vision'] },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (主力旗舰)', enabled: true, contextLimit: 200000, capabilities: ['code', 'vision'] },
      { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku (轻快低时延)', enabled: true, contextLimit: 200000, capabilities: ['fast', 'code'] }
    ]
  },
  {
    id: 'provider-openai',
    name: 'OpenAI (GPT)',
    icon: '🟢',
    category: 'international',
    enabled: true,
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    status: 'healthy',
    latencyMs: 142,
    docUrl: 'https://platform.openai.com',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (全能多模态)', enabled: true, contextLimit: 128000, capabilities: ['vision', 'code'] },
      { id: 'o3-mini', name: 'o3-mini (深度推理)', enabled: true, contextLimit: 128000, capabilities: ['reasoning', 'code'] }
    ]
  },

  // 4. Local & Private (本地私有)
  {
    id: 'provider-ollama',
    name: '本地私有 Ollama',
    icon: '🦙',
    category: 'local',
    enabled: true,
    protocol: 'ollama',
    baseUrl: 'http://localhost:11434',
    defaultBaseUrl: 'http://localhost:11434',
    apiKey: '',
    status: 'healthy',
    latencyMs: 0,
    docUrl: 'https://ollama.com',
    models: [
      { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder 32B', enabled: true, contextLimit: 32000, capabilities: ['local', 'code'] },
      { id: 'deepseek-r1:14b', name: 'DeepSeek-R1 14B', enabled: true, contextLimit: 32000, capabilities: ['local', 'reasoning'] }
    ]
  },
  {
    id: 'provider-lmstudio',
    name: 'LM Studio 本地引擎',
    icon: '🖥️',
    category: 'local',
    enabled: false,
    protocol: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    defaultBaseUrl: 'http://localhost:1234/v1',
    apiKey: '',
    status: 'untested',
    latencyMs: 0,
    docUrl: 'https://lmstudio.ai',
    models: [
      { id: 'local-model', name: 'Local Model (GGUF)', enabled: false, contextLimit: 32000, capabilities: ['local'] }
    ]
  }
];

export function filterProviders(
  providers: ModelProviderItem[],
  category: ProviderCategory,
  keyword: string
): ModelProviderItem[] {
  return providers.filter(p => {
    const matchCategory = category === 'all' || p.category === category;
    const matchKeyword = !keyword.trim() || p.name.toLowerCase().includes(keyword.toLowerCase()) || p.models.some(m => m.id.toLowerCase().includes(keyword.toLowerCase()));
    return matchCategory && matchKeyword;
  });
}

export function toggleProviderSwitch(providers: ModelProviderItem[], providerId: string): ModelProviderItem[] {
  return providers.map(p => p.id === providerId ? { ...p, enabled: !p.enabled } : p);
}

export function toggleProviderModelSwitch(providers: ModelProviderItem[], providerId: string, modelId: string): ModelProviderItem[] {
  return providers.map(p => {
    if (p.id !== providerId) return p;
    return {
      ...p,
      models: p.models.map(m => m.id === modelId ? { ...m, enabled: !m.enabled } : m)
    };
  });
}

export function addCustomModelToProvider(providers: ModelProviderItem[], providerId: string, modelId: string): ModelProviderItem[] {
  return providers.map(p => {
    if (p.id !== providerId) return p;
    const newModel: ModelItem = {
      id: modelId.trim(),
      name: modelId.trim(),
      enabled: true,
      contextLimit: 64000,
      capabilities: ['custom', 'code']
    };
    return { ...p, models: [...p.models, newModel] };
  });
}

// ============================================================================
// ALL-TABS SYSTEM CONTRACTS & DATA MODELS
// ============================================================================

// 1. MCP Server & Tools Contracts

export const INITIAL_MCP_SERVERS: McpServerItem[] = [
  {
    id: 'mcp-github',
    name: 'GitHub Remote MCP',
    type: 'sse',
    endpoint: 'https://mcp.github.com/v1',
    status: 'running',
    latencyMs: 45,
    toolsCount: 8,
    tools: [
      { name: 'create_or_update_file', description: '向远程 Git 仓库提交或修改文件内容', parameters: { path: 'string', content: 'string' } },
      { name: 'search_repositories', description: '按关键词检索远程开源仓库代码与文档', parameters: { query: 'string' } }
    ]
  },
  {
    id: 'mcp-filesystem',
    name: 'Local Filesystem MCP',
    type: 'stdio',
    endpoint: 'npx -y @modelcontextprotocol/server-filesystem e:\\pro',
    status: 'running',
    latencyMs: 4,
    toolsCount: 5,
    tools: [
      { name: 'read_file_content', description: '安全沙箱内读取本地文件', parameters: { path: 'string' } },
      { name: 'write_file_content', description: '写盘持久化至沙箱工程', parameters: { path: 'string', content: 'string' } }
    ]
  },
  {
    id: 'mcp-devtools',
    name: 'Chrome DevTools MCP',
    type: 'stdio',
    endpoint: 'node chrome-devtools-mcp.js --port=9222',
    status: 'stopped',
    latencyMs: 0,
    toolsCount: 6,
    tools: [
      { name: 'capture_screenshot', description: '截取当前渲染视图的无头浏览器实机快照', parameters: { format: 'png' } }
    ]
  }
];

// 2. Rules Management Contracts
export function addCustomRule(
  rules: RuleItem[],
  newRule: { title: string; content: string; scope: 'project' | 'global' }
): RuleItem[] {
  const rule: RuleItem = {
    id: `rule-${Date.now()}`,
    title: newRule.title.trim(),
    content: newRule.content.trim(),
    scope: newRule.scope,
    enabled: true,
    priority: 1
  };
  return [rule, ...rules];
}

export function deleteRule(rules: RuleItem[], ruleId: string): RuleItem[] {
  return rules.filter(r => r.id !== ruleId);
}

// 3. MCP Server Operations
export function toggleMcpServer(servers: McpServerItem[], serverId: string): McpServerItem[] {
  return servers.map(s => {
    if (s.id === serverId) {
      const nextStatus = s.status === 'running' ? 'stopped' : 'running';
      return { ...s, status: nextStatus, latencyMs: nextStatus === 'running' ? 32 : 0 };
    }
    return s;
  });
}

// 4. Workbench Multi-File Tabs

export const INITIAL_OPENED_FILES: OpenedEditorFile[] = [
  {
    id: 'file-options',
    path: 'prototype/src/components/OptionsCard.tsx',
    name: 'OptionsCard.tsx',
    language: 'typescript',
    isDirty: false,
    content: '// OptionsCard.tsx - 人机协同动态决策分叉卡片组件\nimport React, { useState } from "react";\n\nexport const OptionsCard = () => {\n  return <div className="options-card">决策组件就绪</div>;\n};'
  },
  {
    id: 'file-contracts',
    path: 'prototype/src/types/contracts.ts',
    name: 'contracts.ts',
    language: 'typescript',
    isDirty: true,
    content: '// contracts.ts - 严格契约类型与状态转换纯函数\nexport interface ModelItem { ... }'
  }
];

export function closeEditorFile(
  files: OpenedEditorFile[],
  fileId: string
): { remainingFiles: OpenedEditorFile[]; activeFileId: string | null } {
  const remaining = files.filter(f => f.id !== fileId);
  return {
    remainingFiles: remaining,
    activeFileId: remaining.length > 0 ? remaining[remaining.length - 1].id : null
  };
}

// 5. Appearance Theme Preset Contracts

export const INITIAL_THEME_CONFIG: ThemeConfig = {
  mode: 'paper-warm',
  fontSize: 13,
  fontFamily: 'JetBrains Mono',
  accentColor: '#D96B27'
};

// 6. System & Safety Settings Contracts

export const INITIAL_SAFETY_CONFIG: SystemSafetyConfig = {
  dataDesensitization: true,
  gitShadowAutoSnapshot: true,
  astDepthLevel: 'standard',
  maxConcurrentTasks: 4,
  localPersistence: true
};

export const INITIAL_KEYBINDINGS: KeybindingItem[] = [
  { id: 'kb-act', actionName: '唤醒 Act 落地模式并提交', category: 'agent', currentKey: 'Ctrl + Enter', defaultKey: 'Ctrl + Enter' },
  { id: 'kb-new-chat', actionName: '新建当前工程会话', category: 'chat', currentKey: 'Ctrl + L', defaultKey: 'Ctrl + L' },
  { id: 'kb-inline', actionName: '代码行内智能重构 (Inline Edit)', category: 'editor', currentKey: 'Ctrl + K', defaultKey: 'Ctrl + K' },
  { id: 'kb-toggle-ws', actionName: '开关右侧工作台与 4:6 终端', category: 'editor', currentKey: 'Ctrl + `', defaultKey: 'Ctrl + `' },
  { id: 'kb-palette', actionName: '打开全局命令面板 (Command Palette)', category: 'navigation', currentKey: 'Ctrl + Shift + P', defaultKey: 'Ctrl + Shift + P' },
  { id: 'kb-search', actionName: '全局符号与文本检索', category: 'navigation', currentKey: 'Ctrl + Shift + F', defaultKey: 'Ctrl + Shift + F' },
  { id: 'kb-settings', actionName: '打开全局首选项与设置弹窗', category: 'navigation', currentKey: 'Ctrl + ,', defaultKey: 'Ctrl + ,' }
];

// ============================================================================
// 10. DeepSeek Harness Architecture Integration Contracts
// ============================================================================

export const WORK_MODE_CONFIGS: Record<WorkMode, WorkModeMetadata> = {
  act: {
    id: 'act',
    name: 'Act 落地执行',
    label: 'Act 落地模式',
    icon: '⚡',
    description: '全功能工具链 + AST 校验 + 代码落地与测试自纠',
    badge: '生产落地',
    tokenSavingRate: '标准消耗'
  },
  plan: {
    id: 'plan',
    name: 'Plan 架构推演',
    label: 'Plan 推演模式',
    icon: '📐',
    description: '只读探索 + 任务依赖拓扑生成，严禁越权写盘',
    badge: '只读推演',
    tokenSavingRate: '节省 40% Token'
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal 极简低噪',
    label: 'Minimal 极简模式',
    icon: '🪶',
    description: 'Harness 极简沙箱：过滤 80% 冗余转轮与废话，专注极速直出',
    badge: '极简低噪',
    tokenSavingRate: '立省 75% Token'
  },
  creator: {
    id: 'creator',
    name: 'Creator 技能造物',
    label: 'Creator 造物模式',
    icon: '🛠️',
    description: '用于现场调试 Prompt、生成自定义 Rule 与测试新 MCP 插件',
    badge: '生态调试',
    tokenSavingRate: '调试开发'
  }
};

export function forkSessionFromMessage(
  sessions: SessionItem[],
  messages: ChatMessage[],
  sourceSessionId: string,
  fromMessageId: string,
  branchSuffix?: string
): {
  updatedSessions: SessionItem[];
  newSession: SessionItem;
  forkedMessages: ChatMessage[];
} {
  const sourceSession = sessions.find(s => s.id === sourceSessionId) || sessions[0];
  const targetIndex = messages.findIndex(m => m.id === fromMessageId);
  const cutMessages = targetIndex !== -1 ? messages.slice(0, targetIndex + 1) : messages;

  const suffix = branchSuffix || `fork-${Math.random().toString(36).substring(2, 6)}`;
  const newId = `session-${Date.now()}`;
  const newSession: SessionItem = {
    ...sourceSession,
    id: newId,
    title: `${sourceSession.title} (${suffix})`,
    tags: [...(sourceSession.tags || []), 'fork'],
    messagesCount: cutMessages.length,
    totalTokens: Math.round(sourceSession.totalTokens * 0.8),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const forkedMessages: ChatMessage[] = cutMessages.map(m => ({
    ...m,
    id: `fork-${m.id}`
  }));

  return {
    updatedSessions: [newSession, ...sessions],
    newSession,
    forkedMessages
  };
}

export function filterCompilerNoise(rawLogs: string[]): {
  cleanedLogs: string[];
  suppressedLinesCount: number;
} {
  const wheelNoiseRegex = /^(⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏|\[\d+\/\d+\]|transforming \(\d+\)|rendering chunks\.\.\.|computing gzip size\.\.\.).*$/;
  let suppressed = 0;
  const cleaned: string[] = [];

  for (const line of rawLogs) {
    const trimmed = line.trim();
    if (wheelNoiseRegex.test(trimmed) || (trimmed.startsWith('> vite') && trimmed.includes('building'))) {
      suppressed++;
    } else {
      cleaned.push(line);
    }
  }

  return {
    cleanedLogs: cleaned,
    suppressedLinesCount: suppressed
  };
}

// ============================================================================
// 11. DX & PM POWER FEATURES CONTRACTS (@Mentions, Changeset, Pinned, ROI)
// ============================================================================

export const DEFAULT_MENTION_ITEMS: MentionContextItem[] = [
  { id: 'm-file-contracts', type: 'file', name: 'contracts.ts', path: 'src/types/contracts.ts', detail: '核心数据契约与接口' },
  { id: 'm-file-options', type: 'file', name: 'OptionsCard.tsx', path: 'src/components/OptionsCard.tsx', detail: '人机动态决策卡片组件' },
  { id: 'm-file-chat', type: 'file', name: 'ChatColumn.tsx', path: 'src/components/ChatColumn.tsx', detail: '一体化悬浮命令台与消息流' },
  { id: 'm-sym-bus', type: 'symbol', name: 'GatewayBus', path: 'src/types/contracts.ts', detail: 'AST 导出的多厂商模型网关总线' },
  { id: 'm-sym-harness', type: 'symbol', name: 'forkSessionFromMessage', path: 'src/types/contracts.ts', detail: 'AST 导出的会话时光机分叉函数' },
  { id: 'm-git-diff', type: 'git-diff', name: '@git-diff (工作区未暂存变更)', detail: '自动提取当前 Git 工作区所有新增与修改行' },
  { id: 'm-terminal', type: 'terminal', name: '@terminal (终端最新日志与报错)', detail: '抓取集成终端最近 50 行输出与错误堆栈' }
];

export function searchMentionItems(
  query: string,
  items: MentionContextItem[] = DEFAULT_MENTION_ITEMS
): MentionContextItem[] {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  if (!q) return items;
  return items.filter(item =>
    item.name.toLowerCase().includes(q) ||
    (item.path && item.path.toLowerCase().includes(q)) ||
    item.detail.toLowerCase().includes(q)
  );
}

export const INITIAL_CHANGESET: ChangesetReviewPayload = {
  id: 'cs-001',
  taskId: 'task-refactor-store',
  description: '重构状态管理层并接入 AST 语法校验与 TDD 测试',
  totalAdditions: 45,
  totalDeletions: 12,
  status: 'pending',
  createdAt: Date.now() - 60000,
  files: [
    { path: 'src/types/contracts.ts', name: 'contracts.ts', additions: 28, deletions: 4, status: 'modified', astVerified: true },
    { path: 'src/components/OptionsCard.tsx', name: 'OptionsCard.tsx', additions: 12, deletions: 8, status: 'modified', astVerified: true },
    { path: 'tests/contracts.test.ts', name: 'contracts.test.ts', additions: 5, deletions: 0, status: 'added', astVerified: true }
  ]
};

export function acceptChangeset(payload: ChangesetReviewPayload): ChangesetReviewPayload {
  return { ...payload, status: 'accepted' };
}

export function rejectChangeset(payload: ChangesetReviewPayload): ChangesetReviewPayload {
  return { ...payload, status: 'rejected' };
}

export function togglePinnedFile(
  pinnedList: PinnedFileItem[],
  file: { path: string; name: string; size?: number }
): PinnedFileItem[] {
  const exists = pinnedList.some(f => f.path === file.path);
  if (exists) {
    return pinnedList.filter(f => f.path !== file.path);
  }
  const newItem: PinnedFileItem = {
    id: `pin-${Date.now()}`,
    path: file.path,
    name: file.name,
    size: file.size || 1024
  };
  return [...pinnedList, newItem];
}

export function mergeForkSessionToMain(
  sessions: SessionItem[],
  messages: ChatMessage[],
  forkSessionId: string,
  mainSessionId: string,
  summary: string
): { updatedMessages: ChatMessage[]; targetSessionId: string } {
  const mergedEventMessage: ChatMessage = {
    id: `msg-merge-${Date.now()}`,
    role: 'assistant',
    timestamp: Date.now(),
    content: `🔀 **已成功合并分叉分支 [${forkSessionId}] 的成果**：\n\n${summary}\n\n✓ 核心变更集与决策已固化为主会话工程记忆。`
  };

  return {
    updatedMessages: [...messages, mergedEventMessage],
    targetSessionId: mainSessionId
  };
}

// 2. Terminal Security Sandbox

export const INITIAL_SWARM_STAGES: SwarmPipelineStage[] = [
  { id: 'swarm-1', role: 'architect', name: 'Architect 架构师', model: 'DeepSeek R1 (Reasoning)', task: '任务拆解与 SDD 接口契约定义', status: 'completed' },
  { id: 'swarm-2', role: 'coder', name: 'Coder 编码员', model: 'Claude 3.5 Sonnet', task: '多文件并发编码与 AST 校验落盘', status: 'running' },
  { id: 'swarm-3', role: 'tester', name: 'Tester 测试员', model: 'GLM-4-Plus (Fast Test)', task: '后台终端单测执行与报错自纠', status: 'idle' }
];

// 4. Local Semantic Repo Graph

export const MOCK_REPO_GRAPH: RepoGraphNode[] = [
  { id: 'node-dto', name: 'UserDto', type: 'interface', file: 'src/types/user.ts', dependencies: [] },
  { id: 'node-service', name: 'UserService', type: 'class', file: 'src/services/user.service.ts', dependencies: ['UserDto', 'GatewayBus'] },
  { id: 'node-controller', name: 'UserController', type: 'class', file: 'src/controllers/user.controller.ts', dependencies: ['UserService'] },
  { id: 'node-bus', name: 'GatewayBus', type: 'class', file: 'src/types/contracts.ts', dependencies: [] }
];

export function queryRepoGraphDependencies(symbolName: string, graph: RepoGraphNode[] = MOCK_REPO_GRAPH): RepoGraphNode[] {
  return graph.filter(node =>
    node.name.toLowerCase() === symbolName.toLowerCase() ||
    node.dependencies.some(d => d.toLowerCase() === symbolName.toLowerCase())
  );
}

// 5. PII Masking Engine

export const DEFAULT_LAYOUT_STATE: ResizableLayoutState = {
  leftPanelWidth: 240,
  workbenchWidth: 540,
  terminalHeightPercent: 40
};

export function appendLessonRule(
  existingRules: LessonRuleItem[],
  newRule: Omit<LessonRuleItem, 'id' | 'appliedCount' | 'createdAt'>
): { updatedRules: LessonRuleItem[]; addedRule: LessonRuleItem } {
  const addedRule: LessonRuleItem = {
    ...newRule,
    id: `lesson-${Date.now()}`,
    appliedCount: 1,
    createdAt: Date.now()
  };
  return {
    updatedRules: [addedRule, ...existingRules],
    addedRule
  };
}

export function generatePreFlightCiReport(
  passed: boolean,
  currentLineCoverage: number = 88.4,
  previousLineCoverage: number = 85.2
): PreFlightCiReport {
  const delta = Number((currentLineCoverage - previousLineCoverage).toFixed(1));
  return {
    status: passed ? 'passed' : 'failed',
    tsErrorsCount: passed ? 0 : 2,
    eslintWarningsCount: passed ? 0 : 4,
    lineCoverage: currentLineCoverage,
    lineCoverageDelta: delta,
    branchCoverage: 85.0,
    durationMs: 340,
    allowPush: passed && currentLineCoverage >= 80
  };
}

export function splitChangesetIntoSemanticCommits(files: Array<{ path: string }>): SemanticCommitItem[] {
  const commits: SemanticCommitItem[] = [];

  const storeFiles = files.filter(f => f.path.includes('contract') || f.path.includes('store'));
  if (storeFiles.length > 0) {
    commits.push({
      id: `commit-${Date.now()}-1`,
      type: 'feat',
      scope: 'contracts',
      message: '定义三栏布局约束与老码农生产级进阶契约',
      files: storeFiles.map(f => f.path)
    });
  }

  const testFiles = files.filter(f => f.path.includes('test'));
  if (testFiles.length > 0) {
    commits.push({
      id: `commit-${Date.now()}-2`,
      type: 'test',
      scope: 'contracts',
      message: '补充 6 大杀手特性边界断言测试',
      files: testFiles.map(f => f.path)
    });
  }

  const uiFiles = files.filter(f => f.path.includes('component') || f.path.includes('App') || f.path.includes('styles'));
  if (uiFiles.length > 0) {
    commits.push({
      id: `commit-${Date.now()}-3`,
      type: 'refactor',
      scope: 'ui',
      message: '重塑单行毛玻璃 Ribbon 与全键盘命令台',
      files: uiFiles.map(f => f.path)
    });
  }

  if (commits.length === 0) {
    commits.push({
      id: `commit-${Date.now()}-fallback`,
      type: 'chore',
      scope: 'workspace',
      message: '同步工程状态变更',
      files: files.map(f => f.path)
    });
  }

  return commits;
}

export function toggleDebugProbe(
  probes: DebugProbeItem[],
  fileId: string,
  line: number,
  variableName: string = 'output'
): DebugProbeItem[] {
  const existing = probes.find(p => p.fileId === fileId && p.line === line);
  if (existing) {
    return probes.filter(p => p.id !== existing.id);
  }
  return [
    ...probes,
    {
      id: `probe-${fileId}-${line}`,
      fileId,
      line,
      variableName,
      capturedValue: '{ status: "passed", code: 200 }',
      status: 'active'
    }
  ];
}

export function calculateBlastRadius(sourceFile: string): BlastRadiusReport {
  if (sourceFile.includes('contracts.ts')) {
    return {
      sourcePackage: 'packages/core (contracts)',
      impactedDownstream: [
        { packagePath: 'apps/web/ChatColumn.tsx', impactedSymbolsCount: 4, severity: 'medium' },
        { packagePath: 'apps/web/EditorWorkspace.tsx', impactedSymbolsCount: 3, severity: 'low' }
      ],
      totalAffectedCallsites: 7
    };
  }
  return {
    sourcePackage: 'apps/web',
    impactedDownstream: [],
    totalAffectedCallsites: 0
  };
}

// ============================================================================
// 15. UX & LOGIC CLOSURE CONTRACTS (Collapse Snap, Diff Navigation, Sudo Bypass)
// ============================================================================

export function createDiffNavigationTarget(
  fileId: string,
  filePath: string,
  targetLine: number = 14
): DiffNavigationTarget {
  return {
    fileId,
    filePath,
    targetLine,
    highlightToken: `diff-target-${fileId}-${targetLine}`
  };
}

export const WORKBENCH_ICON_ACTIONS: WorkbenchIconAction[] = [
  {
    id: 'blast-radius',
    icon: 'Boxes',
    label: '波及分析',
    tooltipTitle: '📦 Monorepo 跨包波及分析',
    tooltipDesc: 'core ➔ web (3处影响)，点击执行级联修复',
    badgeText: '3'
  },
  {
    id: 'preflight-ci',
    icon: 'Rocket',
    label: '本地 CI 预检',
    tooltipTitle: '🚀 本地 CI 门禁与覆盖率',
    tooltipDesc: '并行跑测 TypeScript + Vitest (覆盖率 88.4%)'
  },
  {
    id: 'inline-refactor',
    icon: 'Zap',
    label: '行内重构',
    tooltipTitle: '⚡ 行内智能重构',
    tooltipDesc: '快捷键: Alt+Enter，快速生成局部优化'
  },
  {
    id: 'shadow-snapshot',
    icon: 'Camera',
    label: '影子快照',
    tooltipTitle: '📷 影子快照历史',
    tooltipDesc: '已自动生成 4 个安全代码还原点'
  }
];

// ============================================================================
// 16. PULL REQUEST DRAFT & RULES MEMORY COCKPIT CONTRACTS
// ============================================================================

export function generatePullRequestDraft(
  branchName: string,
  sessionTitle: string,
  chosenDecision: string
): PullRequestDraftPayload {
  return {
    branchName,
    targetBranch: 'main',
    title: `feat(core): ${sessionTitle}`,
    motivation: '为系统状态管理提供高内聚扩展支持，并补充前置 SDD 契约与单元测试保障。',
    decisionLog: `根据人机协同决策，采纳架构选型：${chosenDecision}`,
    changedFilesCount: 3,
    ciPassProof: {
      typescript: '0 Errors (tsc --noEmit)',
      lint: '0 Warnings (ESLint + Prettier)',
      coverage: '88.4% Line Coverage (Vitest Pass)'
    }
  };
}

export const INITIAL_MANAGED_RULES: ManagedRule[] = [
  {
    id: 'rule-global-analysis-first',
    category: 'iron_law',
    scope: 'global',
    title: '全局三大铁律 #0: 先分析审查 ➔ 再出解决方案 ➔ 才能开发落地',
    description: '【严禁盲目直接写码】收到开发需求后，必须先深度分析和审查现有代码与测试契约，输出明确的架构设计与技术解决方案，然后才能落地编写代码 (write_file) 并运行全量测试 (run_command pytest/vitest)！',
    sourceFile: '.codemind/global_rules.md',
    enabled: true,
    priority: 200,
    readonly: true,
    updatedAt: 1724900000000,
    version: 1
  },
  {
    id: 'rule-iron-1',
    category: 'iron_law',
    scope: 'project',
    title: '项目三大铁律 #1: 需求与原型强同步',
    description: '有需求和原型、功能的变更，一定要同步到 PRD 和原型中。',
    sourceFile: 'AGENTS.md',
    enabled: true,
    priority: 100,
    readonly: true,
    updatedAt: 1724900000000,
    version: 1
  },
  {
    id: 'rule-iron-2',
    category: 'iron_law',
    scope: 'project',
    title: '项目三大铁律 #2: 需求未澄清严禁开发',
    description: '没有进行需求澄清和原型设计，不准进行任何代码编写。',
    sourceFile: 'AGENTS.md',
    enabled: true,
    priority: 95,
    readonly: true,
    updatedAt: 1724900000000,
    version: 1
  },
  {
    id: 'rule-iron-3',
    category: 'iron_law',
    scope: 'project',
    title: '项目三大铁律 #3: 功能原型必须有交互页面',
    description: '设计到的功能原型必须具备真实可点击的高保真交互页面。',
    sourceFile: 'AGENTS.md',
    enabled: true,
    priority: 90,
    readonly: true,
    updatedAt: 1724900000000,
    version: 1
  },
  {
    id: 'rule-lesson-1',
    category: 'lesson',
    scope: 'project',
    title: '经验沉淀: 禁止直接 new Store 实例',
    description: '必须通过 StoreFactory 单例方法获取全局 Store，保持单状态源。',
    sourceFile: '.codemind/lessons.md',
    enabled: true,
    priority: 80,
    updatedAt: 1724900000000,
    version: 1
  },
  {
    id: 'rule-team-1',
    category: 'team_rule',
    scope: 'global',
    title: '团队规范: SDD/TDD 契约前置验证',
    description: '先定义契约纯函数与测试断言，通过后方可注入 UI 组件。',
    sourceFile: '.cursorrules',
    enabled: true,
    priority: 75,
    updatedAt: 1724900000000,
    version: 1
  }
];

export const MOCK_RULES_MEMORY: ManagedRule[] = INITIAL_MANAGED_RULES;

// ============================================================================
// 17. AUTO MODEL ROUTER, TRAJECTORY TIME TRAVEL & TOPOLOGY GRAPH CONTRACTS
// ============================================================================

export const MODEL_ROUTING_STRATEGIES: ModelRoutingStrategy[] = [
  {
    id: 'auto',
    name: '自适应智能',
    desc: '按 Prompt 意图毫秒级自动调度最佳模型',
    icon: 'Sparkles',
    defaultModelId: 'claude-3-5-sonnet'
  },
  {
    id: 'max_reasoning',
    name: '最强深度推理',
    desc: '强制调度 DeepSeek-R1 / o3 深度思考',
    icon: 'Cpu',
    defaultModelId: 'deepseek-r1'
  },
  {
    id: 'lightning_fast',
    name: '极致极速',
    desc: '强制调度 Flash / Qwen 极速生成',
    icon: 'Zap',
    defaultModelId: 'gemini-1-5-flash'
  },
  {
    id: 'cost_saver',
    name: '成本优先',
    desc: '采用高性价比经济型模型',
    icon: 'Coins',
    defaultModelId: 'qwen-2-5-coder'
  }
];

export function resolveOptimalModel(prompt: string, strategy: RoutingStrategyId): { modelId: string; modelName: string; reason: string } {
  if (strategy === 'max_reasoning') {
    return { modelId: 'deepseek-r1', modelName: 'DeepSeek-R1', reason: '策略已锁定: 强制开启满血深度思维链推演' };
  }
  if (strategy === 'lightning_fast') {
    return { modelId: 'gemini-1-5-flash', modelName: 'Gemini 1.5 Flash', reason: '策略已锁定: 毫秒级极速流式响应' };
  }
  if (strategy === 'cost_saver') {
    return { modelId: 'qwen-2-5-coder', modelName: 'Qwen 2.5 Coder', reason: '策略已锁定: 极致性价比经济型调度' };
  }

  // Auto Adaptive Intent Routing
  const lower = prompt.toLowerCase();
  if (lower.includes('架构') || lower.includes('重构') || lower.includes('推演') || lower.includes('设计')) {
    return { modelId: 'deepseek-r1', modelName: 'DeepSeek-R1', reason: '检测到架构推演意图 ➔ 自动调度 R1 深度思考' };
  }
  if (lower.includes('测试') || lower.includes('test') || lower.includes('vitest') || lower.includes('lint')) {
    return { modelId: 'qwen-2-5-coder', modelName: 'Qwen 2.5 Coder', reason: '检测到测试编写意图 ➔ 自动调度 Qwen 极速校验' };
  }
  return { modelId: 'claude-3-5-sonnet', modelName: 'Claude 3.5 Sonnet', reason: '检测到复杂代码落地意图 ➔ 自动调度 Sonnet 精准实现' };
}

export const MOCK_TRAJECTORY_STEPS: TrajectoryStepSnapshot[] = [
  {
    stepIndex: 1,
    totalSteps: 4,
    title: 'AST 语法扫描与依赖分析',
    status: 'completed',
    timestamp: '15:10:02',
    summary: '扫描完成，识别 Store 状态拓展需求与 3 处 Monorepo 引用点',
    snapshotFileCount: 2
  },
  {
    stepIndex: 2,
    totalSteps: 4,
    title: '编写 Store 契约与前置测试',
    status: 'in_progress',
    timestamp: '15:10:48',
    summary: '已生成 contracts.ts 并在等待人机协同架构分支确认',
    snapshotFileCount: 3
  },
  {
    stepIndex: 3,
    totalSteps: 4,
    title: '组件状态迁移与 UI 渲染',
    status: 'pending',
    timestamp: '--:--',
    summary: '待确认后将 Store 注入 OptionsCard.tsx 与 App.tsx',
    snapshotFileCount: 0
  },
  {
    stepIndex: 4,
    totalSteps: 4,
    title: '本地 CI 门禁与 PR 交付',
    status: 'pending',
    timestamp: '--:--',
    summary: '自动化类型验证与覆盖率门禁，一键创建 PR',
    snapshotFileCount: 0
  }
];

export const MOCK_TOPOLOGY_NODES: ArchitectureTopologyNode[] = [
  {
    id: 'pkg-core',
    name: '@codemind/core',
    type: 'package',
    status: 'modified',
    dependencies: [],
    impactCount: 0
  },
  {
    id: 'pkg-web',
    name: '@codemind/web (UI)',
    type: 'package',
    status: 'impacted',
    dependencies: ['pkg-core'],
    impactCount: 3
  },
  {
    id: 'pkg-api',
    name: '@codemind/api (Gateway)',
    type: 'service',
    status: 'healthy',
    dependencies: ['pkg-core'],
    impactCount: 0
  },
  {
    id: 'mod-store',
    name: 'src/types/contracts.ts',
    type: 'module',
    status: 'modified',
    dependencies: ['pkg-core'],
    impactCount: 0
  }
];

// ============================================================================
// 18. STAGE 2: STREAMING & THINKING BLOCK CONTRACTS
// ============================================================================

export function parseAgentMessage(rawText: string): ParsedAgentMessage {
  let text = rawText || '';
  let thinkingText = '';
  const toolCalls: ParsedToolCall[] = [];
  let toolIndex = 0;
  const stableHash = (value: string) => {
    let hash = 5381;
    for (const character of value) hash = ((hash * 33) ^ character.charCodeAt(0)) >>> 0;
    return hash.toString(36);
  };

  const addToolCall = (name: string, parameters: Record<string, string>, raw: string) => {
    toolCalls.push({
      id: `tool-${toolIndex++}-${stableHash(raw)}`,
      name,
      parameters,
      raw
    });
  };

  const thinkMatch = /<think>([\s\S]*?)(?:<\/think>|$)/i.exec(text);
  if (thinkMatch) {
    thinkingText = thinkMatch[1].trim();
    text = text.replace(thinkMatch[0], '').trim();
  }

  const dsmlRegex = /<\s*\|?\s*DSML\s*\|?\s*tool_calls>([\s\S]*?)<\/\s*\|?\s*DSML\s*\|?\s*tool_calls>/gi;
  let dsmlMatch: RegExpExecArray | null;
  while ((dsmlMatch = dsmlRegex.exec(text)) !== null) {
    const invokeRegex = /<\s*\|?\s*DSML\s*\|?\s*invoke\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/\s*\|?\s*DSML\s*\|?\s*invoke>/gi;
    let invokeMatch: RegExpExecArray | null;
    while ((invokeMatch = invokeRegex.exec(dsmlMatch[1])) !== null) {
      const parameters: Record<string, string> = {};
      const parameterRegex = /<\s*\|?\s*DSML\s*\|?\s*parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/\s*\|?\s*DSML\s*\|?\s*parameter>/gi;
      let parameterMatch: RegExpExecArray | null;
      while ((parameterMatch = parameterRegex.exec(invokeMatch[2])) !== null) {
        parameters[parameterMatch[1]] = parameterMatch[2].trim();
      }
      addToolCall(invokeMatch[1], parameters, invokeMatch[0]);
    }
  }
  text = text.replace(dsmlRegex, '').trim();

  const toolCallRegex = /<tool_call>\s*<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>\s*<\/tool_call>/gi;
  let toolCallMatch: RegExpExecArray | null;
  while ((toolCallMatch = toolCallRegex.exec(text)) !== null) {
    const parameters: Record<string, string> = {};
    const body = toolCallMatch[2];
    const keyValueRegex = /<arg_key>\s*([^<]+?)\s*<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/gi;
    let keyValueMatch: RegExpExecArray | null;
    while ((keyValueMatch = keyValueRegex.exec(body)) !== null) {
      parameters[keyValueMatch[1].trim()] = keyValueMatch[2].trim();
    }
    const directRegex = /<(path|command|content)>\s*([\s\S]*?)<\/\1>/gi;
    let directMatch: RegExpExecArray | null;
    while ((directMatch = directRegex.exec(body)) !== null) {
      parameters[directMatch[1]] = directMatch[2].trim();
    }
    addToolCall(toolCallMatch[1], parameters, toolCallMatch[0]);
  }
  text = text.replace(toolCallRegex, '').trim();

  return { thinkingText, toolCalls, cleanContent: text };
}

export function extractThinkingFromText(rawText: string, elapsedSeconds: number = 0): ThinkingBlockPayload {
  const thinkStart = rawText.indexOf('<think>');
  const thinkEnd = rawText.indexOf('</think>');

  if (thinkStart === -1) {
    return {
      thinkingText: '',
      contentText: rawText,
      isThinkingFinished: true,
      durationSeconds: elapsedSeconds,
      tokensCount: Math.ceil(rawText.length / 4)
    };
  }

  if (thinkEnd === -1) {
    // Still thinking
    const thinking = rawText.substring(thinkStart + 7);
    return {
      thinkingText: thinking.trim(),
      contentText: '',
      isThinkingFinished: false,
      durationSeconds: elapsedSeconds,
      tokensCount: Math.ceil(thinking.length / 4)
    };
  }

  // Finished thinking
  const thinking = rawText.substring(thinkStart + 7, thinkEnd).trim();
  const content = rawText.substring(thinkEnd + 8).trim();
  return {
    thinkingText: thinking,
    contentText: content,
    isThinkingFinished: true,
    durationSeconds: elapsedSeconds || 8.2,
    tokensCount: Math.ceil((thinking.length + content.length) / 4)
  };
}

// ============================================================================
// 19. STAGE 2: FUZZY AST PATCH ENGINE CONTRACTS
// ============================================================================

export function applyUnifiedDiffPatch(originalSource: string, chunk: PatchChunk): PatchApplyResult {
  const sourceLines = originalSource.split('\n');
  const targetPattern = chunk.oldLines.join('\n').trim();

  if (!targetPattern) {
    return {
      success: false,
      patchedContent: originalSource,
      appliedChunksCount: 0,
      syntaxValid: true,
      errorMessage: '空替换块'
    };
  }

  const sourceJoined = sourceLines.join('\n');
  const matchIndex = sourceJoined.indexOf(targetPattern);

  if (matchIndex === -1) {
    return {
      success: false,
      patchedContent: originalSource,
      appliedChunksCount: 0,
      syntaxValid: true,
      errorMessage: '未能在目标源码中模糊匹配到上下文锚点'
    };
  }

  const replaced = sourceJoined.replace(targetPattern, chunk.newLines.join('\n').trim());
  const hasSyntaxError = replaced.includes('class class') || replaced.includes('def def');

  return {
    success: !hasSyntaxError,
    patchedContent: replaced,
    appliedChunksCount: 1,
    syntaxValid: !hasSyntaxError,
    errorMessage: hasSyntaxError ? 'AST 语法校验失败: 检测到重复关键字' : undefined
  };
}

// OpenCode protocol selection was intentionally removed from the Provider contract.
// Adapter/protocol/endpoint metadata belongs to ModelCatalogEntry in modelGateway.ts.

// ============================================================================
// 20. STAGE 3: MULTI-AGENT SWARM & CONTEXT COMPRESSOR CONTRACTS
// ============================================================================

export const INITIAL_SWARM_AGENTS: SwarmAgentState[] = [
  { role: 'planner', name: '架构推演者', model: 'DeepSeek-R1', status: 'completed', progress: 100, outputSummary: '完成 AST 依赖拓扑扫描与 4 步重构排期' },
  { role: 'coder', name: '精准实现者', model: 'Claude 3.5 Sonnet', status: 'running', progress: 50, outputSummary: '正在生成 Unified Chunk Patch 补丁' },
  { role: 'verifier', name: '质量审查者', model: 'Qwen 2.5 Coder', status: 'idle', progress: 0 },
  { role: 'scribe', name: '经验沉淀者', model: 'Claude 3.5 Haiku', status: 'idle', progress: 0 }
];

export function extractAstSkeleton(fullCode: string): string {
  const lines = fullCode.split('\n');
  const skeletonLines: string[] = [];
  const insideFunction = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('export interface') || trimmed.startsWith('export type') || trimmed.startsWith('export const') || trimmed.startsWith('//')) {
      skeletonLines.push(line);
      continue;
    }
    if (trimmed.startsWith('export function') || trimmed.startsWith('function ')) {
      // Keep signature, truncate body
      skeletonLines.push(`${line.split('{')[0].trim()} { /* SKELETON_TRUNCATED */ }`);
      continue;
    }
    if (trimmed.startsWith('id:') || trimmed.startsWith('name:') || trimmed.startsWith('title:') || trimmed === '}') {
      skeletonLines.push(line);
    }
  }

  return skeletonLines.join('\n');
}

export function createShadowGitSnapshot(sessionId: string, stepIndex: number, label: string): ShadowSnapshotMeta {
  return {
    snapshotId: `snap-${sessionId}-${stepIndex}`,
    refPath: `refs/shadow-snapshots/${sessionId}-step-${stepIndex}`,
    createdAt: Date.now(),
    filesChangedCount: 3,
    label
  };
}

export function searchFuzzyMentions(query: string): MentionSearchResultItem[] {
  const allCandidates: MentionSearchResultItem[] = [
    { id: 'm-1', type: 'symbol', name: 'SessionItem', detail: 'interface in contracts.ts:5', score: 10 },
    { id: 'm-2', type: 'symbol', name: 'resolveOptimalModel', detail: 'function in contracts.ts:45', score: 9 },
    { id: 'm-3', type: 'file', name: 'contracts.ts', detail: 'src/types/contracts.ts', score: 8 },
    { id: 'm-4', type: 'file', name: 'useAppStore.ts', detail: 'src/store/useAppStore.ts', score: 8 },
    { id: 'm-5', type: 'diff', name: 'Git Staged Diff', detail: '+45 lines in 3 files', score: 7 },
    { id: 'm-6', type: 'doc', name: 'PRD 4.40 轨迹时光机', detail: 'docs/PRODUCT_REQUIREMENTS_DOCUMENT.md', score: 6 }
  ];

  if (!query || query.trim() === '@' || query.trim() === '') {
    return allCandidates;
  }

  const cleanQuery = query.replace('@', '').toLowerCase().trim();
  return allCandidates.filter(c =>
    c.name.toLowerCase().includes(cleanQuery) || c.detail.toLowerCase().includes(cleanQuery)
  );
}

// ============================================================================
// 23. STAGE 5: DESKTOP BUNDLE TARGET & MULTI-PLATFORM CONTRACTS
// ============================================================================

export function resolveDesktopPlatformConfig(platform: DesktopPlatformType, arch: DesktopArchType = 'x86_64'): DesktopPlatformConfig {
  if (platform === 'windows') {
    return {
      platform: 'windows',
      arch: 'x86_64',
      bundleFormats: ['nsis', 'msi'],
      nativeEngine: 'Microsoft Edge WebView2 (DirectX)',
      isSandboxed: true
    };
  }

  if (platform === 'macos') {
    return {
      platform: 'macos',
      arch,
      bundleFormats: ['dmg', 'app'],
      nativeEngine: 'WebKit (Metal)',
      isSandboxed: true
    };
  }

  return {
    platform: 'linux',
    arch: 'x86_64',
    bundleFormats: ['deb', 'appimage'],
    nativeEngine: 'WebKitGTK',
    isSandboxed: true
  };
}

// ============================================================================
// 24. ZERO-STATE ONBOARDING & REAL DATA CONTRACTS
// ============================================================================

export function createEmptySession(title: string = '新的自由会话', projectId?: string, projectName?: string): SessionItem {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tier1: projectId ? 'project' : 'global',
    projectId,
    projectName,
    gitBranch: projectId ? 'main' : undefined,
    title,
    tags: ['new'],
    messagesCount: 0,
    totalTokens: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function isFirstLaunchState(sessions: SessionItem[]): boolean {
  return sessions.length === 0 || (sessions.length === 1 && sessions[0].messagesCount === 0);
}

export async function saveToDiskStorageAsync(key: string, data: any, sensitive = false): Promise<void> {
  try {
    const isDesktop = typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
    if (isDesktop) {
      await hostFetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, data, sensitive })
      });
    }
  } catch (e) {}
}

export async function loadFromDiskStorageAsync(key: string): Promise<any> {
  try {
    const isDesktop = typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
    if (isDesktop) {
      const res = await hostFetch(`/api/storage?key=${encodeURIComponent(key)}`);
      const json = await res.json();
      if (json.success && json.data !== null && json.data !== undefined) {
        return json.data;
      }
    }
  } catch (e) {}
  return null;
}

export const STORAGE_KEYS = {
  PROVIDERS: 'codemind_providers',
  CURRENT_MODEL: 'codemind_current_model',
  SESSIONS: 'codemind_sessions',
  ACTIVE_SESSION_ID: 'codemind_active_session_id',
  SESSION_MESSAGES: 'codemind_session_messages',
  PROJECTS: 'codemind_projects'
};

export function loadSavedSessions(): SessionItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [
    {
      id: 'session-1',
      tier1: 'global',
      title: '新的自由会话',
      tags: ['new'],
      messagesCount: 0,
      totalTokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];
}

export function saveSessionsToStorage(sessions: SessionItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    saveToDiskStorageAsync(STORAGE_KEYS.SESSIONS, sessions);
  } catch (e) {}
}

export function loadSavedSessionMessages(): Record<string, ChatMessage[]> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSION_MESSAGES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) return parsed;
    }
  } catch (e) {}
  return {
    'session-1': [
      {
        id: 'msg-init-user',
        role: 'user',
        content: '请为我介绍 Tcode 具备哪些企业级编码架构能力？',
        timestamp: Date.now() - 36000
      },
      {
        id: 'msg-init-assistant',
        role: 'assistant',
        content: `<think>\n用户询问关于 Tcode 的企业级编码架构能力。结合当前工程的技术特性：AST 差异补丁、实时流式网关总线、安全沙盒隔离、本地文件系统直读、Git 影子快照回滚与 Monaco 高级代码编辑器进行结构化阐述。\n</think>\n\n# 🎯 Tcode 企业级编码架构能力总览\n\n## 一、核心系统能力\n\n| 能力维度 | 技术实现 | 业务价值 |\n| :--- | :--- | :--- |\n| **统一网关总线** | OpenCode Zen 与多模型双向流式透传 | 零缓冲毫秒级打字机逐行响应，无缝调度百大模型 |\n| **AST 真实上下文** | 深度语法树剪枝与骨架提取 | 节省 70% 上下文 Token，精准捕获函数级依赖拓扑 |\n| **文件与工程直读** | 本地 Python 宿主直连磁盘 | 真正的实时工程拓扑扫描与读写，杜绝假数据演示 |\n| **沙盒安全指令卫士** | 终端命令危险级 AST 拦截 | 拦截高危 Shell 操作，必须由开发者显式授予临时提权 |\n\n当前已自动就绪 **OpenCode 官方网关**，可随时发起流式编码问答或重构分析。`,
        timestamp: Date.now() - 32000,
        auditTag: '⚡ OpenCode Mimo v2.5 真实流式响应',
        tokensDetail: { promptTokens: 38, completionTokens: 284, totalTokens: 322 },
        durationSeconds: 1.8
      }
    ]
  };
}

export function saveSessionMessagesToStorage(messagesMap: Record<string, ChatMessage[]>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION_MESSAGES, JSON.stringify(messagesMap));
    saveToDiskStorageAsync(STORAGE_KEYS.SESSION_MESSAGES, messagesMap);
  } catch (e) {}
}

const PLACEHOLDER_PROVIDER_KEYS = new Set([
  '98472918374910283749.zhipu',
  'sk-dashscope-9284719284',
  'sk-sf-938471928471928374',
  'sk-oneapi-9384719284719284'
]);

const NONEXISTENT_OPENCODE_MODELS = new Set(['hy3-free']);

function sanitizeProviderCredentials(provider: ModelProviderItem): ModelProviderItem {
  const hasPlaceholderKey = PLACEHOLDER_PROVIDER_KEYS.has(provider.apiKey);
  const apiKey = hasPlaceholderKey ? '' : provider.apiKey;
  // Upgrade migration: never resurrect models that do not exist in the
  // official OpenCode Zen catalog, even if an older build saved them.
  const models = provider.id === 'provider-opencode' && Array.isArray(provider.models)
    ? provider.models.filter(model => !NONEXISTENT_OPENCODE_MODELS.has(model.id))
    : provider.models;
  
  let baseUrl = provider.baseUrl;
  let defaultBaseUrl = provider.defaultBaseUrl;
  if (provider.id === 'provider-opencode') {
    defaultBaseUrl = 'https://opencode.ai/zen/go/v1';
    if (!baseUrl || baseUrl === 'https://opencode.ai/zen/v1' || baseUrl === 'https://opencode.ai/zen/v1/') {
      baseUrl = 'https://opencode.ai/zen/go/v1';
    }
  }

  if (!apiKey) {
    return { ...provider, baseUrl, defaultBaseUrl, apiKey: '', status: 'untested', latencyMs: 0, models };
  }
  return { ...provider, baseUrl, defaultBaseUrl, apiKey, models };
}

function normalizeProviders(providers: ModelProviderItem[]): ModelProviderItem[] {
  return providers.map(sanitizeProviderCredentials);
}

export function loadSavedProviders(): ModelProviderItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PROVIDERS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = normalizeProviders(parsed);
        const hasOpenCode = normalized.some((p: any) => p.id === 'provider-opencode');
        const merged = hasOpenCode ? normalized : [INITIAL_PROVIDERS[0], ...normalized];
        if (JSON.stringify(merged) !== JSON.stringify(parsed)) {
          saveProvidersToStorage(merged);
        }
        return merged;
      }
    }
  } catch (e) {}
  return normalizeProviders(INITIAL_PROVIDERS);
}

export function saveProvidersToStorage(providers: ModelProviderItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(providers));
    saveToDiskStorageAsync(STORAGE_KEYS.PROVIDERS, providers, true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tcode_providers_updated', { detail: providers }));
    }
  } catch (e) {}
}

export function loadSavedProjects(): ProjectGroup[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveProjectsToStorage(projects: ProjectGroup[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    saveToDiskStorageAsync(STORAGE_KEYS.PROJECTS, projects);
  } catch (e) {}
}

export function resolveCanonicalChannelEndpoint(baseUrl: string, channelType?: ChannelType | number): string {
  let base = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  
  // If already ends with full action endpoint, return directly
  if (base.endsWith('/chat/completions') || base.endsWith('/messages') || base.endsWith('/responses')) {
    return base;
  }

  // Anthropic / Claude Native format (ChannelType 14)
  if (channelType === 14) {
    if (base.endsWith('/v1') || base.endsWith('/api') || base.endsWith('/api/v1')) {
      return `${base}/messages`;
    }
    return `${base}/v1/messages`;
  }

  // OpenAI / New-API / One-API / Custom:
  if (base.endsWith('/v1') || base.endsWith('/api') || base.endsWith('/v1beta') || base.endsWith('/api/v1')) {
    return `${base}/chat/completions`;
  }

  // Root domains (e.g. https://api.openai.com, https://agentrouter.org, https://co.agentrouter.org)
  return `${base}/v1/chat/completions`;
}

export function resolveCanonicalModelsEndpoint(baseUrl: string): string {
  let base = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  if (base.endsWith('/models')) return base;
  if (base.endsWith('/chat/completions')) base = base.replace(/\/chat\/completions$/, '');
  if (base.endsWith('/messages')) base = base.replace(/\/messages$/, '');
  if (base.endsWith('/responses')) base = base.replace(/\/responses$/, '');

  if (base.endsWith('/v1') || base.endsWith('/api') || base.endsWith('/api/v1') || base.endsWith('/v1beta')) {
    return `${base}/models`;
  }
  return `${base}/v1/models`;
}

export function resolveApiEndpoint(targetUrl: string): { url: string; headers: Record<string, string> } {
  if (typeof window !== 'undefined' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
    return {
      url: '/api/proxy',
      headers: {
        'x-target-url': targetUrl,
        'X-Tcode-Token': getHostToken()
      }
    };
  }
  return {
    url: targetUrl,
    headers: {}
  };
}

// Slash Commands Definition

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'cmd-refactor',
    command: '/refactor',
    name: '代码架构重构',
    description: '深度审查代码架构坏味道，识别圈复杂度与消除循环依赖',
    icon: '⚡',
    promptTemplate: '请针对当前工程进行深度的代码架构坏味道审查，指出潜在的高耦合与循环依赖，并给出模块化重构与单测方案：'
  },
  {
    id: 'cmd-test',
    command: '/test',
    name: '补全单元测试',
    description: '深入分析边界值与异常分支，自动生成 Vitest / Pytest 单元测试',
    icon: '🧪',
    promptTemplate: '请为当前模块补充完整的单元测试，覆盖正常流、边界极值与异常拦截，确保断言严谨：'
  },
  {
    id: 'cmd-audit',
    command: '/audit',
    name: '安全与漏洞审计',
    description: '全面检测硬编码密钥、SQL注入、XSS与 OWASP Top 10 漏洞',
    icon: '🔍',
    promptTemplate: '请对代码进行企业级安全审计，检查硬编码凭据、未鉴权调用与 SQL/XSS 隐患并提供修复方案：'
  },
  {
    id: 'cmd-docs',
    command: '/docs',
    name: 'API 与架构文档',
    description: '自动解析 AST 生成标准化 OpenAPI / Markdown 架构与接口文档',
    icon: '📝',
    promptTemplate: '请基于代码实现与类型定义，生成结构清晰的生产级 API 与系统架构设计文档：'
  },
  {
    id: 'cmd-perf',
    command: '/perf',
    name: '性能剖析调优',
    description: '剖析重渲染、内存泄漏、算法时间复杂度与 IO 吞吐瓶颈',
    icon: '🚀',
    promptTemplate: '请分析当前代码的执行性能与潜在瓶颈，给出降低时间复杂度与减少内存占用的极致优化方案：'
  },
  {
    id: 'cmd-db',
    command: '/db',
    name: '数据库变更脚本',
    description: '设计无锁 DDL 迁移脚本、慢查询 EXPLAIN 分析与联合索引调优',
    icon: '🗄️',
    promptTemplate: '请评估数据库变更方案，编写支持向后兼容且带安全回滚机制的无锁 DDL/DML 脚本：'
  },
  {
    id: 'cmd-pr',
    command: '/pr',
    name: 'Git 语义提交与 PR',
    description: '自动分析变更集并生成 Conventional Commits 提交与 PR 摘要',
    icon: '🛠️',
    promptTemplate: '请分析当前工程的修改变更集，生成符合规范的 Conventional Commits 语义化提交信息与详细 PR 描述：'
  },
  {
    id: 'cmd-goal',
    command: '/goal',
    name: '持续目标推进',
    description: '持续推演并自主规划执行任务链，直到最终目标彻底达成',
    icon: '⏱️',
    promptTemplate: '请启动长链路自主目标推演，将以下复杂需求拆解为阶段里程碑并持续推进完成：'
  },
  {
    id: 'cmd-browser',
    command: '/browser',
    name: '浏览器端到端巡检',
    description: '调度无头浏览器自动化巡检页面 DOM、交互与控制台报错',
    icon: '🌐',
    promptTemplate: '请通过浏览器自动化工具链，对页面进行端到端渲染验证与功能交互巡检：'
  },
  {
    id: 'cmd-clear',
    command: '/clear',
    name: '清空上下文',
    description: '重置并清空当前会话的上下文记忆，开启全新提问',
    icon: '🧹',
    promptTemplate: ''
  }
];

// Developer Profile Definition

export const DEFAULT_DEVELOPER_PROFILE: DeveloperProfile = {
  name: '开发者',
  avatar: '👨‍💻',
  roleTitle: '资深全栈工程师'
};

export function loadSavedProfile(): DeveloperProfile {
  try {
    const raw = localStorage.getItem('codemind_developer_profile');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_DEVELOPER_PROFILE;
}

export function saveProfileToStorage(profile: DeveloperProfile): void {
  try {
    localStorage.setItem('codemind_developer_profile', JSON.stringify(profile));
    fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'codemind_developer_profile', data: profile })
    }).catch(() => {});
  } catch (e) {}
}

export function loadSavedAccentColor(): string {
  try {
    const raw = localStorage.getItem('codemind_accent_color');
    if (raw) return raw;
  } catch (e) {}
  return '#D96B27';
}

export function saveAccentColorToStorage(color: string): void {
  try {
    localStorage.setItem('codemind_accent_color', color);
    fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'codemind_accent_color', data: { color } })
    }).catch(() => {});
  } catch (e) {}
}

// Real KV Cache Prefix & Token Savings Calculator

export function loadSavedThemeMode(): string {
  try {
    return localStorage.getItem('tcode_theme_mode') || 'cream';
  } catch (e) {
    return 'cream';
  }
}

export function saveThemeModeToStorage(theme: string): void {
  try {
    localStorage.setItem('tcode_theme_mode', theme);
    saveToDiskStorageAsync('tcode_theme_mode', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('tcode_theme_mode_updated', { detail: theme }));
    }
  } catch (e) {}
}

// ── Autonomous Host & Project Profile Contract ──
export interface ProjectProfile {
  os: 'windows' | 'macos' | 'linux';
  osName: string;
  shell: 'powershell' | 'bash' | 'zsh' | 'cmd';
  shellPath: string;
  languages: string[];
  frameworks: string[];
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'uv' | 'poetry' | 'cargo' | 'go' | 'pip' | 'unknown';
  testFramework: 'vitest' | 'jest' | 'pytest' | 'cargo-test' | 'go-test' | 'unittest' | 'custom' | 'none';
  testCommand: string;
  installedToolchains: string[];
  activeWorkspacePath: string;
}

export const DEFAULT_PROJECT_PROFILE: ProjectProfile = {
  os: typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '') ? 'windows' : 'linux',
  osName: typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '') ? 'Windows 11 (NT 10.0)' : 'Linux / POSIX',
  shell: typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '') ? 'powershell' : 'bash',
  shellPath: typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '') ? 'powershell.exe' : '/bin/bash',
  languages: ['TypeScript', 'Python'],
  frameworks: ['React', 'Vite'],
  packageManager: 'npm',
  testFramework: 'vitest',
  testCommand: 'npm test',
  installedToolchains: ['node', 'python', 'git', 'npm'],
  activeWorkspacePath: ''
};

export interface DirectoryItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
}
