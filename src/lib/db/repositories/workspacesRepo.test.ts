// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations, type SqlDatabase } from '@/lib/db/client';
import {
  getWorkspaceByPath,
  listRecentWorkspaces,
  removeWorkspace,
  setWorkspaceTrusted,
  touchWorkspace,
} from './workspacesRepo';

let db: SqlDatabase;

beforeEach(async () => {
  const raw = new DatabaseSync(':memory:');
  db = {
    async execute(query, bind = []) {
      raw.prepare(query).run(...(bind as never[]));
      return { rowsAffected: 0 };
    },
    async select<T>(query: string, bind: unknown[] = []) {
      return raw.prepare(query).all(...(bind as never[])) as T;
    },
  };
  await runMigrations(db, 'global');
});

const ws = (id: string, path = `/w/${id}`) => ({ workspaceId: id, path, name: `N-${id}` });

describe('workspacesRepo', () => {
  it('lists most recently opened first', async () => {
    await touchWorkspace(ws('a'), new Date('2026-01-01'), db);
    await touchWorkspace(ws('b'), new Date('2026-01-02'), db);
    await touchWorkspace(ws('a'), new Date('2026-01-03'), db);
    expect((await listRecentWorkspaces(10, db)).map((w) => w.workspaceId)).toEqual(['a', 'b']);
    expect(await listRecentWorkspaces(1, db)).toHaveLength(1);
  });

  it('keeps trust across re-opens and updates the name', async () => {
    await touchWorkspace(ws('a'), new Date('2026-01-01'), db);
    await setWorkspaceTrusted('a', true, db);
    await touchWorkspace({ ...ws('a'), name: 'Renamed' }, new Date('2026-01-02'), db);
    expect(await getWorkspaceByPath('/w/a', db)).toMatchObject({ name: 'Renamed', trusted: true });
  });

  it('replaces a stale row when a folder gets a new workspaceId', async () => {
    await touchWorkspace(ws('old', '/w/x'), new Date('2026-01-01'), db);
    await touchWorkspace(ws('new', '/w/x'), new Date('2026-01-02'), db);
    expect((await listRecentWorkspaces(10, db)).map((w) => w.workspaceId)).toEqual(['new']);
  });

  it('removes and misses', async () => {
    await touchWorkspace(ws('a'), new Date(), db);
    await removeWorkspace('a', db);
    expect(await getWorkspaceByPath('/w/a', db)).toBeNull();
  });
});
