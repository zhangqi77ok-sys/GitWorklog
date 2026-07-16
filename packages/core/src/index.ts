export const LOOP_RUNTIME_STATES = [
  "initialized",
  "binding_context",
  "running",
  "waiting_input",
  "stalled",
  "failed",
  "needs_review",
  "resuming",
  "verifying",
  "completed",
  "aborted",
] as const;

export type LoopRuntimeState = (typeof LOOP_RUNTIME_STATES)[number];

export interface StateTransition {
  from: LoopRuntimeState;
  to: LoopRuntimeState;
  reason: string;
}

export function canTransition(from: LoopRuntimeState, to: LoopRuntimeState): boolean {
  if (from === to) {
    return true;
  }

  const transitions: Record<LoopRuntimeState, LoopRuntimeState[]> = {
    initialized: ["binding_context", "aborted"],
    binding_context: ["running", "aborted"],
    running: ["waiting_input", "stalled", "failed", "needs_review", "verifying", "aborted"],
    waiting_input: ["running", "needs_review", "aborted"],
    stalled: ["running", "needs_review", "aborted"],
    failed: ["resuming", "needs_review", "aborted"],
    needs_review: ["running", "resuming", "verifying", "aborted"],
    resuming: ["running", "failed", "needs_review", "aborted"],
    verifying: ["completed", "running", "needs_review", "aborted"],
    completed: [],
    aborted: [],
  };

  return transitions[from].includes(to);
}
