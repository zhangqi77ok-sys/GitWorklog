import { describe, it, expect } from 'vitest';
import { shouldContinueLoop } from '../src/services/agentLoop';
import type { AgentAction, TargetAcceptanceItem } from '../src/services/agentLoop';

const noActions: AgentAction[] = [];
const oneAction: AgentAction[] = [
  { id: 'a1', type: 'read_file', target: 'src/Login.tsx' } as unknown as AgentAction
];

describe('golden invariant 1 & 2 - loop convergence', () => {
  it('zero tool calls -> natural completion (chitchat single round)', () => {
    const v = shouldContinueLoop({ actions: noActions, acceptanceItems: [], loopCount: 1 });
    expect(v).toEqual({ continue: false, reason: 'natural_completion' });
  });

  it('tool calls -> tool-driven continuation', () => {
    const v = shouldContinueLoop({ actions: oneAction, acceptanceItems: [], loopCount: 1 });
    expect(v).toEqual({ continue: true, reason: 'tool_driven' });
  });

  it('acceptance items never force continuation (golden invariant 1)', () => {
    const fake = [{ id: 't1', description: '实现并验证: x', status: 'failed' } as unknown as TargetAcceptanceItem];
    const v = shouldContinueLoop({ actions: noActions, acceptanceItems: fake, loopCount: 1 });
    expect(v.reason).toBe('natural_completion');
  });

  it('max turns circuit breaker', () => {
    const v = shouldContinueLoop({ actions: oneAction, acceptanceItems: [], loopCount: 8, maxTurns: 8 });
    expect(v).toEqual({ continue: false, reason: 'max_turns' });
  });
});

import { verifyTargetAcceptance } from '../src/services/agentLoop';

describe('golden invariant 3 - acceptance items are explicit only', () => {
  it('keyword in description alone never auto-passes an item', () => {
    const items = [
      { id: 't1', description: '修改 Store 逻辑并实现完整功能', status: 'model_claimed', criteria: 'pass' }
    ] as unknown as TargetAcceptanceItem[];
    const actions = [{ id: 'a1', type: 'write_file', target: 'other.ts' }] as unknown as AgentAction[];
    const results = [
      { id: 'r1', actionId: 'a1', type: 'write_file', target: 'other.ts', status: 'success' }
    ] as unknown as Array<{ id: string; actionId: string; type: string; target: string; status: string }>;
    const updated = verifyTargetAcceptance(items, actions, results as never, []);
    expect(updated.items[0].status).toBe('model_claimed');
  });

  it('explicit target match still associates evidence and passes', () => {
    const items = [
      { id: 't1', description: '改造 src/Store.ts', status: 'model_claimed', criteria: 'pass' }
    ] as unknown as TargetAcceptanceItem[];
    const actions = [{ id: 'a1', type: 'write_file', target: 'src/Store.ts' }] as unknown as AgentAction[];
    const results = [
      { id: 'r1', actionId: 'a1', type: 'write_file', target: 'src/Store.ts', status: 'success' }
    ] as unknown as Array<{ id: string; actionId: string; type: string; target: string; status: string }>;
    const updated = verifyTargetAcceptance(items, actions, results as never, []);
    expect(updated.items[0].status).toBe('passed');
  });
});
