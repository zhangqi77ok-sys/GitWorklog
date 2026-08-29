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
  SkillItem,
  KeybindingItem,
  removeProjectFromWorkspace,
  SessionItem,
  TokenStats
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
