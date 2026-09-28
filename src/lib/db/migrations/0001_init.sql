CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  open_tabs TEXT NOT NULL DEFAULT '[]',
  active_tab_id TEXT,
  theme TEXT NOT NULL DEFAULT 'light',
  language TEXT NOT NULL DEFAULT 'ko',
  enabled_extensions TEXT NOT NULL DEFAULT '[]',
  trusted_workspaces TEXT NOT NULL DEFAULT '[]',
  last_workspace_root TEXT
);

-- Example domain table (project-scoped). Replace with your own tables.
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at);
