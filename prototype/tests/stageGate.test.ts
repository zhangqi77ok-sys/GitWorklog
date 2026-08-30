import { describe, it, expect } from 'vitest';
import {
  shouldSuspendForGate,
  createGateSuspension,
  createGateSuspensionFromBlock,
  resolveGateDecision,
  extractTaskBreakdown,
  extractSpecPath,
  shouldSuspendDynamicGraphPlanning
} from '../src/services/stageGate';

describe('stage gate - suspension predicate', () => {
  it('suspends when block gate is approval and stage completed', () => {
    expect(shouldSuspendForGate({ gate: { mode: 'approval' } }, true)).toBe(true);
  });

  it('does not suspend when gate is none or stage incomplete', () => {
    expect(shouldSuspendForGate({ gate: { mode: 'none' } }, true)).toBe(false);
    expect(shouldSuspendForGate({ gate: { mode: 'approval' } }, false)).toBe(false);
    expect(shouldSuspendForGate(undefined, true)).toBe(false);
  });

  it('suspends when block uses legacy requireUserReview flag', () => {
    expect(shouldSuspendForGate({ requireUserReview: true }, true)).toBe(true);
    expect(shouldSuspendForGate({ requireUserReview: true }, false)).toBe(false);
  });
});

describe('stage gate - suspension state machine', () => {
  it('creates an active suspension with resolvable decision', () => {
    const gate = createGateSuspension({
      gateId: 'g1',
      stageName: '契约生成',
      summary: '方案终审',
      taskBreakdown: ['写 spec', '定义接口']
    });
    expect(gate.active).toBe(true);
    expect(gate.gate?.gateId).toBe('g1');
    expect(gate.gate?.taskBreakdown).toHaveLength(2);
    expect(typeof gate.gate?.resolve).toBe('function');
  });

  it('approved decision resolves without throwing and keeps suspension active', () => {
    const gate = createGateSuspension({
      gateId: 'g1',
      stageName: '契约生成',
      summary: '方案终审',
      taskBreakdown: []
    });
    expect(() => gate.gate?.resolve({ approved: true })).not.toThrow();
    expect(gate.active).toBe(true);
  });

  it('resolveGateDecision maps approve/feedback/terminate outcomes', () => {
    expect(resolveGateDecision({ approved: true }).outcome).toBe('proceed');
    expect(resolveGateDecision({ approved: false, feedback: '再想想' }).outcome).toBe('revise');
    expect(resolveGateDecision({ approved: false }).outcome).toBe('terminate');
  });
});

describe('stage gate - createGateSuspensionFromBlock', () => {
  const gateBlock = { id: 'b-gate', name: '用户方案确认门禁', requireUserReview: true };
  const normalBlock = { id: 'b-code', name: '代码落地', gate: { mode: 'none' as const } };

  it('creates an active suspension from a gate block with round payload', () => {
    const gate = createGateSuspensionFromBlock(gateBlock, {
      summary: '方案总览',
      taskBreakdown: ['任务 1', '任务 2'],
      specPath: '.codemind/specs/abc.md'
    }, 3);
    expect(gate).not.toBeNull();
    expect(gate!.active).toBe(true);
    expect(gate!.gate?.gateId).toBe('b-gate-3');
    expect(gate!.gate?.stageName).toBe('用户方案确认门禁');
    expect(gate!.gate?.specPath).toBe('.codemind/specs/abc.md');
    expect(gate!.gate?.taskBreakdown).toEqual(['任务 1', '任务 2']);
    expect(gate!.gate?.summary).toBe('方案总览');
  });

  it('returns null for non-gate blocks', () => {
    expect(createGateSuspensionFromBlock(normalBlock, { summary: 's', taskBreakdown: [] }, 1)).toBeNull();
    expect(createGateSuspensionFromBlock(undefined, { summary: 's', taskBreakdown: [] }, 1)).toBeNull();
  });

  it('handles empty taskBreakdown edge case', () => {
    const gate = createGateSuspensionFromBlock(gateBlock, { summary: 's', taskBreakdown: [] }, 2);
    expect(gate).not.toBeNull();
    expect(gate!.gate?.taskBreakdown).toEqual([]);
  });
});

describe('stage gate - dynamic graph planning suspension', () => {
  it('suspends on round 1 in graph mode without template and no write actions', () => {
    expect(shouldSuspendDynamicGraphPlanning('graph', 0, 1, false)).toBe(true);
  });

  it('does not suspend in act mode, with template, later rounds, or when writing already', () => {
    expect(shouldSuspendDynamicGraphPlanning('act', 0, 1, false)).toBe(false);
    expect(shouldSuspendDynamicGraphPlanning('graph', 2, 1, false)).toBe(false);
    expect(shouldSuspendDynamicGraphPlanning('graph', 0, 2, false)).toBe(false);
    expect(shouldSuspendDynamicGraphPlanning('graph', 0, 1, true)).toBe(false);
  });
});

describe('stage gate - content extraction helpers', () => {
  it('extractTaskBreakdown pulls bullet/checkbox lines with a cap', () => {
    const content = [
      '## 方案',
      '- 任务一：接入胶囊',
      '□ 任务二：门禁挂起',
      '• 任务三：全量回归',
      '普通行不提取',
      '- 任务四：打包验收'
    ].join('\n');
    const items = extractTaskBreakdown(content, 3);
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('任务一');
    expect(items[2]).toContain('任务三');
  });

  it('extractTaskBreakdown returns empty for plain content', () => {
    expect(extractTaskBreakdown('这是普通回复，没有清单', 5)).toEqual([]);
    expect(extractTaskBreakdown('', 5)).toEqual([]);
  });

  it('extractSpecPath finds .codemind/specs paths', () => {
    expect(extractSpecPath('见 .codemind/specs/abc123.md 文档')).toBe('.codemind/specs/abc123.md');
    expect(extractSpecPath('无 spec 引用')).toBeUndefined();
  });
});
