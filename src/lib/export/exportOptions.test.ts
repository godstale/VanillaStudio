import { describe, expect, it } from 'vitest';
import {
  defaultExportOptions,
  detailsFromOptions,
  labelForOptions,
  loadExportOptions,
  saveExportOptions,
  type OptionsStorage,
} from './exportOptions';

function memStorage(initial?: Record<string, string>): OptionsStorage & { data: Record<string, string> } {
  const data = { ...(initial ?? {}) };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('export options', () => {
  it('round-trips options through storage', () => {
    const storage = memStorage();
    const options = { ...defaultExportOptions(), kind: 'video' as const, video: { width: 1280, height: 720, fps: 24, duration: 10, format: 'webm' as const } };
    saveExportOptions(options, storage);
    expect(loadExportOptions(storage)).toEqual(options);
  });

  it('defaults the editable Beta flag to off', () => {
    const storage = memStorage({ 'vanilla.export.options.v1': JSON.stringify({ kind: 'slides', slides: { count: 2, editable: true } }) });
    expect(loadExportOptions(storage).slides).toMatchObject({ count: 2, editable: true });
    expect(loadExportOptions(memStorage()).slides.editable).toBe(false);
    const base = defaultExportOptions();
    expect(detailsFromOptions({ ...base, kind: 'slides' })).toMatchObject({ kind: 'slides', editable: false });
  });

  it('falls back to defaults on missing, corrupt or partial data', () => {
    expect(loadExportOptions(memStorage())).toEqual(defaultExportOptions());
    expect(loadExportOptions(memStorage({ 'vanilla.export.options.v1': 'nope{' }))).toEqual(defaultExportOptions());
    const partial = memStorage({ 'vanilla.export.options.v1': JSON.stringify({ kind: 'slides', slides: { count: 5 } }) });
    const loaded = loadExportOptions(partial);
    expect(loaded.kind).toBe('slides');
    expect(loaded.slides).toMatchObject({ count: 5, width: 1920, pptx: true, pdf: true });
  });

  it('converts each kind to valid job details', () => {
    const base = defaultExportOptions();
    expect(detailsFromOptions({ ...base, kind: 'web' })).toEqual({ kind: 'web', format: 'web' });
    expect(detailsFromOptions({ ...base, kind: 'interactive' })).toEqual({ kind: 'web', format: 'interactive' });
    const image = detailsFromOptions({ ...base, kind: 'image' });
    expect(image).toMatchObject({ kind: 'image', width: 1920, shots: [{ name: 'cover', t: 0 }] });
    const slides = detailsFromOptions({ ...base, kind: 'slides', slides: { ...base.slides, count: 2 } });
    expect(slides).toMatchObject({ kind: 'slides', slides: [{ name: 's1', t: 0 }, { name: 's2', t: 5 }] });
    expect(detailsFromOptions({ ...base, kind: 'video' })).toMatchObject({ kind: 'video', fps: 30, format: 'mp4' });
  });

  it('builds stable history labels', () => {
    const base = defaultExportOptions();
    expect(labelForOptions({ ...base, kind: 'video' })).toBe('video 1920x1080 15s');
    expect(labelForOptions({ ...base, kind: 'web' })).toBe('web');
  });
});
