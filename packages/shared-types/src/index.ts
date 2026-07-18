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

export interface CreateTaskInput {
  title: string;
  description?: string;
  goal: string;
  constraints?: string[];
  successCriteria?: string[];
  riskProfile?: RiskLevel;
  templateType?: TaskTemplateType;
  projectPath?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  goal?: string;
  constraints?: string[];
  successCriteria?: string[];
  riskProfile?: RiskLevel;
  templateType?: TaskTemplateType;
  projectPath?: string;
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

export type LoopRunMode = LoopRun["mode"];

export interface CreateLoopRunInput {
  taskId: string;
  mode?: LoopRunMode;
  policyId?: string;
}

export interface SessionMeta {
  sessionId: string;
  loopRunId?: string;
  threadId?: string;
  windowId?: string;
  title: string;
  sourceType: "codex_local" | "codex_app_server";
  status: string;
  projectPath?: string;
  sourcePath?: string;
  lastEventAt?: string;
}

export interface CreateSessionInput {
  loopRunId: string;
  sessionId?: string;
  threadId?: string;
  windowId?: string;
  title: string;
  sourceType?: SessionMeta["sourceType"];
  status?: string;
  projectPath?: string;
  sourcePath?: string;
  lastEventAt?: string;
}

export interface SessionEvent {
  eventId: string;
  loopRunId: string;
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CreateSessionEventInput {
  loopRunId: string;
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt?: string;
}

export type EvidenceType =
  | "last_message"
  | "tool_error"
  | "tool_result"
  | "idle_window"
  | "plan_step_match"
  | "risk_signal";

export interface Evidence {
  evidenceId: string;
  loopRunId: string;
  sessionId?: string;
  evidenceType: EvidenceType;
  sourceType: string;
  sourceRef?: string;
  snippet: string;
  confidence: number;
  relatedEventIds: string[];
  createdAt: string;
}

export interface CreateEvidenceInput {
  loopRunId: string;
  sessionId?: string;
  evidenceType: EvidenceType;
  sourceType: string;
  sourceRef?: string;
  snippet: string;
  confidence?: number;
  relatedEventIds?: string[];
  createdAt?: string;
}

export interface Decision {
  decisionId: string;
  loopRunId: string;
  decisionType: string;
  reason: string;
  riskLevel: RiskLevel;
  confidence: number;
  evidenceIds: string[];
  createdAt: string;
}

export interface CreateDecisionInput {
  loopRunId: string;
  decisionType: string;
  reason: string;
  riskLevel: RiskLevel;
  confidence?: number;
  evidenceIds?: string[];
  createdAt?: string;
}

export type ActionType =
  | "observe"
  | "suggest"
  | "resume_with_prompt"
  | "pause_loop"
  | "request_manual_takeover"
  | "mark_completed_candidate";

export interface Action {
  actionId: string;
  loopRunId: string;
  decisionId: string;
  actionType: ActionType;
  message?: string;
  status: "draft" | "pending_review" | "approved" | "rejected" | "executed" | "failed";
  requiresReview: boolean;
  reviewStatus?: "pending" | "approved" | "rejected";
  executedAt?: string;
  createdAt: string;
}

export interface CreateActionInput {
  loopRunId: string;
  decisionId: string;
  actionType: ActionType;
  message?: string;
  status?: Action["status"];
  requiresReview?: boolean;
  reviewStatus?: Action["reviewStatus"];
  executedAt?: string;
  createdAt?: string;
}

export interface Review {
  reviewId: string;
  actionId: string;
  reviewType: string;
  reviewer?: string;
  result: "pending" | "approved" | "rejected";
  comment?: string;
  createdAt: string;
}

export interface CreateReviewInput {
  actionId: string;
  reviewType: string;
  reviewer?: string;
  result?: Review["result"];
  comment?: string;
  createdAt?: string;
}
