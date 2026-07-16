export type RiskLevel = "low" | "medium" | "high";

export type TaskTemplateType =
  | "feature_delivery"
  | "bug_fix"
  | "refactor"
  | "test_repair"
  | "strict_review";

export interface Task {
  taskId: string;
  title: string;
  description?: string;
  goal: string;
  constraints: string[];
  successCriteria: string[];
  riskProfile: RiskLevel;
  templateType: TaskTemplateType;
  projectPath?: string;
  createdAt: string;
  updatedAt: string;
}

export type LoopRunStatus =
  | "initialized"
  | "binding_context"
  | "running"
  | "waiting_input"
  | "stalled"
  | "failed"
  | "needs_review"
  | "resuming"
  | "verifying"
  | "completed"
  | "aborted";

export interface LoopRun {
  loopRunId: string;
  taskId: string;
  status: LoopRunStatus;
  mode: "observe_only" | "assist_loop" | "safe_auto_loop" | "strict_review_loop";
  policyId?: string;
  startedAt: string;
  endedAt?: string;
  outcome?: string;
  summary?: string;
}

export interface SessionMeta {
  sessionId: string;
  threadId?: string;
  windowId?: string;
  title: string;
  sourceType: "codex_local" | "codex_app_server";
  status: string;
  projectPath?: string;
  lastEventAt?: string;
}
