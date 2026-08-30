import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSavedWorkflows,
  saveWorkflowsToStorage,
  getActiveWorkflow,
  setActiveWorkflowId,
  getActiveWorkflowId,
  getWorkflowPromptDirectives,
  getWorkflowAllowedTools,
  DEFAULT_BLOCK_PALETTE,
  INITIAL_MODULAR_WORKFLOWS,
  ModularWorkflow
} from '../src/services/workflowStore';

describe('Modular Lego Workflows & Execution Engine', () => {
  beforeEach(() => {
    saveWorkflowsToStorage(JSON.parse(JSON.stringify(INITIAL_MODULAR_WORKFLOWS)));
    setActiveWorkflowId('hybrid-sdd-tdd');
  });

  it('loads initial workflows with valid block stacks', () => {
    const list = loadSavedWorkflows();
    expect(list.length).toBeGreaterThanOrEqual(4);
    
    const sdd = list.find(w => w.id === 'sdd-workflow');
    expect(sdd).toBeDefined();
    expect(sdd?.blocks.length).toBe(4);
    expect(sdd?.blocks[0].type).toBe('inspect');
    expect(sdd?.blocks[1].type).toBe('spec');
    expect(sdd?.blocks[2].type).toBe('gate-user');
    expect(sdd?.blocks[3].type).toBe('code');
  });

  it('sets and retrieves the active workflow correctly', () => {
    setActiveWorkflowId('tdd-workflow');
    expect(getActiveWorkflowId()).toBe('tdd-workflow');
    
    const active = getActiveWorkflow();
    expect(active.id).toBe('tdd-workflow');
    expect(active.name).toContain('TDD');
  });

  it('generates step-accurate prompt injection based on active block', () => {
    const active = getActiveWorkflow(); // hybrid-sdd-tdd
    
    // Step 0: inspect
    const prompt0 = getWorkflowPromptDirectives(active, 0);
    expect(prompt0).toContain('SDD + TDD · 完整闭环工作流');
    expect(prompt0).toContain('代码现状与依赖探查');
    expect(prompt0).toContain('严禁在此阶段直接修改任何源码');

    // Step 1: spec
    const prompt1 = getWorkflowPromptDirectives(active, 1);
    expect(prompt1).toContain('Spec 契约与原型生成');
    expect(prompt1).toContain('.codemind/specs/{id}.md');

    // Step 2: gate-user
    const prompt2 = getWorkflowPromptDirectives(active, 2);
    expect(prompt2).toContain('用户方案确认门禁');
  });

  it('enforces allowed tool restrictions per block step', () => {
    const active = getActiveWorkflow(); // hybrid-sdd-tdd
    
    // Step 0 (inspect) only allows read_file
    const tools0 = getWorkflowAllowedTools(active, 0);
    expect(tools0).toEqual(['read_file']);
    expect(tools0).not.toContain('write_file');

    // Step 4 (code) allows write_file & run_command
    const tools4 = getWorkflowAllowedTools(active, 4);
    expect(tools4).toContain('write_file');
    expect(tools4).toContain('run_command');
  });

  it('supports adding custom blocks and saving modified workflow pipeline', () => {
    const list = loadSavedWorkflows();
    const custom: ModularWorkflow = {
      id: 'custom-refactor-wf',
      name: '🔧 深度重构工作流',
      icon: '🔧',
      description: '先探查现状，再执行重构与回归测试',
      category: 'custom',
      enabled: true,
      isDefault: false,
      blocks: [
        { id: 'b-1', ...DEFAULT_BLOCK_PALETTE['inspect'] },
        { id: 'b-2', ...DEFAULT_BLOCK_PALETTE['test-run'] },
        { id: 'b-3', ...DEFAULT_BLOCK_PALETTE['code'] }
      ]
    };

    list.push(custom);
    saveWorkflowsToStorage(list);

    setActiveWorkflowId('custom-refactor-wf');
    const loaded = getActiveWorkflow();
    expect(loaded.id).toBe('custom-refactor-wf');
    expect(loaded.blocks.length).toBe(3);
  });

  it('supports deselecting back to normal/none mode when clicking the active workflow again', () => {
    setActiveWorkflowId('sdd-workflow');
    expect(getActiveWorkflow().id).toBe('sdd-workflow');

    // Deselect to normal
    setActiveWorkflowId('normal');
    const normal = getActiveWorkflow();
    expect(normal.id).toBe('normal');
    expect(normal.blocks.length).toBe(0);

    // Normal mode generates no stage directives
    const directives = getWorkflowPromptDirectives(normal, 0);
    expect(directives).toBe('');
  });
});
