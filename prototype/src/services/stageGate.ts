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

/**
 * Build a gate suspension from a workflow block + the completed round's output.
 * Returns null for non-gate blocks (gate.mode !== 'approval' and no
 * requireUserReview legacy flag) so the loop simply continues.
 */
export function createGateSuspensionFromBlock(
  block?: { id?: string; name?: string; gate?: { mode: 'approval' | 'none' }; requireUserReview?: boolean },
  round?: { summary: string; taskBreakdown: string[]; specPath?: string },
  loopCount = 1
): GateSuspension | null {
  if (!block || !round) return null;
  if (!shouldSuspendForGate(block, true)) return null;
  return createGateSuspension({
    gateId: `${block.id || 'gate'}-${loopCount}`,
    stageName: block.name || `阶段 ${loopCount}`,
    specPath: round.specPath,
    summary: round.summary,
    taskBreakdown: round.taskBreakdown
  });
}

/**
 * Dynamic graph planning (Graph 模式未选模板): suspend after the planning round
 * (round 1, no write actions yet) so the human approves the DAG before any code
 * is written. Template workflows gate via their own gate blocks instead.
 */
export function shouldSuspendDynamicGraphPlanning(
  mode: 'act' | 'graph',
  workflowBlocksLength: number,
  loopCount: number,
  hasWriteActions: boolean
): boolean {
  return mode === 'graph' && workflowBlocksLength === 0 && loopCount === 1 && !hasWriteActions;
}

/**
 * Extract a compact task breakdown from a model round's content.
 * Recognizes '-', '□', '•' bullet/checkbox lines, capped to a max count.
 */
export function extractTaskBreakdown(content: string, maxItems = 8): string[] {
  if (!content) return [];
  const items: string[] = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    const match = line.match(/^[-□•]\s+(.+)$/);
    if (match && match[1].trim()) {
      items.push(match[1].trim());
      if (items.length >= maxItems) break;
    }
  }
  return items;
}

/**
 * Extract a spec artifact path (e.g. .codemind/specs/{id}.md) from content,
 * so the StageGateCard can offer a direct preview link.
 */
export function extractSpecPath(content: string): string | undefined {
  if (!content) return undefined;
  const match = content.match(/\.codemind\/specs\/[A-Za-z0-9._\-/]+\.md/);
  return match ? match[0] : undefined;
}
