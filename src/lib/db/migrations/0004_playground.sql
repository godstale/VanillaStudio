-- Playground metadata (T6.8, Technical-Design §8.1, global DB only).
-- The core index lives in `playground_items` (0002). This side table holds what
-- that table predates: tags for search/filter (F-PLY-02) and the source project
-- the export ran in (workspace scope for file reads). Idempotent by design
-- (IF NOT EXISTS only; no ALTER of existing tables).

CREATE TABLE IF NOT EXISTS playground_meta (
  item_id TEXT PRIMARY KEY,
  tags TEXT NOT NULL DEFAULT '[]',
  source_project TEXT
);
