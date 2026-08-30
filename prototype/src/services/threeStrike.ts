/**
 * Three-strike circuit breaker (死循环熔断 · 三振出局) pure logic.
 * A stalled round (no real progress) increments the strike count; real
 * progress resets it. At STRIKE_LIMIT consecutive stalls the loop must
 * stop and offer revert-to-healthy-snapshot plus human adjudication.
 */
export const STRIKE_LIMIT = 3;

export interface StrikeState {
  consecutiveStalls: number;
  totalRounds?: number;
}

export interface StrikeVerdict {
  strike: number;
  verdict: 'retry' | 'strikeout';
  suggestedActions?: Array<{ id: string; label: string }>;
}

export function advanceStrike(prev: StrikeState, madeProgress: boolean): StrikeState {
  return {
    consecutiveStalls: madeProgress ? 0 : (prev.consecutiveStalls || 0) + 1,
    totalRounds: (prev.totalRounds || 0) + 1
  };
}

export function evaluateStrikeout(state: StrikeState): StrikeVerdict {
  const strike = state.consecutiveStalls;
  if (strike >= STRIKE_LIMIT) {
    return {
      strike,
      verdict: 'strikeout',
      suggestedActions: [
        { id: 'revert_to_snapshot', label: '↩ 回退到最近健康快照' },
        { id: 'try_new_approach', label: '🔄 换一种架构方案' },
        { id: 'continue_anyway', label: '▶ 强制继续尝试' }
      ]
    };
  }
  return { strike, verdict: 'retry' };
}
