// Export worker job contract (T5.1): Technical-Design §6, §7.
//
// The app (Rust `process_mgr`, T5.2 UI) runs one worker per job:
//   `node vanilla-export.mjs <job.json>`
// The worker prints NDJSON progress events on stdout (one JSON object per
// line) and exits 0 on success, 2 when cancelled, 1 on failure.
// Cancellation: SIGINT/SIGTERM aborts the in-flight step (the CLI wires the
// signals to an AbortController; each step checks the signal between awaits
// and kills the child it spawned).
import { z } from 'zod';
import type { FfmpegPaths } from './env';

const absPath = z.string().min(1).refine((p) => !p.includes('\0'), 'must not contain NUL');

const baseJob = z.object({
  /** Schema version of this job file. */
  version: z.literal(1),
  /** Absolute path of the user project (the worker never reads outside it except for outputs). */
  projectDir: absPath,
  /** Absolute output directory (`exports/<ts>-<fmt>/`, created by the worker). */
  outDir: absPath,
  /** App-managed FFmpeg (Doctor download); forwarded as env vars, never via PATH. */
  ffmpeg: z.object({ ffmpegPath: z.string().optional(), ffprobePath: z.string().optional() }).optional(),
  /** Overrides (tests, custom installs). Defaults resolve like the app does. */
  hyperframesBin: z.string().optional(),
  chromePath: z.string().optional(),
});

const shotSchema = z.object({
  /** File-friendly name (`cover`, `s1-intro`). */
  name: z.string().min(1),
  /** Scene-local/global time in seconds (`?t=`). */
  t: z.number().min(0),
  /** Scene id (metadata for naming/logs; timeline layouts are addressed by `t`). */
  sceneId: z.string().optional(),
});

export const webJobSchema = baseJob.extend({
  kind: z.literal('web'),
  format: z.enum(['web', 'interactive']),
});

export const imageJobSchema = baseJob.extend({
  kind: z.literal('image'),
  shots: z.array(shotSchema).min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  formats: z.array(z.enum(['png', 'jpg', 'webp'])).min(1),
  scales: z.array(z.number().positive()).min(1),
});

export const slidesJobSchema = baseJob.extend({
  kind: z.literal('slides'),
  slides: z.array(shotSchema).min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  scale: z.number().positive().default(2),
  pptx: z.boolean().default(true),
  pdf: z.boolean().default(true),
});

export const videoJobSchema = baseJob.extend({
  kind: z.literal('video'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive().default(30),
  duration: z.number().positive(),
  format: z.enum(['mp4', 'webm']).default('mp4'),
  /** `auto` sizes `--workers` from memory (S1: ~4GiB per worker). */
  workers: z.union([z.literal('auto'), z.number().int().positive()]).default('auto'),
  /** Still captured from the render build for the export folder. */
  poster: shotSchema.default({ name: 'poster', t: 0 }),
});

export const exportJobSchema = z.discriminatedUnion('kind', [webJobSchema, imageJobSchema, slidesJobSchema, videoJobSchema]);

export type ExportJob = z.infer<typeof exportJobSchema>;
export type WebJob = z.infer<typeof webJobSchema>;
export type ImageJob = z.infer<typeof imageJobSchema>;
export type SlidesJob = z.infer<typeof slidesJobSchema>;
export type VideoJob = z.infer<typeof videoJobSchema>;
export type FfmpegConfig = FfmpegPaths;

/** Parse a job file's text. Returns the job or throws a single Error listing the issues. */
export function parseJob(text: string): ExportJob {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error('export job: file is not JSON');
  }
  const r = exportJobSchema.safeParse(raw);
  if (!r.success) throw new Error(`export job: invalid (${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')})`);
  return r.data;
}

// ---- progress (NDJSON) -----------------------------------------------------

export interface ProgressEvent {
  type: 'progress';
  /** 0..100 within the whole job. */
  percent: number;
  step: string;
  message?: string;
}

export interface LogEvent {
  type: 'log';
  stream: 'stdout' | 'stderr';
  line: string;
}

export interface DoneEvent {
  type: 'done';
  outDir: string;
  files: string[];
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type JobEvent = ProgressEvent | LogEvent | DoneEvent | ErrorEvent;
export type ProgressFn = (e: ProgressEvent | LogEvent) => void;

/** Serialize one NDJSON line. */
export function formatEvent(e: JobEvent): string {
  return JSON.stringify(e);
}

/** Thrown (or signalled) when the job is cancelled. Steps should stop promptly. */
export class CancelledError extends Error {
  constructor() {
    super('export job: cancelled');
    this.name = 'CancelledError';
  }
}

/** Throw CancelledError when `signal` is aborted. Call between steps and after child runs. */
export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CancelledError();
}
