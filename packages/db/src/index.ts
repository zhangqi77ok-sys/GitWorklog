import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  CreateLoopRunInput,
  CreateTaskInput,
  CreateSessionEventInput,
  CreateSessionInput,
  LoopRun,
  LoopRunStatus,
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

CREATE INDEX IF NOT EXISTS idx_loop_runs_task_id ON loop_runs(task_id);
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
}

export function openGitWorklogDatabase(path = ":memory:"): GitWorklogDatabase {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const database = new DatabaseSync(path);
  database.exec(SCHEMA_SQL);

  return {
    database,
    close: () => database.close(),
    tasks: new TaskRepository(database),
    loopRuns: new LoopRunRepository(database),
    sessions: new SessionRepository(database),
    sessionEvents: new SessionEventRepository(database),
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
      lastEventAt: input.lastEventAt,
    };

    this.database
      .prepare(
        `INSERT INTO sessions (
          session_id, loop_run_id, thread_id, window_id, title, source_type, status, project_path, last_event_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          loop_run_id = excluded.loop_run_id,
          thread_id = excluded.thread_id,
          window_id = excluded.window_id,
          title = excluded.title,
          source_type = excluded.source_type,
          status = excluded.status,
          project_path = excluded.project_path,
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

  listBySession(sessionId: string, limit = 100): SessionEvent[] {
    const rows = this.database
      .prepare("SELECT * FROM session_events WHERE session_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(sessionId, limit) as SessionEventRow[];
    return rows.map(toSessionEvent);
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

export function describeDatabaseScope(): string {
  return `SQLite first schema covering ${CORE_TABLES.length} core tables.`;
}
