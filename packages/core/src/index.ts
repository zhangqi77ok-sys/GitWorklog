import type { CreateLoopRunInput, CreateTaskInput, LoopRun, LoopRunStatus, Task } from "@gitworklog/shared-types";
import type { GitWorklogDatabase } from "@gitworklog/db";

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

export class LoopRuntimeService {
  constructor(private readonly store: GitWorklogDatabase) {}

  createTask(input: CreateTaskInput): Task {
    if (!input.title.trim()) {
      throw new Error("Task title is required.");
    }
    if (!input.goal.trim()) {
      throw new Error("Task goal is required.");
    }
    return this.store.tasks.create(input);
  }

  listTasks(): Task[] {
    return this.store.tasks.list();
  }

  createLoopRun(input: CreateLoopRunInput): LoopRun {
    return this.store.loopRuns.create(input);
  }

  transitionLoopRun(loopRunId: string, nextStatus: LoopRunStatus): LoopRun {
    const current = this.store.loopRuns.get(loopRunId);
    if (!current) {
      throw new Error(`LoopRun not found: ${loopRunId}`);
    }
    if (!canTransition(current.status, nextStatus)) {
      throw new Error(`Invalid LoopRun transition: ${current.status} -> ${nextStatus}`);
    }
    return this.store.loopRuns.updateStatus(loopRunId, nextStatus);
  }
}
