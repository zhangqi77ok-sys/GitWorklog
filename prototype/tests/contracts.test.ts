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
  ChatMessage,
  searchMentionItems,
  acceptChangeset,
  rejectChangeset,
  togglePinnedFile,
  calculateTokenRoi,
  INITIAL_CHANGESET,
  PinnedFileItem,
  mergeForkSessionToMain,
  evaluateCommandSafety,
  INITIAL_SWARM_STAGES,
  queryRepoGraphDependencies,
  maskSensitiveText,
  unmaskSensitiveText,
  clampLeftPanelWidth,
  clampWorkbenchWidth,
  clampTerminalHeightPercent,
  appendLessonRule,
  generatePreFlightCiReport,
  splitChangesetIntoSemanticCommits,
  toggleDebugProbe,
  calculateBlastRadius,
  clampLeftPanelWithCollapse,
  createDiffNavigationTarget,
  clampChangesetHeight,
  WORKBENCH_ICON_ACTIONS,
  generatePullRequestDraft,
  MOCK_RULES_MEMORY,
  MODEL_ROUTING_STRATEGIES,
  resolveOptimalModel,
  MOCK_TRAJECTORY_STEPS,
  MOCK_TOPOLOGY_NODES
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


describe('SDD Contract - DX & PM Power Features (@Mentions, Changeset, Pinned, ROI)', () => {
  it('should fuzzy search @ mention items across files, AST symbols and git diff', () => {
    const all = searchMentionItems('');
    expect(all.length).toBeGreaterThan(3);

    const fileResults = searchMentionItems('contracts');
    expect(fileResults.length).toBeGreaterThan(0);
    expect(fileResults[0].type).toBe('file');

    const symbolResults = searchMentionItems('GatewayBus');
    expect(symbolResults.length).toBe(1);
    expect(symbolResults[0].type).toBe('symbol');

    const diffResults = searchMentionItems('git-diff');
    expect(diffResults[0].type).toBe('git-diff');
  });

  it('should accept and reject changeset cleanly', () => {
    const cs = { ...INITIAL_CHANGESET };
    expect(cs.status).toBe('pending');

    const accepted = acceptChangeset(cs);
    expect(accepted.status).toBe('accepted');

    const rejected = rejectChangeset(cs);
    expect(rejected.status).toBe('rejected');
  });

  it('should toggle pinned context files seamlessly', () => {
    const initial: PinnedFileItem[] = [];
    const pinned = togglePinnedFile(initial, { path: 'src/types/contracts.ts', name: 'contracts.ts' });
    expect(pinned.length).toBe(1);
    expect(pinned[0].name).toBe('contracts.ts');

    const unpinned = togglePinnedFile(pinned, { path: 'src/types/contracts.ts', name: 'contracts.ts' });
    expect(unpinned.length).toBe(0);
  });

  it('should calculate Token ROI and KV Cache savings accurately', () => {
    const mockStats: TokenStats = {
      promptTokens: 2400,
      completionTokens: 600,
      cacheHitTokens: 18000,
      cacheWriteTokens: 0,
      estimatedCostUsd: 0.038,
      contextCurrentTokens: 21000,
      contextMaxTokens: 128000
    };

    const roi = calculateTokenRoi(mockStats);
    expect(roi.cacheHitRatePercent).toBe(85.7);
    expect(roi.savedCostUsd).toBeGreaterThan(0.04);
    expect(roi.linesGeneratedApprox).toBe(50);
  });
});


describe('SDD Contract - Advanced 5-Killer Features (Fork Merge, Sandbox, Swarm, Graph, PII)', () => {
  it('should merge forked session cleanly into main session memory', () => {
    const sessions: SessionItem[] = [];
    const messages: ChatMessage[] = [];
    const result = mergeForkSessionToMain(sessions, messages, 'fork-001', 'session-main', '完成泛型重构并通过全部测试');
    expect(result.targetSessionId).toBe('session-main');
    expect(result.updatedMessages.length).toBe(1);
    expect(result.updatedMessages[0].content).toContain('已成功合并分叉分支 [fork-001]');
  });

  it('should evaluate command safety and block hazardous commands', () => {
    const safeRes = evaluateCommandSafety('npm test');
    expect(safeRes.level).toBe('safe');

    const warnRes = evaluateCommandSafety('npm install -g pnpm');
    expect(warnRes.level).toBe('warning');

    const blockedRes = evaluateCommandSafety('rm -rf /var/data');
    expect(blockedRes.level).toBe('blocked');
    expect(blockedRes.reason).toBeDefined();
  });

  it('should verify Multi-Agent Swarm stages sequence and roles', () => {
    expect(INITIAL_SWARM_STAGES.length).toBe(3);
    expect(INITIAL_SWARM_STAGES[0].role).toBe('architect');
    expect(INITIAL_SWARM_STAGES[1].role).toBe('coder');
    expect(INITIAL_SWARM_STAGES[2].role).toBe('tester');
  });

  it('should query repo graph dependency topology accurately', () => {
    const deps = queryRepoGraphDependencies('UserService');
    expect(deps.length).toBeGreaterThan(0);
    const names = deps.map(d => d.name);
    expect(names).toContain('UserService');
    expect(names).toContain('UserController');
  });

  it('should mask and unmask sensitive PII tokens cleanly', () => {
    const raw = 'Connect to postgres://root:supersecret123@db.com with key sk-abcdef1234567890xyz';
    const { maskedText, mapping } = maskSensitiveText(raw);
    expect(maskedText).toContain('[SEC_DB_PASS_2]');
    expect(maskedText).toContain('[SEC_API_KEY_1]');
    expect(maskedText).not.toContain('supersecret123');
    expect(maskedText).not.toContain('sk-abcdef1234567890xyz');

    const restored = unmaskSensitiveText(maskedText, mapping);
    expect(restored).toBe(raw);
  });
});


describe('SDD Contract - Fluid Resizable Layout Bounds', () => {
  it('should clamp left panel width within 180px and 420px', () => {
    expect(clampLeftPanelWidth(100)).toBe(180);
    expect(clampLeftPanelWidth(260)).toBe(260);
    expect(clampLeftPanelWidth(500)).toBe(420);
  });

  it('should clamp workbench width within 320px and 65% container width', () => {
    expect(clampWorkbenchWidth(200, 1440)).toBe(320);
    expect(clampWorkbenchWidth(500, 1440)).toBe(500);
    expect(clampWorkbenchWidth(1200, 1440)).toBe(1440 * 0.65);
  });

  it('should clamp terminal height percent within 20% and 80%', () => {
    expect(clampTerminalHeightPercent(10)).toBe(20);
    expect(clampTerminalHeightPercent(45)).toBe(45);
    expect(clampTerminalHeightPercent(95)).toBe(80);
  });
});


describe('SDD Contract - Senior Dev Production Features', () => {
  it('should append lessons rule and persist properly', () => {
    const res = appendLessonRule([], {
      category: 'architecture',
      title: '禁止直接 new 实例化服务',
      ruleContent: '必须通过 ServiceFactory 获取单例',
      source: 'user_correction'
    });
    expect(res.updatedRules.length).toBe(1);
    expect(res.addedRule.appliedCount).toBe(1);
    expect(res.addedRule.source).toBe('user_correction');
  });

  it('should generate pre-flight CI report with delta and pass gate', () => {
    const report = generatePreFlightCiReport(true, 88.4, 85.2);
    expect(report.status).toBe('passed');
    expect(report.lineCoverageDelta).toBe(3.2);
    expect(report.allowPush).toBe(true);
  });

  it('should split changeset into semantic Conventional Commits', () => {
    const files = [
      { path: 'src/types/contracts.ts' },
      { path: 'tests/contracts.test.ts' },
      { path: 'src/components/ChatColumn.tsx' }
    ];
    const commits = splitChangesetIntoSemanticCommits(files);
    expect(commits.length).toBe(3);
    expect(commits[0].type).toBe('feat');
    expect(commits[1].type).toBe('test');
    expect(commits[2].type).toBe('refactor');
  });

  it('should toggle dynamic debug probes on line numbers', () => {
    let probes: any[] = [];
    probes = toggleDebugProbe(probes, 'file-contracts', 14, 'solveGeneric');
    expect(probes.length).toBe(1);
    expect(probes[0].line).toBe(14);
    probes = toggleDebugProbe(probes, 'file-contracts', 14);
    expect(probes.length).toBe(0);
  });

  it('should calculate Monorepo blast radius for core contracts', () => {
    const blast = calculateBlastRadius('src/types/contracts.ts');
    expect(blast.sourcePackage).toContain('packages/core');
    expect(blast.totalAffectedCallsites).toBe(7);
  });
});


describe('SDD Contract - UX & Logic Polish', () => {
  it('should snap left panel to 0 if width < 80px, otherwise clamp between 180px and 420px', () => {
    expect(clampLeftPanelWithCollapse(50)).toBe(0);
    expect(clampLeftPanelWithCollapse(0)).toBe(0);
    expect(clampLeftPanelWithCollapse(120)).toBe(180);
    expect(clampLeftPanelWithCollapse(300)).toBe(300);
    expect(clampLeftPanelWithCollapse(500)).toBe(420);
  });

  it('should generate valid Diff navigation target payload', () => {
    const target = createDiffNavigationTarget('file-options', 'src/components/OptionsCard.tsx', 12);
    expect(target.fileId).toBe('file-options');
    expect(target.filePath).toBe('src/components/OptionsCard.tsx');
    expect(target.targetLine).toBe(12);
  });
});


describe('SDD Contract - Changeset Resizable & Collapsible Card', () => {
  it('should clamp changeset height within 80px and 450px', () => {
    expect(clampChangesetHeight(40)).toBe(80);
    expect(clampChangesetHeight(150)).toBe(150);
    expect(clampChangesetHeight(600)).toBe(450);
  });
});


describe('SDD Contract - Workbench Icon-Only Toolbar', () => {
  it('should define exactly 4 compact icon actions with rich tooltips', () => {
    expect(WORKBENCH_ICON_ACTIONS.length).toBe(4);
    const blast = WORKBENCH_ICON_ACTIONS.find(a => a.id === 'blast-radius');
    expect(blast?.tooltipTitle).toContain('波及分析');
    expect(blast?.badgeText).toBe('3');
  });
});


describe('SDD Contract - Pull Request Draft & Rules Cockpit', () => {
  it('should generate a comprehensive structured PR draft', () => {
    const draft = generatePullRequestDraft('fork-refactor-store', '重构三栏自适应流体布局', '扩展现有全局 Store');
    expect(draft.targetBranch).toBe('main');
    expect(draft.title).toContain('重构三栏自适应流体布局');
    expect(draft.decisionLog).toContain('扩展现有全局 Store');
    expect(draft.ciPassProof.coverage).toBe('88.4% Line Coverage (Vitest Pass)');
  });

  it('should contain initial rules memory items including iron laws and lessons', () => {
    expect(MOCK_RULES_MEMORY.length).toBeGreaterThanOrEqual(4);
    const ironLaw = MOCK_RULES_MEMORY.find(r => r.category === 'iron_law');
    expect(ironLaw?.title).toContain('三大铁律');
  });
});


describe('SDD Contract - 3 Production Pillars (Router, Trajectory, Graph)', () => {
  it('should auto-resolve optimal model based on prompt keywords and strategy', () => {
    const resArch = resolveOptimalModel('请帮我做架构重构推演', 'auto');
    expect(resArch.modelName).toBe('DeepSeek-R1');

    const resTest = resolveOptimalModel('运行 vitest 编写测试', 'auto');
    expect(resTest.modelName).toBe('Qwen 2.5 Coder');

    const resForced = resolveOptimalModel('任何输入', 'max_reasoning');
    expect(resForced.modelName).toBe('DeepSeek-R1');
  });

  it('should validate mock trajectory steps sequence', () => {
    expect(MOCK_TRAJECTORY_STEPS.length).toBe(4);
    expect(MOCK_TRAJECTORY_STEPS[0].status).toBe('completed');
    expect(MOCK_TRAJECTORY_STEPS[1].status).toBe('in_progress');
  });

  it('should validate topology graph nodes and impact status', () => {
    expect(MOCK_TOPOLOGY_NODES.length).toBe(4);
    const webNode = MOCK_TOPOLOGY_NODES.find(n => n.id === 'pkg-web');
    expect(webNode?.status).toBe('impacted');
    expect(webNode?.impactCount).toBe(3);
  });
});


import { desktopBridge } from '../src/services/desktopBridge';

describe('Production Bridge - Tauri & Web Dual-Mode IPC Gateways', () => {
  it('should get AST tree nodes deterministically', async () => {
    const nodes = await desktopBridge.getAstTree('contracts.ts');
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes[0].name).toBe('SessionItem');
    expect(nodes[0].kind).toBe('interface');
  });

  it('should intercept dangerous shell commands without sudo', async () => {
    const resForbidden = await desktopBridge.executeSandboxCommand('rm -rf /', false);
    expect(resForbidden.isSandboxIntercepted).toBe(true);
    expect(resForbidden.exitCode).toBe(1);

    const resAllowed = await desktopBridge.executeSandboxCommand('npm test', false);
    expect(resAllowed.isSandboxIntercepted).toBe(false);
    expect(resAllowed.exitCode).toBe(0);
  });

  it('should allow dangerous command when sudo is explicitly granted', async () => {
    const resSudo = await desktopBridge.executeSandboxCommand('rm -rf /', true);
    expect(resSudo.isSandboxIntercepted).toBe(false);
    expect(resSudo.exitCode).toBe(0);
  });

  it('should generate preflight CI report with 88.4% coverage pass', async () => {
    const report = await desktopBridge.checkPreflightCi();
    expect(report.status).toBe('passed');
    expect(report.allowPush).toBe(true);
    expect(report.lineCoverage).toBe(88.4);
    expect(report.tsErrorsCount).toBe(0);
  });
});


import { extractThinkingFromText, applyUnifiedDiffPatch } from '../src/types/contracts';
import { storageEngine } from '../src/services/storageEngine';
import { defaultPatchEngine } from '../src/services/astPatchEngine';

describe('Stage 2 Engine - SSE Streaming & Thinking Block Extraction', () => {
  it('should parse completed thinking stream cleanly', () => {
    const raw = '<think>\n分析依赖关系并规划 AST 补丁\n</think>\n已完成重构。';
    const payload = extractThinkingFromText(raw, 5.4);
    expect(payload.isThinkingFinished).toBe(true);
    expect(payload.thinkingText).toBe('分析依赖关系并规划 AST 补丁');
    expect(payload.contentText).toBe('已完成重构。');
    expect(payload.durationSeconds).toBe(5.4);
  });

  it('should handle ongoing thinking state', () => {
    const raw = '<think>\n正在推演第 3 个边缘情况...';
    const payload = extractThinkingFromText(raw, 2.1);
    expect(payload.isThinkingFinished).toBe(false);
    expect(payload.thinkingText).toBe('正在推演第 3 个边缘情况...');
    expect(payload.contentText).toBe('');
  });

  it('should return pure content if no think tags present', () => {
    const raw = '直接返回代码实现结果。';
    const payload = extractThinkingFromText(raw, 0.5);
    expect(payload.isThinkingFinished).toBe(true);
    expect(payload.thinkingText).toBe('');
    expect(payload.contentText).toBe(raw);
  });
});

describe('Stage 2 Engine - Fuzzy AST Unified Chunk Patching', () => {
  it('should apply patch chunk with exact context matching', () => {
    const source = `function calculateTotal(items) {\n  return items.reduce((acc, x) => acc + x.price, 0);\n}`;
    const chunk = {
      oldStart: 1,
      oldLines: ['function calculateTotal(items) {', '  return items.reduce((acc, x) => acc + x.price, 0);', '}'],
      newLines: ['function calculateTotal(items: CartItem[]): number {', '  return items.reduce((acc, x) => acc + x.price, 0);', '}']
    };

    const res = applyUnifiedDiffPatch(source, chunk);
    expect(res.success).toBe(true);
    expect(res.syntaxValid).toBe(true);
    expect(res.patchedContent).toContain('CartItem[]');
  });

  it('should reject patch if target chunk pattern does not match', () => {
    const source = `const x = 10;`;
    const chunk = {
      oldStart: 1,
      oldLines: ['non_existent_function()'],
      newLines: ['new_code()']
    };

    const res = applyUnifiedDiffPatch(source, chunk);
    expect(res.success).toBe(false);
    expect(res.appliedChunksCount).toBe(0);
    expect(res.errorMessage).toBe('未能在目标源码中模糊匹配到上下文锚点');
  });

  it('should validate AST syntax and detect duplicate keywords', () => {
    const validRes = defaultPatchEngine.validateAstSyntax('export function test() { return 1; }');
    expect(validRes.valid).toBe(true);
    expect(validRes.errors.length).toBe(0);

    const invalidRes = defaultPatchEngine.validateAstSyntax('export class class MyClass {}');
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.errors).toContain('检测到重复关键字声明 (Duplicate Keyword)');
  });
});

describe('Stage 2 Engine - Local Atomic Storage Persistence', () => {
  it('should save and load typed data reliably', () => {
    const dummyKey = 'test_session_backup';
    const testData = { id: 'sess-999', title: 'Backup Test' };

    const saveOk = storageEngine.save(dummyKey, testData);
    expect(saveOk).toBe(true);

    const loaded = storageEngine.load(dummyKey, null);
    expect(loaded).toEqual(testData);

    storageEngine.remove(dummyKey);
    const loadedAfterRemove = storageEngine.load(dummyKey, { fallback: true });
    expect(loadedAfterRemove).toEqual({ fallback: true });
  });
});


import { buildOpenAiRequestPayload, DEFAULT_OPENAI_PROTOCOL } from '../src/types/contracts';

describe('OpenAI Protocol Selection - Responses API vs Chat Completions', () => {
  it('should default to Responses API protocol', () => {
    expect(DEFAULT_OPENAI_PROTOCOL).toBe('responses');
  });

  it('should build correct payload for Responses API (/v1/responses)', () => {
    const payload = buildOpenAiRequestPayload('gpt-4o', '重构 Store 契约', 'responses');
    expect(payload.endpointPath).toBe('/v1/responses');
    expect(payload.body.model).toBe('gpt-4o');
    expect(payload.body.input).toBe('重构 Store 契约');
  });

  it('should build correct payload for Chat Completions (/v1/chat/completions)', () => {
    const payload = buildOpenAiRequestPayload('gpt-4o', '重构 Store 契约', 'chat_completions');
    expect(payload.endpointPath).toBe('/v1/chat/completions');
    expect(payload.body.model).toBe('gpt-4o');
    expect(Array.isArray(payload.body.messages)).toBe(true);
    expect(payload.body.messages).toEqual([{ role: 'user', content: '重构 Store 契约' }]);
  });
});


import { extractAstSkeleton, redactSensitivePii, unredactSensitivePii, INITIAL_SWARM_AGENTS } from '../src/types/contracts';
import { defaultSwarmManager } from '../src/services/swarmPipeline';
import { defaultContextCompressor } from '../src/services/contextCompressor';

describe('Stage 3 - Multi-Agent Swarm Pipeline Management', () => {
  it('should initialize 4 swarm agent roles correctly', () => {
    expect(INITIAL_SWARM_AGENTS.length).toBe(4);
    expect(INITIAL_SWARM_AGENTS[0].role).toBe('planner');
    expect(INITIAL_SWARM_AGENTS[1].role).toBe('coder');
    expect(INITIAL_SWARM_AGENTS[2].role).toBe('verifier');
    expect(INITIAL_SWARM_AGENTS[3].role).toBe('scribe');
  });

  it('should advance swarm stages sequentially', () => {
    const agents = defaultSwarmManager.advanceStage();
    expect(agents[1].status).toBe('completed');
    expect(agents[2].status).toBe('running');
  });
});

describe('Stage 3 - AST Context Skeleton Compressor', () => {
  it('should extract AST interface and types while pruning implementation body', () => {
    const fullCode = `export interface User {\n  id: string;\n  name: string;\n}\n\nexport function processUserData(u: User) {\n  const x = 100;\n  for(let i=0; i<10; i++) {\n    console.log(i);\n  }\n  return u.name;\n}`;
    const skeleton = extractAstSkeleton(fullCode);
    expect(skeleton).toContain('export interface User');
    expect(skeleton).toContain('id: string;');
    expect(skeleton).toContain('/* SKELETON_TRUNCATED */');
    expect(skeleton).not.toContain('console.log(i)');
  });

  it('should calculate Token saving percentage correctly', () => {
    const files = [
      { path: 'test.ts', content: 'export interface Cart { id: string; }\nexport function run() { let a = 1; let b = 2; let c = 3; return a+b+c; }' }
    ];
    const res = defaultContextCompressor.compressFiles(files);
    expect(res.savingPercentage).toBeGreaterThanOrEqual(0);
    expect(res.compressedPrompt).toContain('SKELETON_TRUNCATED');
  });
});

describe('Stage 3 - Offline Security Shield & PII Redactor', () => {
  it('should mask API Keys and GitHub tokens into secure placeholders', () => {
    const rawPrompt = '连接数据库使用 postgres://admin:secret12345@db.internal:5432/main，秘钥是 sk-proj-1234567890abcdef1234567890 和 ghp_12345678901234567890123456789012';
    const result = redactSensitivePii(rawPrompt);
    expect(result.redactedSecretsCount).toBe(3);
    expect(result.redactedText).toContain('<REDACTED_DBPASS_');
    expect(result.redactedText).toContain('<REDACTED_APIKEY_');
    expect(result.redactedText).toContain('<REDACTED_GHTOKEN_');
    expect(result.redactedText).not.toContain('secret12345');
    expect(result.redactedText).not.toContain('sk-proj-');

    const restored = unredactSensitivePii(result.redactedText, result.secretMap);
    expect(restored).toBe(rawPrompt);
  });
});


import {
  evaluateSandboxCommandSafety,
  createShadowGitSnapshot,
  searchFuzzyMentions
} from '../src/types/contracts';
import { defaultSandboxGuard } from '../src/services/sandboxGuard';
import { defaultShadowSnapshotEngine } from '../src/services/shadowSnapshotEngine';

describe('Stage 4 - Terminal AST Sandbox Command Guard', () => {
  it('should intercept hazardous commands and mark as requiring sudo', () => {
    const check1 = evaluateSandboxCommandSafety('rm -rf /');
    expect(check1.isSafe).toBe(false);
    expect(check1.requiresSudo).toBe(true);
    expect(check1.hazardReason).toContain('根目录递归删除');

    const check2 = evaluateSandboxCommandSafety('DROP DATABASE production;');
    expect(check2.isSafe).toBe(false);
    expect(check2.requiresSudo).toBe(true);
  });

  it('should pass normal safe development commands', () => {
    const checkSafe = evaluateSandboxCommandSafety('npm run test && git status');
    expect(checkSafe.isSafe).toBe(true);
    expect(checkSafe.requiresSudo).toBe(false);
  });

  it('should allow hazardous command once granted temporary sudo', () => {
    const cmd = 'rm -rf ./dist';
    defaultSandboxGuard.grantTemporarySudo(cmd);
    const check = defaultSandboxGuard.checkCommand(cmd);
    expect(check.isSafe).toBe(true);
    expect(check.requiresSudo).toBe(false);
  });
});

describe('Stage 4 - Git Shadow Snapshots & Auto-Healing', () => {
  it('should generate valid shadow ref snapshot metadata', () => {
    const snap = createShadowGitSnapshot('sess-100', 3, '重构完成前快照');
    expect(snap.snapshotId).toBe('snap-sess-100-3');
    expect(snap.refPath).toContain('refs/shadow-snapshots/sess-100-step-3');
    expect(snap.filesChangedCount).toBe(3);
  });

  it('should capture and rollback snapshots reliably in engine', () => {
    const snap = defaultShadowSnapshotEngine.captureSnapshot('sess-200', 1, '初始化快照');
    const ok = defaultShadowSnapshotEngine.rollbackToSnapshot(snap.snapshotId);
    expect(ok).toBe(true);

    const fail = defaultShadowSnapshotEngine.rollbackToSnapshot('non_existent_id');
    expect(fail).toBe(false);
  });
});

describe('Stage 4 - Fuzzy @Mention Context Search Engine', () => {
  it('should search mention symbols and files accurately', () => {
    const res = searchFuzzyMentions('@Session');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].name).toBe('SessionItem');
    expect(res[0].type).toBe('symbol');

    const resFiles = searchFuzzyMentions('@store');
    expect(resFiles.some(r => r.name.includes('Store'))).toBe(true);
  });
});
