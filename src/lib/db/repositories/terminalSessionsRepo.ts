import { getGlobalDatabase, type SqlDatabase } from '@/lib/db/client';

// 터미널 세션 메타(전역 DB `terminal_sessions`, Technical-Design §8.1): 어떤 에이전트를 어느 워크스페이스·신에서 언제 실행했는가.
// 출력 내용은 저장하지 않는다. 기록 실패는 실행에 영향을 주지 않으므로 호출하는 쪽이 오류를 삼킨다.

export interface TerminalSessionRecord {
  id: string;
  agentId: string;
  workspaceId: string;
  sceneId: string | null;
  startedAt: string;
  endedAt: string | null;
}

interface Row {
  id: string;
  agent_id: string;
  workspace_id: string;
  scene_id: string | null;
  started_at: string;
  ended_at: string | null;
}

export async function recordSessionStart(
  s: { id: string; agentId: string; workspaceId: string; sceneId: string | null },
  now: Date = new Date(),
  dbOverride?: SqlDatabase,
): Promise<void> {
  const db = dbOverride ?? (await getGlobalDatabase());
  await db.execute(
    'INSERT OR REPLACE INTO terminal_sessions (id, agent_id, workspace_id, scene_id, started_at, ended_at) VALUES (?, ?, ?, ?, ?, NULL)',
    [s.id, s.agentId, s.workspaceId, s.sceneId, now.toISOString()],
  );
}

export async function recordSessionEnd(id: string, now: Date = new Date(), dbOverride?: SqlDatabase): Promise<void> {
  const db = dbOverride ?? (await getGlobalDatabase());
  await db.execute('UPDATE terminal_sessions SET ended_at = ? WHERE id = ?', [now.toISOString(), id]);
}

/** 최근 세션부터. 인스펙터 "실행 이력"이 쓴다. */
export async function listSessions(workspaceId: string, sceneId?: string, limit = 20, dbOverride?: SqlDatabase): Promise<TerminalSessionRecord[]> {
  const db = dbOverride ?? (await getGlobalDatabase());
  const rows = sceneId
    ? await db.select<Row[]>('SELECT * FROM terminal_sessions WHERE workspace_id = ? AND scene_id = ? ORDER BY started_at DESC LIMIT ?', [workspaceId, sceneId, limit])
    : await db.select<Row[]>('SELECT * FROM terminal_sessions WHERE workspace_id = ? ORDER BY started_at DESC LIMIT ?', [workspaceId, limit]);
  return rows.map((r) => ({ id: r.id, agentId: r.agent_id, workspaceId: r.workspace_id, sceneId: r.scene_id, startedAt: r.started_at, endedAt: r.ended_at }));
}
