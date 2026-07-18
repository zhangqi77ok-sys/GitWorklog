import { homedir } from "node:os";
import { join } from "node:path";

import { CodexLocalConnector, type DiscoveredSession, type SessionConnector } from "@gitworklog/connectors";
import { LoopRuntimeService } from "@gitworklog/core";
import { DATABASE_FILE_NAME, openGitWorklogDatabase, type GitWorklogDatabase } from "@gitworklog/db";
import { DEFAULT_POLICIES } from "@gitworklog/policy";
import type {
  Action,
  CreateLoopRunInput,
  CreateSessionEventInput,
  CreateTaskInput,
  Decision,
  Evidence,
  LoopRun,
  Review,
  SessionEvent,
  SessionMeta,
  Task,
} from "@gitworklog/shared-types";

export interface DesktopAppServiceOptions {
  databasePath?: string;
  connector?: SessionConnector;
}

export interface CreateTaskAndRunInput {
  task: CreateTaskInput;
  loopRun?: Omit<CreateLoopRunInput, "taskId">;
}

export interface TaskListItem {
  task: Task;
  latestLoopRun?: LoopRun;
}

export interface BindDiscoveredSessionInput {
  loopRunId: string;
  session: DiscoveredSession;
}

export interface IngestSessionEventsInput {
  loopRunId: string;
  sessionId: string;
  limit?: number;
}

export interface LoopRunSnapshot {
  task: Task;
  loopRun: LoopRun;
  sessions: SessionMeta[];
  sessionEvents: SessionEvent[];
  evidences: Evidence[];
  decisions: Decision[];
  actions: Action[];
  pendingReviews: Review[];
}

export interface ReviewDecisionInput {
  reviewId: string;
  reviewer?: string;
  comment?: string;
}

export class DesktopAppService {
  private readonly runtime: LoopRuntimeService;

  constructor(
    private readonly store: GitWorklogDatabase,
    private readonly connector: SessionConnector = new CodexLocalConnector(),
  ) {
    this.runtime = new LoopRuntimeService(store);
  }

  createTaskAndRun(input: CreateTaskAndRunInput): { task: Task; loopRun: LoopRun } {
    const task = this.runtime.createTask(input.task);
    const loopRun = this.runtime.createLoopRun({
      taskId: task.taskId,
      mode: input.loopRun?.mode,
      policyId: input.loopRun?.policyId ?? DEFAULT_POLICIES[1]?.policyId,
    });
    return { task, loopRun };
  }

  listTasks(): TaskListItem[] {
    return this.runtime.listTasks().map((task) => ({
      task,
      latestLoopRun: this.store.loopRuns.listByTask(task.taskId)[0],
    }));
  }

  discoverSessions(): Promise<DiscoveredSession[]> {
    return this.connector.discoverSessions();
  }

  bindDiscoveredSession(input: BindDiscoveredSessionInput): SessionMeta {
    const loopRun = this.requireLoopRun(input.loopRunId);
    return this.store.sessions.upsert({
      loopRunId: loopRun.loopRunId,
      sessionId: input.session.sessionId,
      threadId: input.session.threadId,
      title: input.session.title,
      sourceType: "codex_local",
      status: "bound",
      projectPath: input.session.projectPath,
      sourcePath: input.session.sourcePath,
      lastEventAt: input.session.lastEventAt,
    });
  }

  async ingestSessionEvents(input: IngestSessionEventsInput): Promise<{ importedCount: number }> {
    this.requireLoopRun(input.loopRunId);
    const session = this.store.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }
    if (session.loopRunId !== input.loopRunId) {
      throw new Error(`Session ${input.sessionId} is not bound to LoopRun ${input.loopRunId}`);
    }
    if (!session.sourcePath || !this.connector.readSessionEvents) {
      return { importedCount: 0 };
    }

    const events = await this.connector.readSessionEvents(
      {
        sessionId: session.sessionId,
        threadId: session.threadId,
        title: session.title,
        projectPath: session.projectPath,
        sourcePath: session.sourcePath,
        lastEventAt: session.lastEventAt,
      },
      input.limit,
    );

    let importedCount = 0;
    for (const event of events) {
      const created = this.store.sessionEvents.createIfNotExists({
        loopRunId: input.loopRunId,
        sessionId: session.sessionId,
        eventType: event.eventType,
        payload: event.payload,
        createdAt: event.createdAt,
      });
      if (created) {
        importedCount += 1;
      }
    }
    this.store.sessions.updateStatus(session.sessionId, normalizeSessionStatus(events, session.status));

    return { importedCount };
  }

  appendSessionEvent(input: CreateSessionEventInput) {
    this.requireLoopRun(input.loopRunId);
    const session = this.store.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }
    if (session.loopRunId !== input.loopRunId) {
      throw new Error(`Session ${input.sessionId} is not bound to LoopRun ${input.loopRunId}`);
    }
    return this.store.sessionEvents.create(input);
  }

  runAnalysis(loopRunId: string): { decisionId: string; actionId: string; requiresReview: boolean } {
    this.requireLoopRun(loopRunId);
    return this.runtime.analyzeLoopRun(loopRunId);
  }

  getLoopRunSnapshot(loopRunId: string): LoopRunSnapshot {
    const loopRun = this.requireLoopRun(loopRunId);
    const task = this.store.tasks.get(loopRun.taskId);
    if (!task) {
      throw new Error(`Task not found: ${loopRun.taskId}`);
    }

    const actions = this.store.actions.listByLoopRun(loopRunId);
    return {
      task,
      loopRun,
      sessions: this.store.sessions.listByLoopRun(loopRunId),
      sessionEvents: this.store.sessionEvents.listByLoopRun(loopRunId),
      evidences: this.store.evidences.listByLoopRun(loopRunId),
      decisions: this.store.decisions.listByLoopRun(loopRunId),
      actions,
      pendingReviews: actions.flatMap((action) =>
        this.store.reviews.listByAction(action.actionId).filter((review) => review.result === "pending"),
      ),
    };
  }

  listPendingReviews(): Review[] {
    return this.store.reviews.listPending();
  }

  approveReview(input: ReviewDecisionInput): Review {
    return this.decideReview(input, "approved");
  }

  rejectReview(input: ReviewDecisionInput): Review {
    return this.decideReview(input, "rejected");
  }

  close(): void {
    this.store.close();
  }

  private decideReview(input: ReviewDecisionInput, result: "approved" | "rejected"): Review {
    const review = this.store.reviews.updateResult(input.reviewId, {
      result,
      reviewer: input.reviewer,
      comment: input.comment,
    });
    this.store.actions.updateReviewResult(review.actionId, result);
    return review;
  }

  private requireLoopRun(loopRunId: string): LoopRun {
    const loopRun = this.store.loopRuns.get(loopRunId);
    if (!loopRun) {
      throw new Error(`LoopRun not found: ${loopRunId}`);
    }
    return loopRun;
  }
}

function normalizeSessionStatus(
  events: Array<{ eventType: string; payload: Record<string, unknown> }>,
  fallback: string,
): string {
  if (events.some(isFailureEvent)) {
    return "failed";
  }
  return events.length ? "running" : fallback;
}

function isFailureEvent(event: { eventType: string; payload: Record<string, unknown> }): boolean {
  if (["tool_error", "error", "exception"].includes(event.eventType)) {
    return true;
  }

  const exitCode = event.payload.exitCode;
  return typeof exitCode === "number" && exitCode !== 0;
}

export function createDesktopAppService(options: DesktopAppServiceOptions = {}): DesktopAppService {
  const databasePath = options.databasePath ?? join(homedir(), ".gitworklog", DATABASE_FILE_NAME);
  return new DesktopAppService(openGitWorklogDatabase(databasePath), options.connector);
}
