// Export worker orchestration (T5.1): one job → steps → NDJSON events.
//
// Steps (web/image/slides/video, T5.3+) are injected so the skeleton is
// testable with mocks and each format stays in its own module. The only
// process spawning primitive is `spawnFixed`: fixed argv (D-012), stdin
// closed (a waiting CLI would hang the worker, S7), console window hidden,
// AbortSignal kills the child tree promptly.
import { spawn } from 'node:child_process';
import { buildExportEnv, type FfmpegPaths } from './env';
import { CancelledError, formatEvent, throwIfCancelled, type ExportJob, type JobEvent, type ProgressFn } from './job';

export interface SpawnOptions {
  env?: NodeJS.ProcessEnv;
  ffmpeg?: FfmpegPaths;
  /** Working directory of the child. Export builds run with the project dir (W1 fix). */
  cwd?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Receives stdout/stderr lines while the child runs (forwarded as `log` events by runExport). */
  onLine?: (stream: 'stdout' | 'stderr', line: string) => void;
}

export interface SpawnResult {
  code: number | null;
}

const forwardLines = (chunk: string, emit: (line: string) => void): string => {
  const text = chunk;
  const parts = text.split('\n');
  for (let i = 0; i < parts.length - 1; i++) emit(parts[i].replace(/\r$/, ''));
  return parts[parts.length - 1];
};

/** Spawn with fixed argv. Never uses a shell; stdin is closed. */
export function spawnFixed(bin: string, args: readonly string[], options: SpawnOptions = {}): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new CancelledError());
      return;
    }
    const child = spawn(bin, [...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: options.cwd,
      env: buildExportEnv(options.env ?? process.env, options.ffmpeg),
      windowsHide: true,
      shell: false,
    });
    let pending = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => {
      if (!options.onLine) return;
      pending = forwardLines(pending + d, (line) => options.onLine?.('stdout', line));
    });
    child.stderr.setEncoding('utf8').on('data', (d: string) => {
      if (!options.onLine) return;
      pending = forwardLines(pending + d, (line) => options.onLine?.('stderr', line));
    });
    const timer = options.timeoutMs ? setTimeout(() => child.kill(), options.timeoutMs) : undefined;
    const onAbort = (): void => {
      child.kill();
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    child.on('error', (e) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      if (options.signal?.aborted) reject(new CancelledError());
      else if (options.timeoutMs && code === null) reject(new Error(`export worker: ${bin} timed out after ${options.timeoutMs}ms`));
      else resolve({ code });
    });
  });
}

// ---- job dispatch ----------------------------------------------------------

export interface StepContext {
  onEvent: ProgressFn;
  signal?: AbortSignal;
}

export interface Steps {
  web: (job: Extract<ExportJob, { kind: 'web' }>, ctx: StepContext) => Promise<string[]>;
  image: (job: Extract<ExportJob, { kind: 'image' }>, ctx: StepContext) => Promise<string[]>;
  slides: (job: Extract<ExportJob, { kind: 'slides' }>, ctx: StepContext) => Promise<string[]>;
  video: (job: Extract<ExportJob, { kind: 'video' }>, ctx: StepContext) => Promise<string[]>;
}

/** Run one job and emit `done` (returns the file list). Throws CancelledError or Error. */
export async function runExport(job: ExportJob, steps: Steps, onEvent: (e: JobEvent) => void, signal?: AbortSignal): Promise<string[]> {
  throwIfCancelled(signal);
  const ctx: StepContext = { onEvent, signal };
  let files: string[];
  switch (job.kind) {
    case 'web':
      files = await steps.web(job, ctx);
      break;
    case 'image':
      files = await steps.image(job, ctx);
      break;
    case 'slides':
      files = await steps.slides(job, ctx);
      break;
    case 'video':
      files = await steps.video(job, ctx);
      break;
  }
  throwIfCancelled(signal);
  onEvent({ type: 'done', outDir: job.outDir, files });
  return files;
}

/** Format helper for CLIs: print one NDJSON line per event. */
export const printEvent = (e: JobEvent): void => {
  process.stdout.write(`${formatEvent(e)}\n`);
};
