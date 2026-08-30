import { describe, it, expect } from 'vitest';
import {
  shouldSuspendForGate,
  createGateSuspension,
  resolveGateDecision
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
