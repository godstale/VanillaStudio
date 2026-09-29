// Per-type export options (T5.9): defaults, persistence and conversion to
// worker job details. The dialog edits these; the queue consumes them.
import type { ExportBuildDetails } from './jobBuilder';
import type { ExportKind } from './types';

export interface ImageExportOptions {
  width: number;
  height: number;
  formats: Array<'png' | 'jpg' | 'webp'>;
  scales: number[];
}

export interface SlidesExportOptions {
  width: number;
  height: number;
  scale: number;
  /** Number of slides; times are spaced 5s until composition data arrives (P lane). */
  count: number;
  pptx: boolean;
  pdf: boolean;
  /** Editable PPTX (Beta, T5.7): DOM conversion next to the image outputs. */
  editable: boolean;
}

export interface VideoExportOptions {
  width: number;
  height: number;
  fps: number;
  duration: number;
  format: 'mp4' | 'webm';
}

export interface ExportOptions {
  kind: ExportKind;
  image: ImageExportOptions;
  slides: SlidesExportOptions;
  video: VideoExportOptions;
}

export const SIZE_PRESETS: ReadonlyArray<{ id: string; width: number; height: number }> = [
  { id: '1080p', width: 1920, height: 1080 },
  { id: '720p', width: 1280, height: 720 },
  { id: 'square', width: 1080, height: 1080 },
  { id: 'portrait', width: 1080, height: 1920 },
  { id: '4k', width: 3840, height: 2160 },
];

export function defaultExportOptions(): ExportOptions {
  return {
    kind: 'web',
    image: { width: 1920, height: 1080, formats: ['png'], scales: [2] },
    slides: { width: 1920, height: 1080, scale: 2, count: 3, pptx: true, pdf: true, editable: false },
    video: { width: 1920, height: 1080, fps: 30, duration: 15, format: 'mp4' },
  };
}

const STORAGE_KEY = 'vanilla.export.options.v1';

export interface OptionsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Merge stored JSON over the defaults (unknown kinds/fields are ignored). */
export function loadExportOptions(storage?: OptionsStorage): ExportOptions {
  const defaults = defaultExportOptions();
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return defaults;
  }
  if (!isRecord(parsed)) return defaults;
  const kind = parsed.kind;
  const next: ExportOptions = {
    ...defaults,
    kind: kind === 'web' || kind === 'interactive' || kind === 'image' || kind === 'slides' || kind === 'video' ? kind : defaults.kind,
  };
  if (isRecord(parsed.image)) {
    const formats = Array.isArray(parsed.image.formats)
      ? parsed.image.formats.filter((f: unknown): f is 'png' | 'jpg' | 'webp' => f === 'png' || f === 'jpg' || f === 'webp')
      : [];
    const scales = Array.isArray(parsed.image.scales) ? parsed.image.scales.filter((s: unknown) => typeof s === 'number' && s > 0) : [];
    next.image = {
      width: num(parsed.image.width, defaults.image.width),
      height: num(parsed.image.height, defaults.image.height),
      formats: formats.length > 0 ? formats : defaults.image.formats,
      scales: scales.length > 0 ? scales : defaults.image.scales,
    };
  }
  if (isRecord(parsed.slides)) {
    next.slides = {
      width: num(parsed.slides.width, defaults.slides.width),
      height: num(parsed.slides.height, defaults.slides.height),
      scale: num(parsed.slides.scale, defaults.slides.scale),
      count: Math.min(100, Math.max(1, Math.floor(num(parsed.slides.count, defaults.slides.count)))),
      pptx: parsed.slides.pptx !== false,
      pdf: parsed.slides.pdf !== false,
      editable: parsed.slides.editable === true,
    };
  }
  if (isRecord(parsed.video)) {
    next.video = {
      width: num(parsed.video.width, defaults.video.width),
      height: num(parsed.video.height, defaults.video.height),
      fps: Math.min(120, Math.max(1, Math.floor(num(parsed.video.fps, defaults.video.fps)))),
      duration: num(parsed.video.duration, defaults.video.duration),
      format: parsed.video.format === 'webm' ? 'webm' : 'mp4',
    };
  }
  return next;
}

export function saveExportOptions(options: ExportOptions, storage?: OptionsStorage): void {
  storage?.setItem(STORAGE_KEY, JSON.stringify(options));
}

/** localStorage-backed options (undefined outside the browser/test without DOM). */
export function browserOptionsStorage(): OptionsStorage | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    return {
      getItem: (k) => localStorage.getItem(k),
      setItem: (k, v) => localStorage.setItem(k, v),
    };
  } catch {
    return undefined;
  }
}

/** Convert dialog options to queue job details. */
export function detailsFromOptions(options: ExportOptions): ExportBuildDetails {
  switch (options.kind) {
    case 'web':
      return { kind: 'web', format: 'web' };
    case 'interactive':
      return { kind: 'web', format: 'interactive' };
    case 'image':
      return {
        kind: 'image',
        width: Math.floor(options.image.width),
        height: Math.floor(options.image.height),
        formats: [...options.image.formats],
        scales: [...options.image.scales],
        shots: [{ name: 'cover', t: 0 }],
      };
    case 'slides':
      return {
        kind: 'slides',
        width: Math.floor(options.slides.width),
        height: Math.floor(options.slides.height),
        scale: options.slides.scale,
        pptx: options.slides.pptx,
        pdf: options.slides.pdf,
        editable: options.slides.editable,
        slides: Array.from({ length: options.slides.count }, (_, i) => ({ name: `s${i + 1}`, t: i * 5 })),
      };
    case 'video':
      return {
        kind: 'video',
        width: Math.floor(options.video.width),
        height: Math.floor(options.video.height),
        fps: Math.floor(options.video.fps),
        duration: options.video.duration,
        format: options.video.format,
      };
  }
}

/** Stable history label (not translated, so history survives locale switches). */
export function labelForOptions(options: ExportOptions): string {
  switch (options.kind) {
    case 'web':
      return 'web';
    case 'interactive':
      return 'interactive';
    case 'image':
      return `image ${options.image.width}x${options.image.height}`;
    case 'slides':
      return `slides ${options.slides.width}x${options.slides.height}`;
    case 'video':
      return `video ${options.video.width}x${options.video.height} ${options.video.duration}s`;
  }
}
