// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations, type SqlDatabase } from '@/lib/db/client';
import type { StopReason } from '@/lib/agents/types';
import type { Task } from './schemas/tasks';
import {
  applyRunRecord,
  createRunner,
  loadTaskRuns,
  nextTask,
  retryTask,
  runAll,
  runSingleTask,
  runnerStatus,
  runStatuses,
  saveTaskRun,
  setRunnerPaused,
  type RunnerDeps,
  type TaskRunRecord,
} from './runner';

const TASKS: Task[] = [
  { id: 'T01', kind: 'asset', target: 'logo', prompt: 'prompts/assets/logo.md', dependsOn: [] },
  { id: 'T02', kind: 'scene', target: 's1', prompt: 'prompts/scenes/s1.md', dependsOn: ['T01'] },
  { id: 'T03', kind: 'compose', target: '', prompt: 'prompts/00-master.md', dependsOn: ['T02'] },
];
const ORDER = ['T01', 'T02', 'T03'];

const NOW = '2026-01-01T00:00:00.000Z';

interface Harness {
  sent: { prompt: string; task: Task }[];
  saved: TaskRunRecord[];
  checkpoints: string[];
  deps: RunnerDeps;
}

function harness(overrides: Partial<RunnerDeps> = {}): Harness {
  const sent: Harness['sent'] = [];
  const saved: Harness['saved'] = [];
  const checkpoints: string[] = [];
  const deps: RunnerDeps = {
    send: async (prompt: string, task: Task) => {
      sent.push({ prompt, task });
      return 'end_turn';
    },
    sessionId: 'sess-1',
    checkpoint: async (task: Task) => {
      checkpoints.push(task.id);
      return `commit-${task.id}`;
    },
    saveRun: async (record: TaskRunRecord) => {
      saved.push(record);
    },
    now: () => NOW,
    locale: 'ko',
    ...overrides,
  };
  return { sent, saved, checkpoints, deps };
}

function doneRecord(taskId: string): TaskRunRecord {
  return {
    id: taskId,
    taskId,
    sessionId: 'sess-1',
    status: 'done',
    startedAt: NOW,
    endedAt: NOW,
    resultCommit: `commit-${taskId}`,
    error: null,
  };
}

// Real SQLite (node:sqlite) with the project migrations, so the task_runs upsert is exercised for real.
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

describe('runner state', () => {
  it('starts idle and walks the topo order', () => {
    const s = createRunner(TASKS, ORDER);
    expect(runnerStatus(s)).toBe('idle');
    expect(nextTask(s)?.id).toBe('T01');
    const s2 = applyRunRecord(s, doneRecord('T01'), () => NOW);
    expect(nextTask(s2)?.id).toBe('T02');
    expect(runnerStatus(s2)).toBe('running');
    expect(runStatuses(s2)).toEqual({ T01: 'done', T02: 'queued', T03: 'queued' });
  });

  it('is done when every task is done', () => {
    let s = createRunner(TASKS, ORDER);
    for (const id of ORDER) s = applyRunRecord(s, doneRecord(id), () => NOW);
    expect(nextTask(s)).toBeNull();
    expect(runnerStatus(s)).toBe('done');
  });

  it('retries a failed task back to queued and rewinds the cursor', () => {
    let s = createRunner(TASKS, ORDER);
    s = applyRunRecord(s, doneRecord('T01'), () => NOW);
    const failed: TaskRunRecord = { ...doneRecord('T02'), status: 'failed', error: 'refusal', resultCommit: null };
    s = applyRunRecord(s, failed, () => NOW);
    expect(runnerStatus(s)).toBe('failed');
    const retried = retryTask(s, 'T02');
    expect(retried.runs['T02']).toMatchObject({ status: 'queued', error: null });
    expect(nextTask(retried)?.id).toBe('T02');
  });

  it('pauses and reports the paused status', () => {
    const s = setRunnerPaused(createRunner(TASKS, ORDER), true);
    expect(runnerStatus(s)).toBe('paused');
  });
});

describe('runAll', () => {
  it('runs three tasks in order with a checkpoint after each', async () => {
    const h = harness();
    const outcome = await runAll(createRunner(TASKS, ORDER), h.deps);
    expect(outcome.failed).toBeNull();
    expect(outcome.completed).toEqual(ORDER);
    expect(h.sent.map((s) => s.task.id)).toEqual(ORDER);
    // The agent gets one build prompt per task, with the task id and prompt file.
    expect(h.sent[0].prompt).toContain('T01');
    expect(h.sent[0].prompt).toContain('prompts/assets/logo.md');
    expect(h.checkpoints).toEqual(ORDER);
    expect(runnerStatus(outcome.state)).toBe('done');
    const done = h.saved.filter((r) => r.status === 'done');
    expect(done).toHaveLength(3);
    expect(done[0]).toMatchObject({ taskId: 'T01', sessionId: 'sess-1', resultCommit: 'commit-T01', error: null });
  });

  it('stops at the failed task and resumes after retry', async () => {
    const reasons: StopReason[] = ['end_turn', 'refusal', 'end_turn', 'end_turn'];
    const h = harness({
      send: async (prompt: string, task: Task) => {
        h.sent.push({ prompt, task });
        return reasons.shift() ?? 'end_turn';
      },
    });
    const first = await runAll(createRunner(TASKS, ORDER), h.deps);
    expect(first.failed).toBe('T02');
    expect(first.completed).toEqual(['T01']);
    expect(runnerStatus(first.state)).toBe('failed');
    // T03 never ran, and no checkpoint was made for the failed task.
    expect(h.sent.map((s) => s.task.id)).toEqual(['T01', 'T02']);
    expect(h.checkpoints).toEqual(['T01']);

    const second = await runAll(retryTask(first.state, 'T02'), h.deps);
    expect(second.failed).toBeNull();
    expect(second.completed).toEqual(['T02', 'T03']);
    expect(runnerStatus(second.state)).toBe('done');
  });

  it('records a send failure with the error message', async () => {
    const h = harness({
      send: async () => {
        throw new Error('no-session');
      },
    });
    const outcome = await runAll(createRunner(TASKS, ORDER), h.deps);
    expect(outcome.failed).toBe('T01');
    expect(h.saved.at(-1)).toMatchObject({ status: 'failed', error: 'no-session' });
  });

  it('stops when the agent refuses', async () => {
    const h = harness({ send: async () => 'refusal' });
    const outcome = await runAll(createRunner(TASKS, ORDER), h.deps);
    expect(outcome.failed).toBe('T01');
    expect(h.saved.at(-1)).toMatchObject({ status: 'failed', error: 'refusal' });
    expect(h.checkpoints).toEqual([]);
  });

  it('stops the line when the turn is cancelled', async () => {
    const h = harness({ send: async () => 'cancelled' });
    const outcome = await runAll(createRunner(TASKS, ORDER), h.deps);
    expect(outcome.stopped).toBe(true);
    expect(outcome.completed).toEqual([]);
    expect(h.saved.at(-1)).toMatchObject({ status: 'queued', error: 'cancelled' });
  });

  it('pauses between tasks when asked', async () => {
    const h = harness({ isPaused: () => true });
    const outcome = await runAll(createRunner(TASKS, ORDER), h.deps);
    expect(outcome.completed).toEqual(['T01']);
    expect(runnerStatus(outcome.state)).toBe('paused');
    // Resuming clears the pause and continues.
    const resumed = await runAll({ ...outcome.state, paused: false }, { ...h.deps, isPaused: () => false });
    expect(resumed.completed).toEqual(['T02', 'T03']);
  });

  it('step mode runs exactly one task', async () => {
    const h = harness();
    const outcome = await runAll(createRunner(TASKS, ORDER, 'step'), h.deps);
    expect(outcome.completed).toEqual(['T01']);
    expect(h.sent).toHaveLength(1);
  });
});

describe('runSingleTask', () => {
  it('fails the task when the checkpoint fails', async () => {
    const h = harness({
      checkpoint: async () => {
        throw new Error('git locked');
      },
    });
    const state = createRunner(TASKS, ORDER);
    const result = await runSingleTask(state, TASKS[0], h.deps);
    expect(result.advance).toBe(false);
    expect(result.record).toMatchObject({ status: 'failed', error: 'git locked' });
  });
});

describe('task_runs persistence', () => {
  it('round-trips records and overwrites on retry', async () => {
    const db = await openProjectDb();
    expect(await loadTaskRuns('/p', db)).toEqual([]);
    await saveTaskRun('/p', doneRecord('T01'), db);
    await saveTaskRun('/p', { ...doneRecord('T02'), status: 'running', resultCommit: null }, db);
    let loaded = await loadTaskRuns('/p', db);
    expect(loaded).toHaveLength(2);
    expect(loaded.find((r) => r.taskId === 'T01')).toMatchObject({ status: 'done', resultCommit: 'commit-T01' });

    // Retry overwrites the same row (id = task id).
    await saveTaskRun(
      '/p',
      { ...doneRecord('T02'), status: 'failed', error: 'refusal', resultCommit: null },
      db,
    );
    loaded = await loadTaskRuns('/p', db);
    expect(loaded).toHaveLength(2);
    expect(loaded.find((r) => r.taskId === 'T02')).toMatchObject({ status: 'failed', error: 'refusal' });
  });

  it('ignores rows with unknown statuses', async () => {
    const db = await openProjectDb();
    await saveTaskRun('/p', doneRecord('T01'), db);
    await db.execute("UPDATE task_runs SET status = 'weird' WHERE id = 'T01'");
    expect(await loadTaskRuns('/p', db)).toEqual([]);
  });
});
