-- Global DB only (AppData app.db). Technical-Design §8.1.

DROP TABLE IF EXISTS items;

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  args TEXT NOT NULL DEFAULT '[]',
  env TEXT NOT NULL DEFAULT '{}',
  session_options TEXT NOT NULL DEFAULT '{}',
  support_tier TEXT NOT NULL DEFAULT 'experimental',
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS palettes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  scheme TEXT NOT NULL DEFAULT 'light',
  tags TEXT NOT NULL DEFAULT '[]',
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '0.0.0',
  source TEXT NOT NULL DEFAULT 'user',
  dir_path TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  installed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playground_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  dir_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doctor_cache (
  check_id TEXT PRIMARY KEY,
  result TEXT NOT NULL,
  checked_at TEXT NOT NULL
);
