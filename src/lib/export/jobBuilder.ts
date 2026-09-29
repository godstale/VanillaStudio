// Export job documents (T5.2): the frontend mirror of the worker job schema
// (`packages/export-worker/src/job.ts`). The UI builds one JSON document per
// job; the backend only inspects `kind` and the paths before spawning the
// worker with fixed argv (D-012).
import { z } from 'zod';
import type { ExportKind } from './types';

const shotSchema = z.object({
  name: z.string().min(1),
  t: z.number().min(0),
  sceneId: z.string().optional(),
});

const baseJob = z.object({
  version: z.literal(1),
  projectDir: z.string().min(1),
  outDir: z.string().min(1),
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
  /** Editable PPTX (Beta, T5.7): DOM conversion next to the image outputs. */
  editable: z.boolean().default(false),
});

export const videoJobSchema = baseJob.extend({
  kind: z.literal('video'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive().default(30),
  duration: z.number().positive(),
  format: z.enum(['mp4', 'webm']).default('mp4'),
  workers: z.union([z.literal('auto'), z.number().int().positive()]).default('auto'),
  poster: shotSchema.default({ name: 'poster', t: 0 }),
});

export const exportJobSchema = z.discriminatedUnion('kind', [
  webJobSchema,
  imageJobSchema,
  slidesJobSchema,
  videoJobSchema,
]);

export type ExportJobDocument = z.infer<typeof exportJobSchema>;

export type ExportFormat = 'web' | 'interactive' | 'image' | 'slides' | 'video';

/** Per-kind fields the option dialog (T5.9) collects; shots come from the composition later. */
export type ExportBuildDetails =
  | { kind: 'web'; format: 'web' | 'interactive' }
  | {
      kind: 'image';
      width: number;
      height: number;
      formats: Array<'png' | 'jpg' | 'webp'>;
      scales: number[];
      shots: Array<{ name: string; t: number }>;
    }
  | {
      kind: 'slides';
      width: number;
      height: number;
      scale: number;
      pptx: boolean;
      pdf: boolean;
      editable: boolean;
      slides: Array<{ name: string; t: number }>;
    }
  | {
      kind: 'video';
      width: number;
      height: number;
      fps: number;
      duration: number;
      format: 'mp4' | 'webm';
    };

/** Folder name under `<project>/exports/`: sortable, no spaces. */
export function suggestOutDirName(kind: ExportKind, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${stamp}-${kind}`;
}

function joinChild(dir: string, child: string): string {
  return `${dir.replace(/[/\\]+$/, '')}/${child}`;
}

/**
 * Build and validate one job document. The out dir is always
 * `<projectDir>/exports/<stamp>-<kind>/`, so the backend containment check
 * (`out-dir-outside-project`) passes by construction.
 */
export function buildExportJob(
  projectDir: string,
  details: ExportBuildDetails,
  now: Date = new Date(),
): { json: string; outDir: string; job: ExportJobDocument } {
  const outDir = joinChild(joinChild(projectDir, 'exports'), suggestOutDirName(details.kind, now));
  const base = { version: 1 as const, projectDir, outDir };
  let raw: unknown;
  switch (details.kind) {
    case 'web':
      raw = { ...base, kind: 'web' as const, format: details.format };
      break;
    case 'image':
      raw = {
        ...base,
        kind: 'image' as const,
        shots: details.shots,
        width: details.width,
        height: details.height,
        formats: details.formats,
        scales: details.scales,
      };
      break;
    case 'slides':
      raw = {
        ...base,
        kind: 'slides' as const,
        slides: details.slides,
        width: details.width,
        height: details.height,
        scale: details.scale,
        pptx: details.pptx,
        pdf: details.pdf,
        editable: details.editable,
      };
      break;
    case 'video':
      raw = {
        ...base,
        kind: 'video' as const,
        width: details.width,
        height: details.height,
        fps: details.fps,
        duration: details.duration,
        format: details.format,
      };
      break;
  }
  const parsed = exportJobSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`export job: invalid (${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')})`);
  }
  return { json: JSON.stringify(parsed.data), outDir, job: parsed.data };
}
