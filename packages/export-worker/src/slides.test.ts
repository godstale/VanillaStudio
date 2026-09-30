// @vitest-environment node
import JSZip from 'jszip';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildImagePptx, buildSlidesPdf, exportSlides, SLIDE_POINTS } from './slides';
import type { SlidesJob } from './job';

// 1x1 opaque PNG (fixture for the assemblers; pixels come from real captures).
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const tmp = mkdtempSync(path.join(tmpdir(), 'vanilla-slides-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const pngs = (dir: string, n: number): string[] => {
  mkdirSync(dir, { recursive: true });
  return Array.from({ length: n }, (_, i) => {
    const p = path.join(dir, `s${i + 1}@2x.png`);
    writeFileSync(p, PIXEL);
    return p;
  });
};

const job = (outDir: string): SlidesJob => ({
  version: 1,
  kind: 'slides',
  projectDir: path.join(tmp, 'proj'),
  outDir,
  slides: [
    { name: 's1', t: 0 },
    { name: 's2', t: 4 },
    { name: 's3', t: 8 },
  ],
  width: 1920,
  height: 1080,
  scale: 2,
  pptx: true,
  pdf: true,
  editable: false,
});

describe('buildImagePptx (T5.6)', () => {
  it('writes one full-bleed picture per slide at 13.33x7.5in (LAYOUT_WIDE)', async () => {
    const files = pngs(path.join(tmp, 'px'), 3);
    const out = path.join(tmp, 'slides.pptx');
    await buildImagePptx(files, out);
    const zip = await JSZip.loadAsync(readFileSync(out));
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(3);
    // LAYOUT_WIDE = 13.33x7.5in = 12192000x6858000 EMU (matches S2's 960x540pt in PowerPoint).
    const presentation = await zip.files['ppt/presentation.xml'].async('string');
    expect(presentation).toContain('cx="12192000"');
    expect(presentation).toContain('cy="6858000"');
    const slide1 = await zip.files['ppt/slides/slide1.xml'].async('string');
    expect(slide1).toContain('<p:pic>');
  });
});

describe('buildSlidesPdf (T5.6)', () => {
  it('writes one 16:9 page per slide', async () => {
    const files = pngs(path.join(tmp, 'pdf'), 3);
    const out = path.join(tmp, 'slides.pdf');
    await buildSlidesPdf(files, out);
    const doc = await PDFDocument.load(readFileSync(out));
    expect(doc.getPageCount()).toBe(3);
    for (const page of doc.getPages()) {
      expect(page.getSize()).toEqual({ width: SLIDE_POINTS.width, height: SLIDE_POINTS.height });
    }
  });
});

describe('exportSlides (T5.6)', () => {
  it('captures, then assembles pptx+pdf, and reports progress', async () => {
    const outDir = path.join(tmp, 'out1');
    const server = { url: 'http://127.0.0.1:9/', close: vi.fn(() => Promise.resolve()) };
    const events: unknown[] = [];
    const files = await exportSlides(job(outDir), { onEvent: (e) => events.push(e) }, {
      runBuild: () => Promise.resolve(),
      serve: () => Promise.resolve(server),
      capture: (o) => Promise.resolve(o.shots.map((s) => path.join(o.outDir, `${s.name}@2x.png`))),
      makePptx: (p, out) => {
        expect(p).toHaveLength(3);
        writeFileSync(out, 'pptx');
        return Promise.resolve(out);
      },
      makePdf: (p, out) => {
        expect(p).toHaveLength(3);
        writeFileSync(out, 'pdf');
        return Promise.resolve(out);
      },
    });
    expect(files).toEqual([
      path.join(outDir, 's1@2x.png'),
      path.join(outDir, 's2@2x.png'),
      path.join(outDir, 's3@2x.png'),
      path.join(outDir, 'slides.pptx'),
      path.join(outDir, 'slides.pdf'),
    ]);
    expect(server.close).toHaveBeenCalledOnce();
    const steps = events.filter((e) => (e as { type: string }).type === 'progress').map((e) => (e as { step: string }).step);
    expect(steps).toEqual(['build', 'capture', 'pptx', 'pdf', 'done']);
  });

  it('skips disabled outputs and honors cancellation', async () => {
    const outDir = path.join(tmp, 'out2');
    const j = { ...job(outDir), pptx: false, pdf: false };
    const files = await exportSlides(j, { onEvent: () => {} }, {
      runBuild: () => Promise.resolve(),
      serve: () => Promise.resolve({ url: 'http://x/', close: () => Promise.resolve() }),
      capture: (o) => Promise.resolve(o.shots.map((s) => path.join(o.outDir, `${s.name}@2x.png`))),
    });
    expect(files).toHaveLength(3);
    const c = new AbortController();
    c.abort();
    await expect(exportSlides(j, { onEvent: () => {}, signal: c.signal }, {})).rejects.toThrow(/cancelled/);
  });
});
