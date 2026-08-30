/**
 * WP-E 模块六：两阶段提交（2PC Merge Gate）。
 * collect diff patches -> 全量回归测试 -> 绿灯后才 git apply 落盘主工作区。
 */
export type MergePhase = 'collect' | 'test' | 'apply' | 'complete' | 'failed';

export interface TwoPhaseMergeState {
  phase: MergePhase;
  patches: string[];
  testPassed: boolean;
  applied: boolean;
  failedReason?: string;
}

export function createTwoPhaseMerge(): TwoPhaseMergeState {
  return { phase: 'collect', patches: [], testPassed: false, applied: false };
}

export function collectPatch(state: TwoPhaseMergeState, patch: string): TwoPhaseMergeState {
  if (state.phase !== 'collect') return state;
  return { ...state, patches: [...state.patches, patch] };
}

export function markTestsPassed(state: TwoPhaseMergeState): TwoPhaseMergeState {
  return { ...state, testPassed: true, phase: 'test' };
}

export function markTestsFailed(state: TwoPhaseMergeState, reason?: string): TwoPhaseMergeState {
  return { ...state, phase: 'failed', failedReason: reason || '回归测试未通过' };
}

/** Apply patches only when tests are green; otherwise stays in the gate. */
export function applyPatches(state: TwoPhaseMergeState): TwoPhaseMergeState {
  if (!state.testPassed) {
    return state.phase === 'failed'
      ? state
      : { ...state, phase: 'test', failedReason: '测试未绿灯，禁止落盘' };
  }
  return { ...state, applied: true, phase: 'apply' };
}

export function resolveMerge(state: TwoPhaseMergeState): TwoPhaseMergeState {
  if (state.phase === 'apply' && state.applied) {
    return { ...state, phase: 'complete' };
  }
  return state;
}
