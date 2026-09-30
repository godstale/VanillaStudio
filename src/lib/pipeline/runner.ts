import { assemblePrompt, type AssembleInput } from './assemble';
import type { Task } from './schemas/tasks';
import type { StopReason } from '@/lib/agents/types';
import type { Locale } from '@/lib/i18n/types';
import { getProjectDatabase, type SqlDatabase } from '@/lib/db/client';

export type RunnerMode = 'auto' | 'step';

export const TASK_RUN_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
export type TaskRunStatus = (typeof TASK_RUN_STATUSES)[number];

/**
 * task_runs 한 행. R2(T4.18)가 읽는 형식이다.
 * - `id`는 태스크 id와 같다(태스크당 1행 upsert, 재시도가 덮어쓴다).
 * - `status`: queued(대기·일시정지 후 되돌림) | running | done | failed.
 * - `resultCommit`: 태스크 후 체크포인트 커밋 id(변경 없으면 현재 HEAD, 실패 시 null).
 * - `error`: 실패·중단 사유(stopReason, 'cancelled', 전송 오류 메시지).
 */
export interface TaskRunRecord {
  id: string;
  taskId: string;
  sessionId: string | null;
  status: TaskRunStatus;
  startedAt: string | null;
  endedAt: string | null;
  resultCommit: string | null;
  error: string | null;
}

export interface RunnerState {
  tasks: Task[];
  /** 위상 정렬된 실행 순서(태스크 id). parseTasks의 order를 그대로 넘긴다. */
  order: string[];
  /** order에서 다음으로 실행할 위치. */
  cursor: number;
  mode: RunnerMode;
  paused: boolean;
  /** 태스크 id → 실행 기록. */
  runs: Record<string, TaskRunRecord>;
  startedAt: string | null;
  endedAt: string | null;
}

export type RunnerStatus = 'idle' | 'running' | 'paused' | 'done' | 'failed' | 'stopped';

/** 실행기 초기 상태. order는 parseTasks/normalize된 위상 순서다. */
export function createRunner(tasks: Task[], order: string[], mode: RunnerMode = 'auto'): RunnerState {
  return { tasks, order, cursor: 0, mode, paused: false, runs: {}, startedAt: null, endedAt: null };
}

export function getTask(state: RunnerState, id: string): Task | null {
  return state.tasks.find((t) => t.id === id) ?? null;
}

/** 아직 done이 아닌 첫 순서 태스크. 없으면 null(모두 끝남). */
export function nextTask(state: RunnerState): Task | null {
  for (const id of state.order) {
    if (state.runs[id]?.status !== 'done') return getTask(state, id);
  }
  return null;
}

export function runnerStatus(state: RunnerState): RunnerStatus {
  const runs = Object.values(state.runs);
  if (runs.some((r) => r.status === 'running')) return 'running';
  if (state.paused) return 'paused';
  const pending = nextTask(state);
  if (pending === null) return state.order.length > 0 ? 'done' : 'idle';
  // A failed run stops the line; retryTask clears it back to queued.
  if (state.runs[pending.id]?.status === 'failed') return 'failed';
  if (state.startedAt === null) return 'idle';
  if (runs.length > 0 && runs.every((r) => r.status === 'queued')) return 'stopped';
  return 'running';
}

function stamp(now: () => string): string {
  return now();
}

/** 실행 기록 1건을 반영한다(불변 갱신). done이면 커서를 다음으로 옮긴다. */
export function applyRunRecord(
  state: RunnerState,
  record: TaskRunRecord,
  now: () => string = () => new Date().toISOString(),
): RunnerState {
  const runs = { ...state.runs, [record.taskId]: record };
  let cursor = state.cursor;
  if (record.status === 'done') {
    const idx = state.order.indexOf(record.taskId);
    if (idx >= 0) cursor = Math.max(cursor, idx + 1);
  }
  const startedAt = state.startedAt ?? (record.startedAt ?? stamp(now));
  const endedAt = nextTask({ ...state, runs }) === null ? (record.endedAt ?? stamp(now)) : state.endedAt;
  return { ...state, runs, cursor, startedAt, endedAt };
}

/** 실패·중단된 태스크를 다시 대기열에 넣는다(재시도). 커서도 되돌린다. */
export function retryTask(state: RunnerState, taskId: string): RunnerState {
  const prev = state.runs[taskId];
  const runs = { ...state.runs };
  if (prev) {
    runs[taskId] = { ...prev, status: 'queued', error: null, startedAt: null, endedAt: null, resultCommit: null };
  }
  const idx = state.order.indexOf(taskId);
  return {
    ...state,
    runs,
    cursor: idx >= 0 ? Math.min(state.cursor, idx) : state.cursor,
    endedAt: null,
  };
}

export function setRunnerPaused(state: RunnerState, paused: boolean): RunnerState {
  return { ...state, paused };
}

export function setRunnerMode(state: RunnerState, mode: RunnerMode): RunnerState {
  return { ...state, mode };
}

/** 태스크별 최신 상태(TaskGraph 표시·R2 수정요청이 그대로 쓴다). */
export function runStatuses(state: RunnerState): Record<string, TaskRunStatus> {
  return Object.fromEntries(state.order.map((id) => [id, state.runs[id]?.status ?? 'queued']));
}

export interface RunnerDeps {
  /**
   * 태스크 프롬프트 전송. useAgentSession().sendPrompt를
   * `(text) => sendPrompt(text)` 형태로 넘긴다. stopReason으로 판정한다.
   */
  send: (prompt: string, task: Task) => Promise<StopReason>;
  sessionId: string | null;
  /** 태스크 후 체크포인트. checkpointCommit 래퍼가 커밋 id를 돌려준다. */
  checkpoint: (task: Task) => Promise<string | null>;
  /** task_runs 기록(기본 saveTaskRun을 쓰거나 테스트 목을 넘긴다). */
  saveRun: (record: TaskRunRecord) => Promise<void>;
  /** true면 현재 태스크가 끝난 뒤 멈춘다(일시정지). */
  isPaused?: () => boolean;
  now?: () => string;
  locale?: Locale;
  project?: AssembleInput['project'];
}

export interface SingleRunResult {
  state: RunnerState;
  record: TaskRunRecord;
  /** false = 라인이 멈췄다(실패·중단·일시정지), true = 다음으로 진행 가능. */
  advance: boolean;
  stopped: boolean;
}

function buildTaskPrompt(task: Task, deps: Pick<RunnerDeps, 'locale' | 'project'>): string {
  return assemblePrompt({
    kind: 'build',
    locale: deps.locale ?? 'ko',
    project: deps.project,
    task: { id: task.id, kind: task.kind, target: task.target, prompt: task.prompt, dependsOn: task.dependsOn },
  });
}

/**
 * 태스크 1건 실행: running 기록 → sendPrompt → stopReason 판정 →
 * 성공 시 체크포인트 → task_runs 기록. 한 단계씩 모드의 단위 연산이자 auto의 반복 단위다.
 */
export async function runSingleTask(
  state: RunnerState,
  task: Task,
  deps: RunnerDeps,
): Promise<SingleRunResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  let current = state.startedAt === null ? { ...state, startedAt: now() } : state;
  const running: TaskRunRecord = {
    id: task.id,
    taskId: task.id,
    sessionId: deps.sessionId,
    status: 'running',
    startedAt: now(),
    endedAt: null,
    resultCommit: null,
    error: null,
  };
  current = applyRunRecord(current, running, now);
  await deps.saveRun(running);

  let stopReason: StopReason;
  try {
    stopReason = await deps.send(buildTaskPrompt(task, deps), task);
  } catch (e) {
    const failed: TaskRunRecord = {
      ...running,
      status: 'failed',
      endedAt: now(),
      error: e instanceof Error ? e.message : String(e),
    };
    const next = applyRunRecord(current, failed, now);
    await deps.saveRun(failed);
    return { state: next, record: failed, advance: false, stopped: false };
  }

  if (stopReason === 'cancelled') {
    const queued: TaskRunRecord = { ...running, status: 'queued', endedAt: now(), error: 'cancelled' };
    const next = applyRunRecord(current, queued, now);
    await deps.saveRun(queued);
    return { state: next, record: queued, advance: false, stopped: true };
  }
  if (stopReason !== 'end_turn') {
    const failed: TaskRunRecord = { ...running, status: 'failed', endedAt: now(), error: stopReason };
    const next = applyRunRecord(current, failed, now);
    await deps.saveRun(failed);
    return { state: next, record: failed, advance: false, stopped: false };
  }

  let resultCommit: string | null;
  try {
    resultCommit = await deps.checkpoint(task);
  } catch (e) {
    const failed: TaskRunRecord = {
      ...running,
      status: 'failed',
      endedAt: now(),
      error: e instanceof Error ? e.message : String(e),
    };
    const next = applyRunRecord(current, failed, now);
    await deps.saveRun(failed);
    return { state: next, record: failed, advance: false, stopped: false };
  }
  const done: TaskRunRecord = { ...running, status: 'done', endedAt: now(), resultCommit, error: null };
  const next = applyRunRecord(current, done, now);
  await deps.saveRun(done);
  if (deps.isPaused?.()) return { state: setRunnerPaused(next, true), record: done, advance: false, stopped: false };
  return { state: next, record: done, advance: true, stopped: false };
}

export interface RunAllOutcome {
  state: RunnerState;
  completed: string[];
  /** 실패한 태스크 id(없으면 null). */
  failed: string | null;
  stopped: boolean;
}

/**
 * 실행 루프. auto 모드는 라인이 멈출 때까지(완료·실패·중단·일시정지),
 * step 모드는 1건만 실행한다.
 */
export async function runAll(state: RunnerState, deps: RunnerDeps): Promise<RunAllOutcome> {
  let current = state.paused ? setRunnerPaused(state, false) : state;
  const completed: string[] = [];
  for (;;) {
    const task = nextTask(current);
    if (!task) {
      const endedAt = (deps.now ?? (() => new Date().toISOString()))();
      return { state: { ...current, endedAt }, completed, failed: null, stopped: false };
    }
    if (current.mode === 'step' && completed.length >= 1) return { state: current, completed, failed: null, stopped: false };
    const result = await runSingleTask(current, task, deps);
    current = result.state;
    if (result.record.status === 'done') completed.push(task.id);
    else if (result.record.status === 'failed') {
      return { state: current, completed, failed: task.id, stopped: false };
    }
    if (result.stopped || current.paused || !result.advance) {
      return { state: current, completed, failed: null, stopped: result.stopped };
    }
  }
}

interface TaskRunRow {
  id: string;
  task_id: string;
  session_id: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  result_commit: string | null;
  error: string | null;
}

function isTaskRunStatus(value: string): value is TaskRunStatus {
  return (TASK_RUN_STATUSES as readonly string[]).includes(value);
}

function toRecord(row: TaskRunRow): TaskRunRecord | null {
  if (!isTaskRunStatus(row.status)) return null;
  return {
    id: row.id,
    taskId: row.task_id,
    sessionId: row.session_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    resultCommit: row.result_commit,
    error: row.error,
  };
}

/** 프로젝트 DB(task_runs)에서 실행 기록을 읽는다. 없는 태스크는 row가 없다. */
export async function loadTaskRuns(workspaceRoot: string, db?: SqlDatabase): Promise<TaskRunRecord[]> {
  const conn = db ?? (await getProjectDatabase(workspaceRoot));
  const rows = await conn.select<TaskRunRow[]>(
    'SELECT id, task_id, session_id, status, started_at, ended_at, result_commit, error FROM task_runs',
  );
  return rows.map(toRecord).filter((r): r is TaskRunRecord => r !== null);
}

/** task_runs에 1행 upsert(id = 태스크 id). 재시도는 같은 행을 덮어쓴다. */
export async function saveTaskRun(
  workspaceRoot: string,
  record: TaskRunRecord,
  db?: SqlDatabase,
): Promise<void> {
  const conn = db ?? (await getProjectDatabase(workspaceRoot));
  await conn.execute(
    `INSERT INTO task_runs (id, task_id, session_id, status, started_at, ended_at, result_commit, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       task_id = excluded.task_id,
       session_id = excluded.session_id,
       status = excluded.status,
       started_at = excluded.started_at,
       ended_at = excluded.ended_at,
       result_commit = excluded.result_commit,
       error = excluded.error`,
    [
      record.id,
      record.taskId,
      record.sessionId,
      record.status,
      record.startedAt,
      record.endedAt,
      record.resultCommit,
      record.error,
    ],
  );
}
