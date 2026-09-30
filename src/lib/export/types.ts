// Export job model (T5.2): the frontend mirror of the worker contract
// (`packages/export-worker/src/job.ts`: job JSON, NDJSON events, exit codes)
// and the backend events (`src-tauri/src/commands/export_commands.rs`).

export type ExportKind = 'web' | 'interactive' | 'image' | 'slides' | 'video';

export type ExportJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface ExportLogLine {
  stream: 'stdout' | 'stderr';
  line: string;
}

export interface ExportJobRecord {
  id: string;
  kind: ExportKind;
  label: string;
  status: ExportJobStatus;
  /** 0..100 of the running job. */
  percent: number;
  step: string;
  logs: ExportLogLine[];
  files: string[];
  outDir: string | null;
  error: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

/** One NDJSON line the worker prints on stdout. */
export type WorkerEvent =
  | { type: 'progress'; percent: number; step: string; message?: string }
  | { type: 'log'; stream: 'stdout' | 'stderr'; line: string }
  | { type: 'done'; outDir: string; files: string[] }
  | { type: 'error'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Parse one worker stdout line. Returns null when the line is not an event. */
export function parseWorkerLine(line: string): WorkerEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(raw) || typeof raw.type !== 'string') return null;
  switch (raw.type) {
    case 'progress':
      if (typeof raw.percent !== 'number' || typeof raw.step !== 'string') return null;
      return {
        type: 'progress',
        percent: raw.percent,
        step: raw.step,
        message: typeof raw.message === 'string' ? raw.message : undefined,
      };
    case 'log':
      if ((raw.stream !== 'stdout' && raw.stream !== 'stderr') || typeof raw.line !== 'string') return null;
      return { type: 'log', stream: raw.stream, line: raw.line };
    case 'done':
      if (typeof raw.outDir !== 'string' || !Array.isArray(raw.files) || !raw.files.every((f: unknown) => typeof f === 'string'))
        return null;
      return { type: 'done', outDir: raw.outDir, files: [...(raw.files as string[])] };
    case 'error':
      if (typeof raw.message !== 'string') return null;
      return { type: 'error', message: raw.message };
    default:
      return null;
  }
}

/** Worker exit codes (cli.ts): 0 done, 2 cancelled, 1 failed. */
export function statusFromExit(code: number | null): ExportJobStatus {
  if (code === 0) return 'done';
  if (code === 2) return 'cancelled';
  return 'failed';
}

export function isTerminalStatus(status: ExportJobStatus): boolean {
  return status === 'done' || status === 'failed' || status === 'cancelled';
}

export function newJobRecord(id: string, kind: ExportKind, label: string): ExportJobRecord {
  return {
    id,
    kind,
    label,
    status: 'queued',
    percent: 0,
    step: '',
    logs: [],
    files: [],
    outDir: null,
    error: null,
    startedAt: null,
    endedAt: null,
  };
}

/** Fold one worker event into a job record (pure, tested). */
export function applyWorkerEvent(job: ExportJobRecord, event: WorkerEvent): ExportJobRecord {
  switch (event.type) {
    case 'progress':
      return {
        ...job,
        status: 'running',
        percent: Math.min(100, Math.max(0, event.percent)),
        step: event.message ? `${event.step}: ${event.message}` : event.step,
      };
    case 'log':
      return { ...job, logs: [...job.logs, { stream: event.stream, line: event.line }] };
    case 'done':
      return { ...job, status: 'done', percent: 100, files: event.files, outDir: event.outDir };
    case 'error':
      return { ...job, status: 'failed', error: event.message };
  }
}
