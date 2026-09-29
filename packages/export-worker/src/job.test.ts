// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CancelledError, exportJobSchema, formatEvent, parseJob, slidesJobSchema, throwIfCancelled, videoJobSchema } from './job';

const base = { version: 1, projectDir: 'C:/p', outDir: 'C:/o' } as const;

describe('exportJobSchema (T5.1)', () => {
  it('accepts a web job', () => {
    expect(exportJobSchema.safeParse({ ...base, kind: 'web', format: 'web' }).success).toBe(true);
  });

  it('accepts image/slides/video jobs with defaults', () => {
    const image = exportJobSchema.safeParse({ ...base, kind: 'image', shots: [{ name: 'a', t: 0 }], width: 1920, height: 1080, formats: ['png'], scales: [2] });
    expect(image.success).toBe(true);
    const slides = slidesJobSchema.safeParse({ ...base, kind: 'slides', slides: [{ name: 's1', t: 0 }], width: 1920, height: 1080 });
    expect(slides.success).toBe(true);
    if (slides.success) {
      expect(slides.data.scale).toBe(2);
      expect(slides.data.pptx).toBe(true);
      expect(slides.data.pdf).toBe(true);
    }
    const video = videoJobSchema.safeParse({ ...base, kind: 'video', width: 1920, height: 1080, duration: 15 });
    expect(video.success).toBe(true);
    if (video.success) {
      expect(video.data.fps).toBe(30);
      expect(video.data.workers).toBe('auto');
      expect(video.data.poster).toEqual({ name: 'poster', t: 0 });
    }
  });

  it('rejects unknown kinds and empty shot lists', () => {
    expect(exportJobSchema.safeParse({ ...base, kind: 'pdf' }).success).toBe(false);
    expect(exportJobSchema.safeParse({ ...base, kind: 'image', shots: [], width: 1, height: 1, formats: ['png'], scales: [1] }).success).toBe(false);
  });
});

describe('parseJob', () => {
  it('parses valid JSON and reports schema issues in one error', () => {
    expect(parseJob(JSON.stringify({ ...base, kind: 'web', format: 'web' })).kind).toBe('web');
    expect(() => parseJob('nope')).toThrow(/not JSON/);
    expect(() => parseJob(JSON.stringify({ kind: 'web' }))).toThrow(/export job: invalid/);
  });
});

describe('progress events and cancellation', () => {
  it('formats NDJSON lines', () => {
    const line = formatEvent({ type: 'progress', percent: 50, step: 'build' });
    expect(JSON.parse(line)).toEqual({ type: 'progress', percent: 50, step: 'build' });
  });

  it('throwIfCancelled throws only when aborted', () => {
    expect(() => throwIfCancelled()).not.toThrow();
    const c = new AbortController();
    const fn = vi.fn();
    expect(() => {
      throwIfCancelled(c.signal);
      fn();
    }).not.toThrow();
    expect(fn).toHaveBeenCalledOnce();
    c.abort();
    expect(() => throwIfCancelled(c.signal)).toThrow(CancelledError);
  });
});
