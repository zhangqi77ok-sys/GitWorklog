-- Loop 工程化产品 v1 数据库表 SQL 草案
-- SQLite first

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
