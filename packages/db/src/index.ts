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

export function describeDatabaseScope(): string {
  return `SQLite first schema covering ${CORE_TABLES.length} core tables.`;
}
