-- Project DB only (<project>/.vanilla/app.db). Technical-Design §8.2.

CREATE TABLE IF NOT EXISTS pipeline_state (
  stage TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_at TEXT,
  checkpoint TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TEXT,
  ended_at TEXT,
  result_commit TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  acp_session_id TEXT,
  log_path TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  output_path TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  error TEXT
);
