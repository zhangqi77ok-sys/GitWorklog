import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveExecutionPolicy,
  migratePipelineMode,
  loadSavedExecutionMode,
  saveExecutionModeToStorage,
  type ExecutionMode
} from '../src/services/executionMode';

const mockStorage: Record<string, string> = {};
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
  };
}

const sddWorkflow = {
  name: 'SDD',
  blocks: [
    { name: '现状审查', allowedTools: ['read_file'], promptTemplate: 'p1' },
    { name: '契约生成', allowedTools: ['write_file'], promptTemplate: 'p2' }
  ]
};

describe('execution mode policy', () => {
  it('act -> 1-node micro loop, no stage gate, act toolset', () => {
    const p = resolveExecutionPolicy('act');
    expect(p.dagType).toBe('1-node-micro-loop');
    expect(p.enableStageGate).toBe(false);
    expect(p.allowedToolSet).toContain('write_file');
    expect(p.systemPromptDirectives).toContain('Agent Loop');
  });

  it('graph + workflow -> n-node workflow with stage gate and first-block tools', () => {
    const p = resolveExecutionPolicy('graph', 'sdd', sddWorkflow as never);
    expect(p.dagType).toBe('n-node-workflow');
    expect(p.enableStageGate).toBe(true);
    expect(p.allowedToolSet).toEqual(['read_file']);
    expect(p.systemPromptDirectives).toContain('SDD');
  });

  it('graph without template -> dynamic graph planning directives', () => {
    const p = resolveExecutionPolicy('graph');
    expect(p.dagType).toBe('n-node-workflow');
    expect(p.enableStageGate).toBe(true);
    expect(p.systemPromptDirectives).toContain('任务图谱');
    expect(p.allowedToolSet).toEqual(['read_file', 'grep_search', 'find_by_name']);
  });
});

describe('pipeline mode migration', () => {
  it('harness -> act, swarm -> graph, undefined -> act', () => {
    expect(migratePipelineMode('harness')).toBe('act');
    expect(migratePipelineMode('swarm')).toBe('graph');
    expect(migratePipelineMode(undefined)).toBe('act');
    expect(migratePipelineMode('bogus' as never)).toBe('act');
  });
});

describe('execution mode storage & migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads new key when present', () => {
    localStorage.setItem('tcode_execution_mode', 'graph');
    expect(loadSavedExecutionMode()).toBe('graph');
  });

  it('migrates legacy pipeline mode harness -> act', () => {
    localStorage.setItem('tcode_pipeline_mode', 'harness');
    expect(loadSavedExecutionMode()).toBe('act');
  });

  it('migrates legacy pipeline mode swarm -> graph', () => {
    localStorage.setItem('tcode_pipeline_mode', 'swarm');
    expect(loadSavedExecutionMode()).toBe('graph');
  });

  it('defaults to act when nothing stored', () => {
    expect(loadSavedExecutionMode()).toBe('act');
  });

  it('save writes new key', () => {
    saveExecutionModeToStorage('graph');
    expect(localStorage.getItem('tcode_execution_mode')).toBe('graph');
  });
});
