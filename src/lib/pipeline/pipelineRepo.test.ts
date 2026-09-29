// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations, type SqlDatabase } from '@/lib/db/client';
import { initialStates, transitionStage } from './pipelineModel';
import { loadPipelineStates, savePipelineStates } from './pipelineRepo';

// Real SQLite (node:sqlite) with the project migrations, so the upsert SQL is exercised for real.
async function openProjectDb(): Promise<{ db: SqlDatabase; raw: DatabaseSync }> {
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
  // migrations contain multiple statements per call site, executed one by one
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
  return { db, raw };
}

describe('pipeline_state repository', () => {
  it('returns defaults for an empty table', async () => {
    const { db } = await openProjectDb();
    expect(await loadPipelineStates('/p', db)).toEqual(initialStates());
  });

  it('round-trips approvals and upserts on repeat', async () => {
    const { db, raw } = await openProjectDb();
    const first = initialStates();
    const brief = transitionStage(first, 'brief', 'done', { now: 'T1' });
    if (!brief.ok) throw new Error('unexpected');
    await savePipelineStates('/p', [brief.states.brief], db);
    const plan = transitionStage(brief.states, 'plan', 'approved', { now: 'T2', checkpoint: 'c0ffee' });
    if (!plan.ok) throw new Error('unexpected');
    await savePipelineStates('/p', [plan.states.plan], db);
    await savePipelineStates('/p', [plan.states.plan], db);

    const loaded = await loadPipelineStates('/p', db);
    expect(loaded.brief.status).toBe('done');
    expect(loaded.plan).toMatchObject({ status: 'approved', approvedAt: 'T2', checkpoint: 'c0ffee' });
    expect(loaded.prompts.status).toBe('draft');
    expect((raw.prepare('SELECT COUNT(*) AS n FROM pipeline_state').get() as { n: number }).n).toBe(2);
  });

  it('ignores rows with unknown stages or statuses', async () => {
    const { db, raw } = await openProjectDb();
    raw.exec("INSERT INTO pipeline_state (stage, status, updated_at) VALUES ('nope', 'done', 't'), ('plan', 'weird', 't')");
    expect(await loadPipelineStates('/p', db)).toEqual(initialStates());
  });
});
