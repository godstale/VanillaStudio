// Global DB persistence for playground items (T6.8, Technical-Design §8.1).
// Core columns live in `playground_items` (T1.6); tags and the source project
// live in `playground_meta` (0004). The DB handle is injectable for tests.
import { getGlobalDatabase, type SqlDatabase } from '@/lib/db/client';
import { normalizeTags, parsePlaygroundItem, type PlaygroundItem } from './types';

interface PlaygroundDbRow {
  id: string;
  title: string;
  kind: string;
  dir_path: string;
  created_at: string;
  updated_at: string;
  tags: string | null;
  source_project: string | null;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeTags(parsed.filter((t): t is string => typeof t === 'string')) : [];
  } catch {
    return [];
  }
}

function toItem(row: PlaygroundDbRow): PlaygroundItem | null {
  try {
    return parsePlaygroundItem({
      id: row.id,
      title: row.title,
      kind: row.kind,
      dirPath: row.dir_path,
      sourceProject: row.source_project,
      tags: parseTags(row.tags),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch {
    // A corrupt row must not hide the rest of the playground.
    return null;
  }
}

/** Newest first. Corrupt rows are skipped. */
export async function listPlaygroundItems(db?: SqlDatabase): Promise<PlaygroundItem[]> {
  const conn = db ?? (await getGlobalDatabase());
  const rows = await conn.select<PlaygroundDbRow[]>(
    `SELECT i.id, i.title, i.kind, i.dir_path, i.created_at, i.updated_at, m.tags, m.source_project
     FROM playground_items i LEFT JOIN playground_meta m ON m.item_id = i.id
     ORDER BY i.created_at DESC`,
  );
  const items = rows.flatMap((r) => {
    const item = toItem(r);
    return item ? [item] : [];
  });
  // Newest first (the SQL already orders, but the in-memory fallback does not).
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export async function savePlaygroundItem(item: PlaygroundItem, db?: SqlDatabase): Promise<void> {
  const parsed = parsePlaygroundItem(item);
  const conn = db ?? (await getGlobalDatabase());
  await conn.execute(
    `INSERT INTO playground_items (id, title, kind, dir_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       kind = excluded.kind,
       dir_path = excluded.dir_path,
       updated_at = excluded.updated_at`,
    [parsed.id, parsed.title, parsed.kind, parsed.dirPath, parsed.createdAt, parsed.updatedAt],
  );
  await conn.execute(
    `INSERT INTO playground_meta (item_id, tags, source_project)
     VALUES (?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       tags = excluded.tags,
       source_project = excluded.source_project`,
    [parsed.id, JSON.stringify(parsed.tags), parsed.sourceProject],
  );
}

export async function deletePlaygroundItem(id: string, db?: SqlDatabase): Promise<void> {
  const conn = db ?? (await getGlobalDatabase());
  await conn.execute('DELETE FROM playground_meta WHERE item_id = ?', [id]);
  await conn.execute('DELETE FROM playground_items WHERE id = ?', [id]);
}
