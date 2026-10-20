-- v2 Scene workspace (Technical-Design §8.1, global DB only).
-- workspaces: recent list + trust. terminal_sessions: terminal session metadata.
-- app_settings.templates_dir is added by ensureColumns() in client.ts (ALTER is not idempotent).

CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  trusted INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspaces_last_opened ON workspaces(last_opened_at);

CREATE TABLE IF NOT EXISTS terminal_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  scene_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT
);
