import { describe, expect, it } from 'vitest';
import { MemorySqlFallback, runMigrations } from '@/lib/db/client';
import { deletePlaygroundItem, listPlaygroundItems, savePlaygroundItem } from './playgroundRepo';
import type { PlaygroundItem } from './types';

async function openDb(): Promise<MemorySqlFallback> {
  const db = new MemorySqlFallback();
  await runMigrations(db, 'global');
  return db;
}

const item = (over: Partial<PlaygroundItem> = {}): PlaygroundItem => ({
  id: 'pg-1',
  title: 'Intro',
  kind: 'video',
  dirPath: 'C:/p/exports/v1',
  sourceProject: 'C:/p',
  tags: ['hero'],
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
  ...over,
});

describe('playgroundRepo', () => {
  it('round-trips items newest first', async () => {
    const db = await openDb();
    await savePlaygroundItem(item({ id: 'a', createdAt: '2026-09-29T00:00:00.000Z' }), db);
    await savePlaygroundItem(item({ id: 'b', title: 'Cover', kind: 'image', tags: [] }), db);
    const list = await listPlaygroundItems(db);
    expect(list.map((i) => i.id)).toEqual(['b', 'a']);
    expect(list[0].tags).toEqual([]);
    expect(list[1].sourceProject).toBe('C:/p');
  });

  it('upserts on the same id', async () => {
    const db = await openDb();
    await savePlaygroundItem(item(), db);
    await savePlaygroundItem(item({ title: 'Renamed', tags: ['x', 'y'] }), db);
    const list = await listPlaygroundItems(db);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Renamed');
    expect(list[0].tags).toEqual(['x', 'y']);
  });

  it('deletes items', async () => {
    const db = await openDb();
    await savePlaygroundItem(item(), db);
    await deletePlaygroundItem('pg-1', db);
    expect(await listPlaygroundItems(db)).toEqual([]);
  });
});
