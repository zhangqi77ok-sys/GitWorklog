import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  CreateLoopRunInput,
  Action,
  CreateActionInput,
  CreateDecisionInput,
  CreateEvidenceInput,
  CreateReviewInput,
  CreateTaskInput,
  CreateSessionEventInput,
  CreateSessionInput,
  Decision,
  Evidence,
  LoopRun,
  LoopRunStatus,
  Review,
  SessionEvent,
  SessionMeta,
  Task,
  UpdateTaskInput,
} from "@gitworklog/shared-types";

export const DATABASE_FILE_NAME = "gitworklog-loop-v1.sqlite3";

export const CORE_TABLES = [
  "tasks",
  "loop_runs",
  "sessions",
  "thread_contexts",
  "document_bindings",
  "plan_steps",
  "session_events",
  "evidences",
  "decisions",
  "actions",
  "reviews",
  "policies",
  "rules",
  "feedbacks",
] as const;

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  goal TEXT NOT NULL,
  constraints_json TEXT NOT NULL DEFAULT '[]',
  success_criteria_json TEXT NOT NULL DEFAULT '[]',
  risk_profile TEXT NOT NULL DEFAULT 'medium',
  template_type TEXT NOT NULL DEFAULT 'feature_delivery',
  project_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loop_runs (
  loop_run_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'assist_loop',
  policy_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  outcome TEXT,
  summary TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  loop_run_id TEXT NOT NULL,
  thread_id TEXT,
  window_id TEXT,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'codex_local',
  status TEXT NOT NULL,
  project_path TEXT,
  source_path TEXT,
  last_event_at TEXT,
  FOREIGN KEY (loop_run_id) REFERENCES loop_runs(loop_run_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS thread_contexts (
  loop_run_id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  constraints_json TEXT NOT NULL DEFAULT '[]',
  success_criteria_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 1,
  FOREIGN KEY (loop_run_id) REFERENCES loop_runs(loop_run_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_bindings (
  binding_id TEXT PRIMARY KEY,
  loop_run_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  source_path TEXT NOT NULL,
  version TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (loop_run_id) REFERENCES loop_runs(loop_run_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plan_steps (
  plan_step_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  related_files_json TEXT NOT NULL DEFAULT '[]',
  depends_on_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_events (
  event_id TEXT PRIMARY KEY,
  loop_run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (loop_run_id) REFERENCES loop_runs(loop_run_id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidences (
  evidence_id TEXT PRIMARY KEY,
  loop_run_id TEXT NOT NULL,
  session_id TEXT,
  evidence_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  snippet TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  related_event_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (loop_run_id) REFERENCES loop_runs(loop_run_id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  decision_id TEXT PRIMARY KEY,
  loop_run_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  confidence REAL NOT NULL,
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (loop_run_id) REFERENCES loop_runs(loop_run_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS actions (
  action_id TEXT PRIMARY KEY,
  loop_run_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL,
  requires_review INTEGER NOT NULL DEFAULT 0,
  review_status TEXT,
  executed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (loop_run_id) REFERENCES loop_runs(loop_run_id) ON DELETE CASCADE,
  FOREIGN KEY (decision_id) REFERENCES decisions(decision_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  review_type TEXT NOT NULL,
  reviewer TEXT,
  result TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (action_id) REFERENCES actions(action_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS policies (
  policy_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  risk_threshold TEXT NOT NULL,
  auto_resume_enabled INTEGER NOT NULL DEFAULT 0,
  auto_resume_limit INTEGER NOT NULL DEFAULT 0,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0,
  requires_review_on_high_risk INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rules (
  rule_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  condition_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (policy_id) REFERENCES policies(policy_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedbacks (
  feedback_id TEXT PRIMARY KEY,
  loop_run_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (loop_run_id) REFERENCES loop_runs(loop_run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_loop_runs_task_id ON loop_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_sessions_loop_run_id ON sessions(loop_run_id);
CREATE INDEX IF NOT EXISTS idx_session_events_loop_run_id ON session_events(loop_run_id);
CREATE INDEX IF NOT EXISTS idx_evidences_loop_run_id ON evidences(loop_run_id);
CREATE INDEX IF NOT EXISTS idx_decisions_loop_run_id ON decisions(loop_run_id);
CREATE INDEX IF NOT EXISTS idx_actions_loop_run_id ON actions(loop_run_id);
`;

type TaskRow = {
  task_id: string;
  title: string;
  description: string | null;
  goal: string;
  constraints_json: string;
  success_criteria_json: string;
  risk_profile: Task["riskProfile"];
  template_type: Task["templateType"];
  project_path: string | null;
  created_at: string;
  updated_at: string;
};

type LoopRunRow = {
  loop_run_id: string;
  task_id: string;
  status: LoopRunStatus;
  mode: LoopRun["mode"];
  policy_id: string | null;
  started_at: string;
  ended_at: string | null;
  outcome: string | null;
  summary: string | null;
};

export interface GitWorklogDatabase {
  database: DatabaseSync;
  close(): void;
  tasks: TaskRepository;
  loopRuns: LoopRunRepository;
  sessions: SessionRepository;
  sessionEvents: SessionEventRepository;
  evidences: EvidenceRepository;
  decisions: DecisionRepository;
  actions: ActionRepository;
  reviews: ReviewRepository;
}

export function openGitWorklogDatabase(path = ":memory:"): GitWorklogDatabase {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const database = new DatabaseSync(path);
  database.exec(SCHEMA_SQL);
  ensureColumn(database, "sessions", "source_path", "TEXT");

  return {
    database,
    close: () => database.close(),
    tasks: new TaskRepository(database),
    loopRuns: new LoopRunRepository(database),
    sessions: new SessionRepository(database),
    sessionEvents: new SessionEventRepository(database),
    evidences: new EvidenceRepository(database),
    decisions: new DecisionRepository(database),
    actions: new ActionRepository(database),
    reviews: new ReviewRepository(database),
  };
}

export class TaskRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      taskId: randomUUID(),
      title: input.title.trim(),
      description: input.description?.trim(),
      goal: input.goal.trim(),
      constraints: input.constraints ?? [],
      successCriteria: input.successCriteria ?? [],
      riskProfile: input.riskProfile ?? "medium",
      templateType: input.templateType ?? "feature_delivery",
      projectPath: input.projectPath?.trim(),
      createdAt: now,
      updatedAt: now,
    };

    this.database
      .prepare(
        `INSERT INTO tasks (
          task_id, title, description, goal, constraints_json, success_criteria_json,
          risk_profile, template_type, project_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.taskId,
        task.title,
        task.description ?? null,
        task.goal,
        JSON.stringify(task.constraints),
        JSON.stringify(task.successCriteria),
        task.riskProfile,
        task.templateType,
        task.projectPath ?? null,
        task.createdAt,
        task.updatedAt,
      );

    return task;
  }

  list(): Task[] {
    const rows = this.database
      .prepare("SELECT * FROM tasks ORDER BY created_at DESC")
      .all() as TaskRow[];
    return rows.map(toTask);
  }

  get(taskId: string): Task | null {
    const row = this.database
      .prepare("SELECT * FROM tasks WHERE task_id = ?")
      .get(taskId) as TaskRow | undefined;
    return row ? toTask(row) : null;
  }

  update(taskId: string, input: UpdateTaskInput): Task {
    const current = this.get(taskId);
    if (!current) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const updated: Task = {
      ...current,
      ...input,
      title: input.title?.trim() ?? current.title,
      description: input.description?.trim() ?? current.description,
      goal: input.goal?.trim() ?? current.goal,
      projectPath: input.projectPath?.trim() ?? current.projectPath,
      constraints: input.constraints ?? current.constraints,
      successCriteria: input.successCriteria ?? current.successCriteria,
      updatedAt: new Date().toISOString(),
    };

    this.database
      .prepare(
        `UPDATE tasks SET
          title = ?, description = ?, goal = ?, constraints_json = ?, success_criteria_json = ?,
          risk_profile = ?, template_type = ?, project_path = ?, updated_at = ?
        WHERE task_id = ?`,
      )
      .run(
        updated.title,
        updated.description ?? null,
        updated.goal,
        JSON.stringify(updated.constraints),
        JSON.stringify(updated.successCriteria),
        updated.riskProfile,
        updated.templateType,
        updated.projectPath ?? null,
        updated.updatedAt,
        taskId,
      );

    return updated;
  }

  delete(taskId: string): void {
    this.database.prepare("DELETE FROM tasks WHERE task_id = ?").run(taskId);
  }
}

export class LoopRunRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(input: CreateLoopRunInput): LoopRun {
    const taskExists = this.database
      .prepare("SELECT 1 FROM tasks WHERE task_id = ?")
      .get(input.taskId);
    if (!taskExists) {
      throw new Error(`Cannot create LoopRun for missing task: ${input.taskId}`);
    }

    const loopRun: LoopRun = {
      loopRunId: randomUUID(),
      taskId: input.taskId,
      status: "initialized",
      mode: input.mode ?? "assist_loop",
      policyId: input.policyId,
      startedAt: new Date().toISOString(),
    };

    this.database
      .prepare(
        `INSERT INTO loop_runs (
          loop_run_id, task_id, status, mode, policy_id, started_at, ended_at, outcome, summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        loopRun.loopRunId,
        loopRun.taskId,
        loopRun.status,
        loopRun.mode,
        loopRun.policyId ?? null,
        loopRun.startedAt,
        null,
        null,
        null,
      );

    return loopRun;
  }

  listByTask(taskId: string): LoopRun[] {
    const rows = this.database
      .prepare("SELECT * FROM loop_runs WHERE task_id = ? ORDER BY started_at DESC")
      .all(taskId) as LoopRunRow[];
    return rows.map(toLoopRun);
  }

  get(loopRunId: string): LoopRun | null {
    const row = this.database
      .prepare("SELECT * FROM loop_runs WHERE loop_run_id = ?")
      .get(loopRunId) as LoopRunRow | undefined;
    return row ? toLoopRun(row) : null;
  }

  updateStatus(loopRunId: string, status: LoopRunStatus): LoopRun {
    const current = this.get(loopRunId);
    if (!current) {
      throw new Error(`LoopRun not found: ${loopRunId}`);
    }

    const endedAt = status === "completed" || status === "aborted" ? new Date().toISOString() : null;
    this.database
      .prepare("UPDATE loop_runs SET status = ?, ended_at = COALESCE(?, ended_at) WHERE loop_run_id = ?")
      .run(status, endedAt, loopRunId);

    const updated = this.get(loopRunId);
    if (!updated) {
      throw new Error(`LoopRun disappeared after update: ${loopRunId}`);
    }
    return updated;
  }
}

type SessionRow = {
  session_id: string;
  loop_run_id: string;
  thread_id: string | null;
  window_id: string | null;
  title: string;
  source_type: SessionMeta["sourceType"];
  status: string;
  project_path: string | null;
  source_path: string | null;
  last_event_at: string | null;
};

type SessionEventRow = {
  event_id: string;
  loop_run_id: string;
  session_id: string;
  event_type: string;
  payload_json: string;
  created_at: string;
};

type EvidenceRow = {
  evidence_id: string;
  loop_run_id: string;
  session_id: string | null;
  evidence_type: Evidence["evidenceType"];
  source_type: string;
  source_ref: string | null;
  snippet: string;
  confidence: number;
  related_event_ids_json: string;
  created_at: string;
};

type DecisionRow = {
  decision_id: string;
  loop_run_id: string;
  decision_type: string;
  reason: string;
  risk_level: Decision["riskLevel"];
  confidence: number;
  evidence_ids_json: string;
  created_at: string;
};

type ActionRow = {
  action_id: string;
  loop_run_id: string;
  decision_id: string;
  action_type: Action["actionType"];
  message: string | null;
  status: Action["status"];
  requires_review: 0 | 1;
  review_status: Action["reviewStatus"] | null;
  executed_at: string | null;
  created_at: string;
};

type ReviewRow = {
  review_id: string;
  action_id: string;
  review_type: string;
  reviewer: string | null;
  result: Review["result"];
  comment: string | null;
  created_at: string;
};

export class SessionRepository {
  constructor(private readonly database: DatabaseSync) {}

  upsert(input: CreateSessionInput): SessionMeta {
    const session: SessionMeta & { loopRunId: string } = {
      sessionId: input.sessionId ?? randomUUID(),
      loopRunId: input.loopRunId,
      threadId: input.threadId,
      windowId: input.windowId,
      title: input.title.trim(),
      sourceType: input.sourceType ?? "codex_local",
      status: input.status ?? "discovered",
      projectPath: input.projectPath?.trim(),
      sourcePath: input.sourcePath?.trim(),
      lastEventAt: input.lastEventAt,
    };

    this.database
      .prepare(
        `INSERT INTO sessions (
          session_id, loop_run_id, thread_id, window_id, title, source_type, status, project_path, source_path, last_event_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          loop_run_id = excluded.loop_run_id,
          thread_id = excluded.thread_id,
          window_id = excluded.window_id,
          title = excluded.title,
          source_type = excluded.source_type,
          status = excluded.status,
          project_path = excluded.project_path,
          source_path = excluded.source_path,
          last_event_at = excluded.last_event_at`,
      )
      .run(
        session.sessionId,
        session.loopRunId,
        session.threadId ?? null,
        session.windowId ?? null,
        session.title,
        session.sourceType,
        session.status,
        session.projectPath ?? null,
        session.sourcePath ?? null,
        session.lastEventAt ?? null,
      );

    return session;
  }

  listByLoopRun(loopRunId: string): SessionMeta[] {
    const rows = this.database
      .prepare("SELECT * FROM sessions WHERE loop_run_id = ? ORDER BY last_event_at DESC")
      .all(loopRunId) as SessionRow[];
    return rows.map(toSession);
  }

  get(sessionId: string): SessionMeta | null {
    const row = this.database
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .get(sessionId) as SessionRow | undefined;
    return row ? toSession(row) : null;
  }

  updateStatus(sessionId: string, status: string): SessionMeta {
    this.database.prepare("UPDATE sessions SET status = ? WHERE session_id = ?").run(status, sessionId);

    const updated = this.get(sessionId);
    if (!updated) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return updated;
  }
}

export class SessionEventRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(input: CreateSessionEventInput): SessionEvent {
    const event: SessionEvent = {
      eventId: randomUUID(),
      loopRunId: input.loopRunId,
      sessionId: input.sessionId,
      eventType: input.eventType,
      payload: input.payload,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    this.database
      .prepare(
        `INSERT INTO session_events (
          event_id, loop_run_id, session_id, event_type, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.eventId,
        event.loopRunId,
        event.sessionId,
        event.eventType,
        JSON.stringify(event.payload),
        event.createdAt,
      );

    return event;
  }

  createIfNotExists(input: CreateSessionEventInput): SessionEvent | null {
    const payloadJson = JSON.stringify(input.payload);
    const createdAt = input.createdAt ?? new Date().toISOString();
    const existing = this.database
      .prepare(
        `SELECT * FROM session_events
        WHERE loop_run_id = ? AND session_id = ? AND event_type = ? AND created_at = ? AND payload_json = ?
        LIMIT 1`,
      )
      .get(input.loopRunId, input.sessionId, input.eventType, createdAt, payloadJson) as SessionEventRow | undefined;

    if (existing) {
      return null;
    }

    const event: SessionEvent = {
      eventId: randomUUID(),
      loopRunId: input.loopRunId,
      sessionId: input.sessionId,
      eventType: input.eventType,
      payload: input.payload,
      createdAt,
    };

    this.database
      .prepare(
        `INSERT INTO session_events (
          event_id, loop_run_id, session_id, event_type, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(event.eventId, event.loopRunId, event.sessionId, event.eventType, payloadJson, event.createdAt);

    return event;
  }

  listBySession(sessionId: string, limit = 100): SessionEvent[] {
    const rows = this.database
      .prepare("SELECT * FROM session_events WHERE session_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(sessionId, limit) as SessionEventRow[];
    return rows.map(toSessionEvent);
  }

  listByLoopRun(loopRunId: string, limit = 100): SessionEvent[] {
    const rows = this.database
      .prepare("SELECT * FROM session_events WHERE loop_run_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(loopRunId, limit) as SessionEventRow[];
    return rows.map(toSessionEvent);
  }
}

export class EvidenceRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(input: CreateEvidenceInput): Evidence {
    const evidence: Evidence = {
      evidenceId: randomUUID(),
      loopRunId: input.loopRunId,
      sessionId: input.sessionId,
      evidenceType: input.evidenceType,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      snippet: input.snippet,
      confidence: input.confidence ?? 0.5,
      relatedEventIds: input.relatedEventIds ?? [],
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    this.database
      .prepare(
        `INSERT INTO evidences (
          evidence_id, loop_run_id, session_id, evidence_type, source_type, source_ref,
          snippet, confidence, related_event_ids_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        evidence.evidenceId,
        evidence.loopRunId,
        evidence.sessionId ?? null,
        evidence.evidenceType,
        evidence.sourceType,
        evidence.sourceRef ?? null,
        evidence.snippet,
        evidence.confidence,
        JSON.stringify(evidence.relatedEventIds),
        evidence.createdAt,
      );

    return evidence;
  }

  listByLoopRun(loopRunId: string): Evidence[] {
    const rows = this.database
      .prepare("SELECT * FROM evidences WHERE loop_run_id = ? ORDER BY created_at DESC")
      .all(loopRunId) as EvidenceRow[];
    return rows.map(toEvidence);
  }
}

export class DecisionRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(input: CreateDecisionInput): Decision {
    const decision: Decision = {
      decisionId: randomUUID(),
      loopRunId: input.loopRunId,
      decisionType: input.decisionType,
      reason: input.reason,
      riskLevel: input.riskLevel,
      confidence: input.confidence ?? 0.5,
      evidenceIds: input.evidenceIds ?? [],
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    this.database
      .prepare(
        `INSERT INTO decisions (
          decision_id, loop_run_id, decision_type, reason, risk_level, confidence, evidence_ids_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        decision.decisionId,
        decision.loopRunId,
        decision.decisionType,
        decision.reason,
        decision.riskLevel,
        decision.confidence,
        JSON.stringify(decision.evidenceIds),
        decision.createdAt,
      );

    return decision;
  }

  listByLoopRun(loopRunId: string): Decision[] {
    const rows = this.database
      .prepare("SELECT * FROM decisions WHERE loop_run_id = ? ORDER BY created_at DESC")
      .all(loopRunId) as DecisionRow[];
    return rows.map(toDecision);
  }
}

export class ActionRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(input: CreateActionInput): Action {
    const action: Action = {
      actionId: randomUUID(),
      loopRunId: input.loopRunId,
      decisionId: input.decisionId,
      actionType: input.actionType,
      message: input.message,
      status: input.status ?? (input.requiresReview ? "pending_review" : "draft"),
      requiresReview: input.requiresReview ?? false,
      reviewStatus: input.reviewStatus,
      executedAt: input.executedAt,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    this.database
      .prepare(
        `INSERT INTO actions (
          action_id, loop_run_id, decision_id, action_type, message, status,
          requires_review, review_status, executed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        action.actionId,
        action.loopRunId,
        action.decisionId,
        action.actionType,
        action.message ?? null,
        action.status,
        action.requiresReview ? 1 : 0,
        action.reviewStatus ?? null,
        action.executedAt ?? null,
        action.createdAt,
      );

    return action;
  }

  listByLoopRun(loopRunId: string): Action[] {
    const rows = this.database
      .prepare("SELECT * FROM actions WHERE loop_run_id = ? ORDER BY created_at DESC")
      .all(loopRunId) as ActionRow[];
    return rows.map(toAction);
  }

  updateReviewResult(actionId: string, result: "approved" | "rejected"): Action {
    const status: Action["status"] = result === "approved" ? "approved" : "rejected";
    this.database
      .prepare("UPDATE actions SET status = ?, review_status = ? WHERE action_id = ?")
      .run(status, result, actionId);

    const row = this.database
      .prepare("SELECT * FROM actions WHERE action_id = ?")
      .get(actionId) as ActionRow | undefined;
    if (!row) {
      throw new Error(`Action not found: ${actionId}`);
    }
    return toAction(row);
  }
}

export class ReviewRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(input: CreateReviewInput): Review {
    const review: Review = {
      reviewId: randomUUID(),
      actionId: input.actionId,
      reviewType: input.reviewType,
      reviewer: input.reviewer,
      result: input.result ?? "pending",
      comment: input.comment,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    this.database
      .prepare(
        `INSERT INTO reviews (
          review_id, action_id, review_type, reviewer, result, comment, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        review.reviewId,
        review.actionId,
        review.reviewType,
        review.reviewer ?? null,
        review.result,
        review.comment ?? null,
        review.createdAt,
      );

    return review;
  }

  listByAction(actionId: string): Review[] {
    const rows = this.database
      .prepare("SELECT * FROM reviews WHERE action_id = ? ORDER BY created_at DESC")
      .all(actionId) as ReviewRow[];
    return rows.map(toReview);
  }

  listPending(): Review[] {
    const rows = this.database
      .prepare("SELECT * FROM reviews WHERE result = 'pending' ORDER BY created_at DESC")
      .all() as ReviewRow[];
    return rows.map(toReview);
  }

  updateResult(
    reviewId: string,
    input: { result: "approved" | "rejected"; reviewer?: string; comment?: string },
  ): Review {
    this.database
      .prepare(
        `UPDATE reviews SET
          result = ?,
          reviewer = COALESCE(?, reviewer),
          comment = COALESCE(?, comment)
        WHERE review_id = ?`,
      )
      .run(input.result, input.reviewer ?? null, input.comment ?? null, reviewId);

    const row = this.database
      .prepare("SELECT * FROM reviews WHERE review_id = ?")
      .get(reviewId) as ReviewRow | undefined;
    if (!row) {
      throw new Error(`Review not found: ${reviewId}`);
    }
    return toReview(row);
  }
}

function toTask(row: TaskRow): Task {
  return {
    taskId: row.task_id,
    title: row.title,
    description: row.description ?? undefined,
    goal: row.goal,
    constraints: JSON.parse(row.constraints_json) as string[],
    successCriteria: JSON.parse(row.success_criteria_json) as string[],
    riskProfile: row.risk_profile,
    templateType: row.template_type,
    projectPath: row.project_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toLoopRun(row: LoopRunRow): LoopRun {
  return {
    loopRunId: row.loop_run_id,
    taskId: row.task_id,
    status: row.status,
    mode: row.mode,
    policyId: row.policy_id ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    outcome: row.outcome ?? undefined,
    summary: row.summary ?? undefined,
  };
}

function toSession(row: SessionRow): SessionMeta {
  return {
    sessionId: row.session_id,
    loopRunId: row.loop_run_id,
    threadId: row.thread_id ?? undefined,
    windowId: row.window_id ?? undefined,
    title: row.title,
    sourceType: row.source_type,
    status: row.status,
    projectPath: row.project_path ?? undefined,
    sourcePath: row.source_path ?? undefined,
    lastEventAt: row.last_event_at ?? undefined,
  };
}

function toSessionEvent(row: SessionEventRow): SessionEvent {
  return {
    eventId: row.event_id,
    loopRunId: row.loop_run_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function toEvidence(row: EvidenceRow): Evidence {
  return {
    evidenceId: row.evidence_id,
    loopRunId: row.loop_run_id,
    sessionId: row.session_id ?? undefined,
    evidenceType: row.evidence_type,
    sourceType: row.source_type,
    sourceRef: row.source_ref ?? undefined,
    snippet: row.snippet,
    confidence: row.confidence,
    relatedEventIds: JSON.parse(row.related_event_ids_json) as string[],
    createdAt: row.created_at,
  };
}

function toDecision(row: DecisionRow): Decision {
  return {
    decisionId: row.decision_id,
    loopRunId: row.loop_run_id,
    decisionType: row.decision_type,
    reason: row.reason,
    riskLevel: row.risk_level,
    confidence: row.confidence,
    evidenceIds: JSON.parse(row.evidence_ids_json) as string[],
    createdAt: row.created_at,
  };
}

function toAction(row: ActionRow): Action {
  return {
    actionId: row.action_id,
    loopRunId: row.loop_run_id,
    decisionId: row.decision_id,
    actionType: row.action_type,
    message: row.message ?? undefined,
    status: row.status,
    requiresReview: Boolean(row.requires_review),
    reviewStatus: row.review_status ?? undefined,
    executedAt: row.executed_at ?? undefined,
    createdAt: row.created_at,
  };
}

function toReview(row: ReviewRow): Review {
  return {
    reviewId: row.review_id,
    actionId: row.action_id,
    reviewType: row.review_type,
    reviewer: row.reviewer ?? undefined,
    result: row.result,
    comment: row.comment ?? undefined,
    createdAt: row.created_at,
  };
}

export function describeDatabaseScope(): string {
  return `SQLite first schema covering ${CORE_TABLES.length} core tables.`;
}

function ensureColumn(database: DatabaseSync, tableName: string, columnName: string, columnType: string): void {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
  }
}
