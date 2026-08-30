import { describe, it, expect } from 'vitest';
import {
  resolveExecutionPolicy,
  migratePipelineMode,
  type ExecutionMode
} from '../src/services/executionMode';

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
