/**
 * Stage Gate (模块五): explicit workflow suspension at stage boundaries with
 * human-in-the-loop adjudication (approve / revise-with-feedback / terminate).
 */
export interface StageGateDecision {
  approved: boolean;
  feedback?: string;
}

export interface StageGateEvent {
  gateId: string;
  stageName: string;
  specPath?: string;
  summary: string;
  taskBreakdown: string[];
  resolve: (decision: StageGateDecision) => void;
}

export interface GateSuspension {
  active: boolean;
  gate?: StageGateEvent;
}

export interface GateDecisionOutcome {
  outcome: 'proceed' | 'revise' | 'terminate';
}

/**
 * A workflow stage suspends only when its block declares gate.mode='approval'
 * AND the stage's work is actually complete.
 */
export function shouldSuspendForGate(
  block?: { gate?: { mode: 'approval' | 'none' }; requireUserReview?: boolean },
  stageCompleted = false
): boolean {
  const wantsApproval = block?.gate?.mode === 'approval' || block?.requireUserReview === true;
  return wantsApproval && stageCompleted === true;
}

export function createGateSuspension(input: {
  gateId: string;
  stageName: string;
  specPath?: string;
  summary: string;
  taskBreakdown: string[];
}): GateSuspension {
  let decision: StageGateDecision | undefined;
  const event: StageGateEvent = {
    gateId: input.gateId,
    stageName: input.stageName,
    specPath: input.specPath,
    summary: input.summary,
    taskBreakdown: input.taskBreakdown,
    resolve: (d: StageGateDecision) => {
      decision = d;
    }
  };
  return {
    active: true,
    gate: event
  };
}

export function resolveGateDecision(decision: StageGateDecision): GateDecisionOutcome {
  if (decision.approved) return { outcome: 'proceed' };
  if (decision.feedback && decision.feedback.trim().length > 0) return { outcome: 'revise' };
  return { outcome: 'terminate' };
}
