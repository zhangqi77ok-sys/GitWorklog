import type { CreateLoopRunInput, CreateTaskInput, LoopRun, LoopRunStatus, Task } from "@gitworklog/shared-types";
import type { GitWorklogDatabase } from "@gitworklog/db";
import { buildResumePrompt } from "@gitworklog/action-engine";
import { analyzeErrors, analyzeProgress, analyzeRisk, type AnalyzerEvent } from "@gitworklog/analyzers";
import { DEFAULT_POLICIES, evaluateReviewGate } from "@gitworklog/policy";

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

  analyzeLoopRun(loopRunId: string): { decisionId: string; actionId: string; requiresReview: boolean } {
    const loopRun = this.store.loopRuns.get(loopRunId);
    if (!loopRun) {
      throw new Error(`LoopRun not found: ${loopRunId}`);
    }

    const task = this.store.tasks.get(loopRun.taskId);
    if (!task) {
      throw new Error(`Task not found for LoopRun: ${loopRun.taskId}`);
    }

    const sessions = this.store.sessions.listByLoopRun(loopRunId);
    const events = sessions.flatMap((session) =>
      this.store.sessionEvents.listBySession(session.sessionId).map((event) => ({
        eventId: event.eventId,
        eventType: event.eventType,
        payload: event.payload,
        createdAt: event.createdAt,
        sessionId: session.sessionId,
      })),
    );

    const analyzerEvents: AnalyzerEvent[] = events.map((event) => ({
      eventType: event.eventType,
      payload: event.payload,
      createdAt: event.createdAt,
    }));

    const errorAnalysis = analyzeErrors(analyzerEvents);
    const progressAnalysis = analyzeProgress(analyzerEvents);
    const riskAnalysis = analyzeRisk({
      text: analyzerEvents.map((event) => JSON.stringify(event.payload)).join("\n"),
    });
    const primaryResult = riskAnalysis.blocked
      ? riskAnalysis.result
      : errorAnalysis.failed
        ? errorAnalysis.result
        : progressAnalysis.stalled
          ? progressAnalysis.result
          : progressAnalysis.result;

    const evidences = primaryResult.evidence.map((snippet) =>
      this.store.evidences.create({
        loopRunId,
        sessionId: events[0]?.sessionId,
        evidenceType: riskAnalysis.blocked ? "risk_signal" : errorAnalysis.failed ? "tool_error" : "idle_window",
        sourceType: primaryResult.analyzerId,
        snippet,
        confidence: primaryResult.riskLevel === "high" ? 0.85 : 0.65,
        relatedEventIds: events.map((event) => event.eventId),
      }),
    );

    const decision = this.store.decisions.create({
      loopRunId,
      decisionType: riskAnalysis.blocked
        ? "request_manual_takeover"
        : errorAnalysis.failed || progressAnalysis.stalled
          ? "suggest_resume"
          : "observe",
      reason: primaryResult.summary,
      riskLevel: riskAnalysis.riskLevel === "high" ? "high" : primaryResult.riskLevel,
      confidence: riskAnalysis.blocked ? 0.85 : 0.65,
      evidenceIds: evidences.map((evidence) => evidence.evidenceId),
    });

    const policy = DEFAULT_POLICIES.find((item) => item.policyId === loopRun.policyId) ?? DEFAULT_POLICIES[1]!;
    const gate = evaluateReviewGate({
      policy,
      riskLevel: decision.riskLevel,
      autoResumeCount: this.store.actions
        .listByLoopRun(loopRunId)
        .filter((action) => action.actionType === "resume_with_prompt").length,
      actionType: decision.decisionType === "suggest_resume" ? "resume_with_prompt" : "suggest",
    });

    const message = buildResumePrompt({
      currentTask: task.title,
      stopReason: decision.reason,
      evidenceSummary: primaryResult.evidence.join("\n") || "No concrete evidence attached yet.",
      nextAction: gate.requiresReview ? "请人工审核后再继续。" : "请优先处理当前阻塞点并补充验证结果。",
    });

    const action = this.store.actions.create({
      loopRunId,
      decisionId: decision.decisionId,
      actionType: gate.allowed ? "resume_with_prompt" : "suggest",
      message,
      requiresReview: gate.requiresReview,
      reviewStatus: gate.requiresReview ? "pending" : undefined,
    });

    if (gate.requiresReview) {
      this.store.reviews.create({
        actionId: action.actionId,
        reviewType: "manual_gate",
        result: "pending",
        comment: gate.reason,
      });
    }

    return {
      decisionId: decision.decisionId,
      actionId: action.actionId,
      requiresReview: action.requiresReview,
    };
  }
}
