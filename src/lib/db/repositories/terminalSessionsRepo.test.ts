// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { runMigrations, type SqlDatabase } from '@/lib/db/client';
import { listSessions, recordSessionEnd, recordSessionStart } from './terminalSessionsRepo';

let db: SqlDatabase;

beforeEach(async () => {
  const raw = new DatabaseSync(':memory:');
  db = {
    async execute(q, b = []) {
      raw.prepare(q).run(...(b as SQLInputValue[]));
      return { rowsAffected: 0 };
    },
    async select<T>(q: string, b: unknown[] = []) {
      return raw.prepare(q).all(...(b as SQLInputValue[])) as T;
    },
  };
  await runMigrations(db, 'global');
});

describe('terminalSessionsRepo', () => {
  it('records start and end, newest first', async () => {
    await recordSessionStart({ id: 't1', agentId: 'codex', workspaceId: 'ws_1', sceneId: 'scn_A' }, new Date('2026-01-01T00:00:00Z'), db);
    await recordSessionStart({ id: 't2', agentId: 'claude-code', workspaceId: 'ws_1', sceneId: 'scn_B' }, new Date('2026-01-02T00:00:00Z'), db);
    await recordSessionEnd('t1', new Date('2026-01-01T00:05:00Z'), db);
    const all = await listSessions('ws_1', undefined, 20, db);
    expect(all.map((s) => s.id)).toEqual(['t2', 't1']);
    expect(all[1]).toMatchObject({ agentId: 'codex', endedAt: '2026-01-01T00:05:00.000Z' });
    expect(all[0].endedAt).toBeNull();
  });

  it('filters by scene and workspace and honours the limit', async () => {
    await recordSessionStart({ id: 'a', agentId: 'codex', workspaceId: 'ws_1', sceneId: 'scn_A' }, new Date('2026-01-01'), db);
    await recordSessionStart({ id: 'b', agentId: 'codex', workspaceId: 'ws_2', sceneId: 'scn_A' }, new Date('2026-01-02'), db);
    await recordSessionStart({ id: 'c', agentId: 'codex', workspaceId: 'ws_1', sceneId: 'scn_B' }, new Date('2026-01-03'), db);
    expect((await listSessions('ws_1', 'scn_A', 20, db)).map((s) => s.id)).toEqual(['a']);
    expect((await listSessions('ws_1', undefined, 1, db)).map((s) => s.id)).toEqual(['c']);
  });
});
