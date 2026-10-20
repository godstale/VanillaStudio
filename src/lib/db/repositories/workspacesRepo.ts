import { getGlobalDatabase, type SqlDatabase } from '@/lib/db/client';

export interface WorkspaceRecord {
  workspaceId: string;
  path: string;
  name: string;
  trusted: boolean;
  lastOpenedAt: string;
}

interface WorkspaceRow {
  workspace_id: string;
  path: string;
  name: string;
  trusted: number;
  last_opened_at: string;
}

const toRecord = (r: WorkspaceRow): WorkspaceRecord => ({
  workspaceId: r.workspace_id,
  path: r.path,
  name: r.name,
  trusted: r.trusted === 1,
  lastOpenedAt: r.last_opened_at,
});

/** 열 때마다 호출: 새 항목이면 만들고, 있으면 이름·경로·열람 시각만 갱신한다(신뢰 여부는 보존). */
export async function touchWorkspace(
  input: { workspaceId: string; path: string; name: string },
  now: Date = new Date(),
  dbOverride?: SqlDatabase,
): Promise<void> {
  const db = dbOverride ?? (await getGlobalDatabase());
  // 같은 경로에 다른 workspaceId가 남아 있으면(폴더 교체) 옛 행을 치워 UNIQUE(path) 충돌을 피한다.
  await db.execute('DELETE FROM workspaces WHERE path = ? AND workspace_id <> ?', [input.path, input.workspaceId]);
  await db.execute(
    `INSERT INTO workspaces (workspace_id, path, name, trusted, last_opened_at) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET path = excluded.path, name = excluded.name, last_opened_at = excluded.last_opened_at`,
    [input.workspaceId, input.path, input.name, now.toISOString()],
  );
}

/** 최근 열람 순. */
export async function listRecentWorkspaces(limit = 10, dbOverride?: SqlDatabase): Promise<WorkspaceRecord[]> {
  const db = dbOverride ?? (await getGlobalDatabase());
  const rows = await db.select<WorkspaceRow[]>(
    'SELECT * FROM workspaces ORDER BY last_opened_at DESC LIMIT ?',
    [limit],
  );
  return rows.map(toRecord);
}

export async function getWorkspaceByPath(path: string, dbOverride?: SqlDatabase): Promise<WorkspaceRecord | null> {
  const db = dbOverride ?? (await getGlobalDatabase());
  const rows = await db.select<WorkspaceRow[]>('SELECT * FROM workspaces WHERE path = ?', [path]);
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function setWorkspaceTrusted(workspaceId: string, trusted: boolean, dbOverride?: SqlDatabase): Promise<void> {
  const db = dbOverride ?? (await getGlobalDatabase());
  await db.execute('UPDATE workspaces SET trusted = ? WHERE workspace_id = ?', [trusted ? 1 : 0, workspaceId]);
}

export async function removeWorkspace(workspaceId: string, dbOverride?: SqlDatabase): Promise<void> {
  const db = dbOverride ?? (await getGlobalDatabase());
  await db.execute('DELETE FROM workspaces WHERE workspace_id = ?', [workspaceId]);
}
