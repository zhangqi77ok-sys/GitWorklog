// CodeMind-Hub 核心接口规范契约 (SDD Contract)

export type SessionTier1Type = 'global' | 'project';

export interface SessionItem {
  id: string;
  tier1: SessionTier1Type;
  title: string;
  projectId?: string;
  projectName?: string;
  projectPath?: string;
  gitBranch?: string;
  filePath?: string;
  lineRange?: [number, number];
  tags: string[];
  messagesCount: number;
  totalTokens: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectGroup {
  id: string;
  name: string;
  path: string;
  gitBranch: string;
  isExpanded: boolean;
}

export interface TokenStats {
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
  contextCurrentTokens: number;
  contextMaxTokens: number;
}

export type ContextGaugeLevel = 'safe' | 'warning' | 'danger';

export function getContextGaugeLevel(current: number, max: number): ContextGaugeLevel {
  if (max <= 0) return 'safe';
  const ratio = current / max;
  if (ratio >= 0.8) return 'danger';
  if (ratio >= 0.6) return 'warning';
  return 'safe';
}

export function calculateTokenSavingsPercent(stats: TokenStats): number {
  const total = stats.promptTokens + stats.cacheHitTokens;
  if (total <= 0) return 0;
  return Math.round((stats.cacheHitTokens / total) * 1000) / 10;
}

export interface AskOptionItem {
  id: string;
  label: string;
  description?: string;
  isRecommended?: boolean;
}

export interface AskOptionsPayload {
  id: string;
  question: string;
  single_select: boolean;
  options: AskOptionItem[];
  allow_custom_input?: boolean;
  resolvedSelection?: string[];
  customInput?: string;
  status: 'pending' | 'resolved';
}

export type PermissionPolicy = 'strict_approval' | 'autonomous_agent' | 'risk_adaptive';

export type WorkMode = 'plan' | 'act';

export interface TaskPlanStep {
  id: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timeTaken?: string;
}

export interface TaskPlan {
  id: string;
  title: string;
  steps: TaskPlanStep[];
  activeStepIndex: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  optionsPayload?: AskOptionsPayload;
  taskPlan?: TaskPlan;
  auditTag?: string;
  tokensUsed?: number;
}

export type WindowBreakpoint = 'ultrawide' | 'standard' | 'laptop' | 'split_half';

export function getWindowBreakpoint(width: number): WindowBreakpoint {
  if (width >= 2000) return 'ultrawide';
  if (width >= 1400) return 'standard';
  if (width >= 1000) return 'laptop';
  return 'split_half';
}

// Session Tree Operations
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
export interface AIModelOption {
  id: string;
  name: string;
  provider: 'Anthropic' | 'DeepSeek' | 'OpenAI' | 'Local';
  contextLimit: number;
  inputPricePerM: number;
  outputPricePerM: number;
  badge?: string;
  description?: string;
}

export const AVAILABLE_MODELS: AIModelOption[] = [
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

export function findModelById(id: string): AIModelOption {
  return AVAILABLE_MODELS.find(m => m.id === id) || AVAILABLE_MODELS[0];
}


// Terminal Management Contract
export interface TerminalTab {
  id: string;
  title: string;
  shell: 'zsh' | 'pwsh' | 'bash' | 'node';
  logs: string[];
}

export function createTerminalTab(existing: TerminalTab[], shell: 'zsh' | 'pwsh' | 'bash' = 'zsh'): TerminalTab {
  const num = existing.length + 1;
  return {
    id: `term-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    title: `${shell} (${num})`,
    shell,
    logs: [`$ Terminal #${num} ready (${shell})`, `$ npm test --watch`]
  };
}

export function closeTerminalTab(existing: TerminalTab[], tabId: string): TerminalTab[] {
  if (existing.length <= 1) return existing;
  return existing.filter(t => t.id !== tabId);
}


// File Explorer Contract
export interface FileNode {
  id: string;
  name: string;
  path?: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
  isExpanded?: boolean;
}

// Global Search Contract
export interface SearchMatch {
  lineNumber: number;
  lineContent: string;
  matchRange: [number, number];
}

export interface SearchResultFile {
  filePath: string;
  fileName: string;
  matches: SearchMatch[];
}

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
export interface GitFileChange {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
  additions: number;
  deletions: number;
}

export interface ShadowSnapshotItem {
  id: string;
  timestamp: number;
  label: string;
  gitCommitHash: string;
  changedFilesCount: number;
  isAiGenerated: boolean;
}

// Gateway & MCP Contract
export interface ProviderHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'offline';
  latencyMs: number;
  endpoint: string;
  activeModel: string;
}

export interface McpServerInfo {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
  toolsCount: number;
  tools: string[];
}

// Settings Contract
export interface SystemSettings {
  airGappedMode: boolean;
  dailyTokenLimit: number;
  contextWarnRatio: number;
  defaultPermission: PermissionPolicy;
  theme: 'cream' | 'dark_charcoal' | 'system';
}


// Contextual Scoping Data & Helpers
export interface ProjectWorkspaceData {
  projectId: string;
  projectName: string;
  gitBranch: string;
  fileTree: FileNode;
  searchableFiles: Array<{ path: string; content: string }>;
  gitChanges: GitFileChange[];
  snapshots: ShadowSnapshotItem[];
}

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
      { path: 'codemind/harness.py', content: 'class CodeMindHarness:\n    def run_tests(self): pass' },
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
export interface SkillItem {
  id: string;
  name: string;
  category: 'workflow' | 'architecture' | 'quality' | 'tools';
  description: string;
  enabled: boolean;
  slashCommand?: string;
}

export interface KeybindingItem {
  id: string;
  actionName: string;
  category: 'chat' | 'editor' | 'navigation' | 'agent';
  currentKey: string;
  defaultKey: string;
}

export interface AccentColorOption {
  id: string;
  name: string;
  hex: string;
  bgSubtle: string;
}

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
export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataPreview?: string;
}

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

export interface RuleItem {
  id: string;
  title: string;
  scope: 'global' | 'project';
  content: string;
  enabled: boolean;
  priority: number;
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
export interface ModelRoleRouting {
  planModelId: string;
  actModelId: string;
  inlineModelId: string;
  fallbackModelId: string;
}

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

export interface GatewayModelItem {
  id: string;
  name: string;
  enabled: boolean;
  contextLimit: number;
}

export interface GatewayChannel {
  id: string;
  name: string;
  protocol: 'openai' | 'anthropic' | 'ollama';
  baseUrl: string;
  apiKey: string;
  status: 'healthy' | 'error' | 'untested';
  latencyMs: number;
  models: GatewayModelItem[];
}

export const INITIAL_CHANNELS: GatewayChannel[] = [
  {
    id: 'chan-deepseek',
    name: 'DeepSeek 官方渠道 (百炼推理)',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-dsk984729104810284729103847',
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
    apiKey: 'sk-ant938471928471928471928374',
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
    apiKey: 'sk-proj-938471928471928471928374',
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


// GitHub Benchmark Model Provider Contracts (Cherry Studio / LobeChat Master-Detail Style)
export interface ModelItem {
  id: string;
  name: string;
  enabled: boolean;
  contextLimit: number;
  capabilities: string[];
}

export interface ModelProviderItem {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  protocol: 'openai' | 'anthropic' | 'ollama';
  baseUrl: string;
  defaultBaseUrl: string;
  apiKey: string;
  status: 'healthy' | 'error' | 'untested';
  latencyMs: number;
  docUrl?: string;
  models: ModelItem[];
}

export const INITIAL_PROVIDERS: ModelProviderItem[] = [
  {
    id: 'provider-deepseek',
    name: 'DeepSeek (深度求索)',
    icon: '🔵',
    enabled: true,
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-dsk984729104810284729103847',
    status: 'healthy',
    latencyMs: 85,
    docUrl: 'https://platform.deepseek.com',
    models: [
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (深度推理)', enabled: true, contextLimit: 64000, capabilities: ['reasoning', 'code'] },
      { id: 'deepseek-chat', name: 'DeepSeek-V3 (主力代码)', enabled: true, contextLimit: 64000, capabilities: ['fast', 'code'] }
    ]
  },
  {
    id: 'provider-anthropic',
    name: 'Anthropic (Claude)',
    icon: '🟣',
    enabled: true,
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    apiKey: 'sk-ant938471928471928471928374',
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
    enabled: true,
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-proj-938471928471928471928374',
    status: 'healthy',
    latencyMs: 142,
    docUrl: 'https://platform.openai.com',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (全能多模态)', enabled: true, contextLimit: 128000, capabilities: ['vision', 'code'] },
      { id: 'o3-mini', name: 'o3-mini (深度推理)', enabled: true, contextLimit: 128000, capabilities: ['reasoning', 'code'] }
    ]
  },
  {
    id: 'provider-ollama',
    name: '本地私有 Ollama',
    icon: '🦙',
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
    id: 'provider-siliconflow',
    name: '硅基流动 (SiliconFlow)',
    icon: '⚡',
    enabled: false,
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: '',
    status: 'untested',
    latencyMs: 0,
    docUrl: 'https://siliconflow.cn',
    models: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3 (云端加速)', enabled: false, contextLimit: 64000, capabilities: ['fast', 'code'] }
    ]
  }
];

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
