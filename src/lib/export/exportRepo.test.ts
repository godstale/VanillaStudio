// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations, type SqlDatabase } from '@/lib/db/client';
import { loadExportJobs, saveExportJob, type ExportJobRow } from './exportRepo';

// Real SQLite (node:sqlite) with the project migrations, so the upsert SQL is exercised for real.
async function openProjectDb(): Promise<SqlDatabase> {
  const raw = new DatabaseSync(':memory:');
  const db: SqlDatabase = {
    async execute(query, bind = []) {
      raw.prepare(query).run(...(bind as (string | number | null)[]));
      return { rowsAffected: 0 };
    },
    async select<T>(query: string) {
      return raw.prepare(query).all() as T;
    },
  };
  await runMigrations(
    {
      async execute(q) {
        raw.exec(q);
        return { rowsAffected: 0 };
      },
      select: db.select,
    },
    'project',
  );
  return db;
}

const row = (id: string, status: string): ExportJobRow => ({
  id,
  format: 'web',
  status,
  outputPath: null,
  startedAt: '2026-09-29T00:00:00.000Z',
  endedAt: null,
  error: null,
});

describe('export_jobs repository', () => {
  it('returns an empty history for a fresh project', async () => {
    expect(await loadExportJobs('/p', await openProjectDb())).toEqual([]);
  });

  it('upserts rows and lists them newest first', async () => {
    const db = await openProjectDb();
    await saveExportJob('/p', row('j1', 'queued'), db);
    await saveExportJob('/p', { ...row('j1', 'done'), outputPath: '/p/exports/x-web', endedAt: 'T2' }, db);
    await saveExportJob('/p', row('j2', 'failed'), db);
    const jobs = await loadExportJobs('/p', db);
    expect(jobs).toHaveLength(2);
    // j1 was upserted, not duplicated.
    expect(jobs.find((j) => j.id === 'j1')).toMatchObject({
      status: 'done',
      outputPath: '/p/exports/x-web',
      endedAt: 'T2',
    });
  });
});
