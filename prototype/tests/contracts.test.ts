import { describe, it, expect } from 'vitest';
import {
  getContextGaugeLevel,
  calculateTokenSavingsPercent,
  getWindowBreakpoint,
  addTagToSession,
  removeTagFromSession,
  renameSession,
  addProjectToWorkspace,
  AVAILABLE_MODELS,
  findModelById,
  createTerminalTab,
  closeTerminalTab,
  filterFilesByQuery,
  getProjectWorkspaceData,
  toggleSkillItem,
  updateKeybinding,
  addAttachedFile,
  removeAttachedFile,
  getActiveRules,
  toggleRuleItem,
  INITIAL_RULES,
  AttachedFile,
  RuleItem,
  INITIAL_ROLE_ROUTING,
  INITIAL_CHANNELS,
  updateModelRoleRouting,
  toggleChannelModel,
  addCustomChannel,
  GatewayChannel,
  INITIAL_PROVIDERS,
  ModelProviderItem,
  toggleProviderSwitch,
  toggleProviderModelSwitch,
  addCustomModelToProvider,
  filterProviders,
  addCustomRule,
  deleteRule,
  toggleMcpServer,
  closeEditorFile,
  INITIAL_MCP_SERVERS,
  INITIAL_OPENED_FILES,
  ProviderCategory,

  SkillItem,
  KeybindingItem,
  removeProjectFromWorkspace,
  SessionItem,
  TokenStats,
  WORK_MODE_CONFIGS,
  forkSessionFromMessage,
  filterCompilerNoise,
  ChatMessage
} from '../src/types/contracts';

describe('SDD Contract - Token Telemetry & Gauge Algorithm', () => {
  it('should evaluate context gauge levels correctly', () => {
    expect(getContextGaugeLevel(40000, 128000)).toBe('safe');
    expect(getContextGaugeLevel(80000, 128000)).toBe('warning');
    expect(getContextGaugeLevel(110000, 128000)).toBe('danger');
  });

  it('should calculate KV cache saving percentage accurately', () => {
    const stats: TokenStats = {
      promptTokens: 1200,
      completionTokens: 300,
      cacheHitTokens: 10800,
      cacheWriteTokens: 0,
      estimatedCostUsd: 0.024,
      contextCurrentTokens: 12000,
      contextMaxTokens: 128000
    };
    expect(calculateTokenSavingsPercent(stats)).toBe(90);
  });
});

describe('SDD Contract - Session Operations (Tags, Rename, Hierarchy)', () => {
  const sampleSession: SessionItem = {
    id: 's-1',
    tier1: 'project',
    title: '原标题',
    projectId: 'proj-1',
    projectName: 'agent-learning',
    tags: ['feat'],
    messagesCount: 5,
    totalTokens: 1000,
    createdAt: 1000,
    updatedAt: 1000
  };

  it('should add and remove tags properly', () => {
    const withNewTag = addTagToSession(sampleSession, '#refactor');
    expect(withNewTag.tags).toContain('refactor');
    expect(withNewTag.tags.length).toBe(2);

    const withoutTag = removeTagFromSession(withNewTag, 'feat');
    expect(withoutTag.tags).not.toContain('feat');
    expect(withoutTag.tags).toContain('refactor');
  });

  it('should rename session cleanly', () => {
    const renamed = renameSession(sampleSession, '全新架构重构');
    expect(renamed.title).toBe('全新架构重构');
  });
});

describe('SDD Contract - System Directory Selection & Workspace', () => {
  it('should add a new system directory path as a project group', () => {
    const initialProjects = [
      { id: 'proj-1', name: 'agent-learning', path: 'e:/pro/agent-learning', gitBranch: 'main', isExpanded: true }
    ];
    const { projects, newProject } = addProjectToWorkspace(initialProjects, 'D:\\dev\\my-awesome-app', 'feature/auth');
    expect(projects.length).toBe(2);
    expect(newProject.name).toBe('my-awesome-app');
    expect(newProject.path).toBe('D:/dev/my-awesome-app');
    expect(newProject.gitBranch).toBe('feature/auth');
  });

  it('should remove a project group cleanly', () => {
    const initialProjects = [
      { id: 'proj-1', name: 'agent-learning', path: 'e:/pro/agent-learning', gitBranch: 'main', isExpanded: true },
      { id: 'proj-2', name: 'my-app', path: 'd:/dev/my-app', gitBranch: 'main', isExpanded: true }
    ];
    const remaining = removeProjectFromWorkspace(initialProjects, 'proj-1');
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('proj-2');
  });
});


describe('SDD Contract - AI Model Registry & Dynamic Switching', () => {
  it('should list multiple providers including Claude, DeepSeek, and Local Ollama', () => {
    expect(AVAILABLE_MODELS.length).toBeGreaterThanOrEqual(4);
    const providers = AVAILABLE_MODELS.map(m => m.provider);
    expect(providers).toContain('Anthropic');
    expect(providers).toContain('DeepSeek');
    expect(providers).toContain('Local');
  });

  it('should find model by ID with fallback default', () => {
    const deepseek = findModelById('deepseek-v3');
    expect(deepseek.name).toBe('DeepSeek-V3');
    expect(deepseek.provider).toBe('DeepSeek');

    const fallback = findModelById('non-existent-id');
    expect(fallback.id).toBe('claude-3-5-sonnet');
  });
});


describe('SDD Contract - Multi-Terminal Tab Lifecycle', () => {
  it('should create and append new terminal tab with auto-naming', () => {
    const initialTabs = [
      { id: 'term-1', title: 'zsh (1)', shell: 'zsh' as const, logs: ['$ init'] }
    ];
    const newTab = createTerminalTab(initialTabs, 'pwsh');
    expect(newTab.title).toBe('pwsh (2)');
    expect(newTab.shell).toBe('pwsh');
    expect(newTab.logs.length).toBeGreaterThan(0);
  });

  it('should close terminal tab but preserve at least one active terminal', () => {
    const tabs = [
      { id: 'term-1', title: 'zsh (1)', shell: 'zsh' as const, logs: [] },
      { id: 'term-2', title: 'pwsh (2)', shell: 'pwsh' as const, logs: [] }
    ];
    const afterClose = closeTerminalTab(tabs, 'term-1');
    expect(afterClose.length).toBe(1);
    expect(afterClose[0].id).toBe('term-2');

    // Attempt to close the last one should keep it
    const cannotCloseLast = closeTerminalTab(afterClose, 'term-2');
    expect(cannotCloseLast.length).toBe(1);
  });
});


describe('SDD Contract - All Core Workspace Modules Logic', () => {
  it('should search files accurately by query string', () => {
    const mockFiles = [
      { path: 'src/bus/GatewayBus.ts', content: 'export class GatewayBus {\n  dispatch() {}\n}' },
      { path: 'src/types/contracts.ts', content: 'export type SessionTier1Type = "global" | "project";' }
    ];
    const results = filterFilesByQuery('GatewayBus', mockFiles);
    expect(results.length).toBe(1);
    expect(results[0].fileName).toBe('GatewayBus.ts');
    expect(results[0].matches.length).toBe(1);
    expect(results[0].matches[0].lineNumber).toBe(1);
  });

  it('should return empty array for empty search query', () => {
    const results = filterFilesByQuery('', [{ path: 'a.ts', content: 'hello' }]);
    expect(results).toEqual([]);
  });
});


describe('SDD Contract - Context-Scoped Project Linking', () => {
  it('should switch file tree and searchable files when switching active project', () => {
    const dataProj1 = getProjectWorkspaceData('proj-1');
    expect(dataProj1.projectName).toBe('agent-learning');
    expect(dataProj1.fileTree.name).toBe('agent-learning');
    expect(dataProj1.gitBranch).toBe('main');

    const dataProj2 = getProjectWorkspaceData('proj-2');
    expect(dataProj2.projectName).toBe('codemind-sdk');
    expect(dataProj2.fileTree.name).toBe('codemind-sdk');
    expect(dataProj2.gitBranch).toBe('dev');
    expect(dataProj2.searchableFiles[0].path).toBe('codemind/harness.py');
  });
});


describe('SDD Contract - Settings Modal (Skills & Keybindings)', () => {
  it('should toggle skill activation status properly', () => {
    const mockSkills: SkillItem[] = [
      { id: 'sdd-tdd', name: 'SDD-TDD', category: 'workflow', description: '测试先行', enabled: true },
      { id: 'sec-audit', name: 'SecAudit', category: 'quality', description: '安全审计', enabled: false }
    ];
    const toggled = toggleSkillItem(mockSkills, 'sec-audit');
    expect(toggled[1].enabled).toBe(true);

    const toggledBack = toggleSkillItem(toggled, 'sec-audit');
    expect(toggledBack[1].enabled).toBe(false);
  });

  it('should update keybinding cleanly', () => {
    const mockKeymaps: KeybindingItem[] = [
      { id: 'act-run', actionName: '唤醒 Act 落地', category: 'agent', currentKey: 'Ctrl+Enter', defaultKey: 'Ctrl+Enter' }
    ];
    const updated = updateKeybinding(mockKeymaps, 'act-run', 'Ctrl+Shift+Enter');
    expect(updated[0].currentKey).toBe('Ctrl+Shift+Enter');
  });
});


describe('SDD Contract - Attached Files & Rules Preloading', () => {
  it('should add and remove attached file seamlessly', () => {
    const initial: AttachedFile[] = [];
    const added = addAttachedFile(initial, { name: 'schema.sql', size: 2048, type: 'application/sql' });
    expect(added.length).toBe(1);
    expect(added[0].name).toBe('schema.sql');
    expect(added[0].size).toBe(2048);

    const removed = removeAttachedFile(added, added[0].id);
    expect(removed.length).toBe(0);
  });

  it('should filter active rules and toggle rule status', () => {
    const rules = [...INITIAL_RULES];
    expect(getActiveRules(rules).length).toBe(3);

    const toggled = toggleRuleItem(rules, 'rule-iron-triple');
    expect(getActiveRules(toggled).length).toBe(2);
    expect(toggled.find(r => r.id === 'rule-iron-triple')?.enabled).toBe(false);
  });
});


describe('SDD Contract - Industrial Model Gateway & Roles Routing', () => {
  it('should update model role assignments accurately', () => {
    const current = { ...INITIAL_ROLE_ROUTING };
    const updated = updateModelRoleRouting(current, 'planModelId', 'claude-3-7-sonnet');
    expect(updated.planModelId).toBe('claude-3-7-sonnet');
    expect(updated.actModelId).toBe('claude-3-5-sonnet');
  });

  it('should toggle channel models and add custom channels', () => {
    const channels = [...INITIAL_CHANNELS];
    const toggled = toggleChannelModel(channels, 'chan-deepseek', 'deepseek-reasoner');
    const targetModel = toggled[0].models.find(m => m.id === 'deepseek-reasoner');
    expect(targetModel?.enabled).toBe(false);

    const custom: GatewayChannel = {
      id: 'chan-siliconflow',
      name: '硅基流动 (SiliconFlow)',
      protocol: 'openai',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: 'sk-sf123456',
      status: 'healthy',
      latencyMs: 65,
      models: [{ id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3', enabled: true, contextLimit: 64000 }]
    };
    const added = addCustomChannel(toggled, custom);
    expect(added.length).toBe(5);
    expect(added[4].name).toBe('硅基流动 (SiliconFlow)');
  });
});


describe('SDD Contract - GitHub Style Model Providers Master-Detail', () => {
  it('should toggle provider overall enabled switch', () => {
    const providers = [...INITIAL_PROVIDERS];
    const initialStatus = providers.find(p => p.id === 'provider-siliconflow')?.enabled ?? false;
    const toggled = toggleProviderSwitch(providers, 'provider-siliconflow');
    expect(toggled.find(p => p.id === 'provider-siliconflow')?.enabled).toBe(!initialStatus);
  });

  it('should toggle individual model inside provider and add custom model', () => {
    const providers = [...INITIAL_PROVIDERS];
    const deepseek = toggleProviderModelSwitch(providers, 'provider-deepseek', 'deepseek-chat');
    const model = deepseek.find(p => p.id === 'provider-deepseek')?.models.find(m => m.id === 'deepseek-chat');
    expect(model?.enabled).toBe(false);

    const withCustom = addCustomModelToProvider(deepseek, 'provider-deepseek', 'deepseek-coder-33b');
    const targetProvider = withCustom.find(p => p.id === 'provider-deepseek');
    expect(targetProvider?.models.some(m => m.id === 'deepseek-coder-33b')).toBe(true);
  });

  it('should filter providers by category (domestic vs aggregator)', () => {
    const domestic = filterProviders(INITIAL_PROVIDERS, 'domestic', '');
    expect(domestic.length).toBeGreaterThanOrEqual(4);
    expect(domestic.some(p => p.id === 'provider-zhipu')).toBe(true);

    const aggregators = filterProviders(INITIAL_PROVIDERS, 'aggregator', '');
    expect(aggregators.length).toBeGreaterThanOrEqual(2);
    expect(aggregators.some(p => p.id === 'provider-oneapi')).toBe(true);
    expect(aggregators.some(p => p.id === 'provider-siliconflow')).toBe(true);
  });

});


describe('SDD Contract - All Tabs Enhanced Operations', () => {
  it('should add custom rule and delete rule cleanly', () => {
    const initialRules = [...INITIAL_RULES];
    const added = addCustomRule(initialRules, {
      title: '禁止在生产环境直接运行 drop table',
      content: 'SQL 变更必须前置生成 Dry-Run 预检报告',
      scope: 'global'
    });
    expect(added.length).toBe(initialRules.length + 1);
    expect(added[0].title).toBe('禁止在生产环境直接运行 drop table');
    expect(added[0].enabled).toBe(true);

    const deleted = deleteRule(added, added[0].id);
    expect(deleted.length).toBe(initialRules.length);
    expect(deleted.some(r => r.title === '禁止在生产环境直接运行 drop table')).toBe(false);
  });

  it('should toggle MCP server status and latency', () => {
    const servers = [...INITIAL_MCP_SERVERS];
    const target = servers[0];
    const toggled = toggleMcpServer(servers, target.id);
    const updated = toggled.find(s => s.id === target.id);
    expect(updated?.status).toBe('stopped');

    const toggledBack = toggleMcpServer(toggled, target.id);
    const updatedBack = toggledBack.find(s => s.id === target.id);
    expect(updatedBack?.status).toBe('running');
    expect(updatedBack?.latencyMs).toBeGreaterThan(0);
  });

  it('should manage multi-file editor tabs in workbench', () => {
    const files = [...INITIAL_OPENED_FILES];
    expect(files.length).toBe(2);

    const result = closeEditorFile(files, 'file-contracts');
    expect(result.remainingFiles.length).toBe(1);
    expect(result.activeFileId).toBe('file-options');
  });
});


describe('SDD Contract - DeepSeek Harness Architecture Integration', () => {
  it('should provide four complete runtime mode profiles with metadata', () => {
    expect(WORK_MODE_CONFIGS.act.name).toBe('Act 落地执行');
    expect(WORK_MODE_CONFIGS.plan.name).toBe('Plan 架构推演');
    expect(WORK_MODE_CONFIGS.minimal.name).toBe('Minimal 极简低噪');
    expect(WORK_MODE_CONFIGS.creator.name).toBe('Creator 技能造物');

    expect(WORK_MODE_CONFIGS.minimal.tokenSavingRate).toContain('立省');
  });

  it('should fork session cleanly from any historical message node', () => {
    const mockSessions: any[] = [
      { id: 'sess-1', title: '架构重构会话', totalTokens: 10000, tags: ['feat'] }
    ];
    const mockMessages: ChatMessage[] = [
      { id: 'm-1', role: 'user', content: '如何设计状态总线？', timestamp: 100 },
      { id: 'm-2', role: 'assistant', content: '推荐使用微内核插件总线。', timestamp: 200 },
      { id: 'm-3', role: 'user', content: '请帮我落地。', timestamp: 300 }
    ];

    const { updatedSessions, newSession, forkedMessages } = forkSessionFromMessage(
      mockSessions,
      mockMessages,
      'sess-1',
      'm-2',
      'fork-v1'
    );

    expect(updatedSessions.length).toBe(2);
    expect(newSession.title).toContain('(fork-v1)');
    expect(newSession.tags).toContain('fork');
    expect(forkedMessages.length).toBe(2);
    expect(forkedMessages[0].content).toBe('如何设计状态总线？');
    expect(forkedMessages[1].content).toBe('推荐使用微内核插件总线。');
  });

  it('should filter out compiler noise and wheel spinners, saving token overhead', () => {
    const rawLogs = [
      '⠋ building for production...',
      '⠙ transforming (42)...',
      '> vite build',
      'rendering chunks...',
      'computing gzip size...',
      '✓ built in 1.2s',
      'dist/index.html 0.45 kB',
      'ERROR: Type error in contracts.ts:42'
    ];

    const { cleanedLogs, suppressedLinesCount } = filterCompilerNoise(rawLogs);
    expect(suppressedLinesCount).toBe(4);
    expect(cleanedLogs).toContain('✓ built in 1.2s');
    expect(cleanedLogs).toContain('ERROR: Type error in contracts.ts:42');
  });
});
