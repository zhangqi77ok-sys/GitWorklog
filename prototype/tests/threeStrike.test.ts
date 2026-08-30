import { describe, it, expect } from 'vitest';

import { advanceStrike, evaluateStrikeout, STRIKE_LIMIT } from '../src/services/threeStrike';



describe('three-strike circuit breaker (pure logic)', () => {

  it('resets strike count on real progress', () => {

    const s1 = advanceStrike({ consecutiveStalls: 2 }, true);

    expect(s1.consecutiveStalls).toBe(0);

    expect(s1.totalRounds).toBe(1);

  });



  it('increments strike count on stalled round', () => {

    const s1 = advanceStrike({ consecutiveStalls: 0 }, false);

    expect(s1.consecutiveStalls).toBe(1);

    const s2 = advanceStrike(s1, false);

    expect(s2.consecutiveStalls).toBe(2);

  });



  it('verdict is retry below the strike limit', () => {

    expect(evaluateStrikeout({ consecutiveStalls: 0, totalRounds: 1 }).verdict).toBe('retry');

    expect(evaluateStrikeout({ consecutiveStalls: 2, totalRounds: 2 }).verdict).toBe('retry');

    expect(STRIKE_LIMIT).toBe(3);

  });



  it('verdict is strikeout at the limit and offers revert-to-snapshot', () => {

    const verdict = evaluateStrikeout({ consecutiveStalls: 3, totalRounds: 3 });

    expect(verdict.verdict).toBe('strikeout');

    expect(verdict.strike).toBe(3);

    const ids = (verdict.suggestedActions || []).map(a => a.id);

    expect(ids).toContain('revert_to_snapshot');

    expect(ids).toContain('try_new_approach');

    expect(ids).toContain('continue_anyway');

  });



  it('stays strikeout beyond the limit', () => {

    expect(evaluateStrikeout({ consecutiveStalls: 5, totalRounds: 5 }).verdict).toBe('strikeout');

  });

});




import { verifyTargetAcceptance, type ProgressVector } from '../src/services/agentLoop';

import type { TargetAcceptanceItem, ActionResult } from '../src/types/contracts';
import type { AgentAction } from '../src/services/agentLoop';



describe('three-strike integration with verifier', () => {

  it('returns strikeout status + revert suggestion at strikeout flag', () => {

    const items: TargetAcceptanceItem[] = [

      { id: 't1', description: '???', status: 'failed', criteria: 'pass' } as TargetAcceptanceItem

    ];

    const actions: AgentAction[] = [

      { id: 'a1', tool: 'write_file', target: 'x.test.ts', code: 'npm test' } as unknown as AgentAction

    ];

    const results: ActionResult[] = [

      { id: 'r1', actionId: 'a1', type: 'run_command', target: 'x.test.ts', exitCode: 1, stdout: 'FAIL', stderr: '' } as unknown as ActionResult

    ];

    const stall: ProgressVector[] = [

      { stepIndex: 0, phase: 'fix', actionFingerprints: ['a'], passedCount: 0, failedCount: 1 },

      { stepIndex: 0, phase: 'fix', actionFingerprints: ['a'], passedCount: 0, failedCount: 1 },

      { stepIndex: 0, phase: 'fix', actionFingerprints: ['a'], passedCount: 0, failedCount: 1 },

    ];

    const verdict = verifyTargetAcceptance(items, actions, results, stall, true);

    expect(verdict.status).toBe('strikeout');

    const ids = (verdict.suggestedActions || []).map(a => a.id);

    expect(ids).toContain('revert_to_snapshot');

  });



  it('returns no_progress without revert when strikeout flag is false', () => {

    const items: TargetAcceptanceItem[] = [];

    const stall: ProgressVector[] = [

      { stepIndex: 0, phase: 'fix', actionFingerprints: ['a'], passedCount: 0, failedCount: 1 },

      { stepIndex: 0, phase: 'fix', actionFingerprints: ['a'], passedCount: 0, failedCount: 1 },

      { stepIndex: 0, phase: 'fix', actionFingerprints: ['a'], passedCount: 0, failedCount: 1 },

    ];

    const verdict = verifyTargetAcceptance(items, [], [], stall, false);

    expect(verdict.status).toBe('no_progress');

    const ids = (verdict.suggestedActions || []).map(a => a.id);

    expect(ids).not.toContain('revert_to_snapshot');

  });

});