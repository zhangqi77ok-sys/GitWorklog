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
