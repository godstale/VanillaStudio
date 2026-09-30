import { describe, expect, it } from 'vitest';
import { buildExportJob, exportJobSchema, suggestOutDirName } from './jobBuilder';

describe('suggestOutDirName', () => {
  it('produces a sortable name without spaces', () => {
    const name = suggestOutDirName('video', new Date(2026, 8, 29, 15, 4, 7));
    expect(name).toBe('20260929-150407-video');
  });
});

describe('buildExportJob', () => {
  it('builds a valid web job under <project>/exports/', () => {
    const { json, outDir, job } = buildExportJob('C:\\p', { kind: 'web', format: 'web' }, new Date(2026, 0, 2, 3, 4, 5));
    expect(outDir).toBe('C:\\p/exports/20260102-030405-web');
    expect(job).toMatchObject({ version: 1, kind: 'web', projectDir: 'C:\\p', outDir });
    expect(exportJobSchema.safeParse(JSON.parse(json)).success).toBe(true);
  });

  it('builds image, slides and video jobs', () => {
    const image = buildExportJob('/p', {
      kind: 'image',
      width: 1920,
      height: 1080,
      formats: ['png'],
      scales: [1, 2],
      shots: [{ name: 'cover', t: 0 }],
    });
    expect(image.job).toMatchObject({ kind: 'image' });

    const slides = buildExportJob('/p', {
      kind: 'slides',
      width: 1920,
      height: 1080,
      scale: 2,
      pptx: true,
      pdf: false,
      editable: true,
      slides: [{ name: 's1', t: 0 }],
    });
    expect(slides.job).toMatchObject({ kind: 'slides', pdf: false, editable: true });

    const video = buildExportJob('/p', {
      kind: 'video',
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 15,
      format: 'mp4',
    });
    expect(video.job).toMatchObject({ kind: 'video', format: 'mp4', workers: 'auto' });
  });

  it('rejects invalid options with one error', () => {
    expect(() =>
      buildExportJob('/p', {
        kind: 'image',
        width: -1,
        height: 1080,
        formats: [],
        scales: [1],
        shots: [],
      }),
    ).toThrow(/export job: invalid/);
  });
});
