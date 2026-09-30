// slides export (T5.6): Technical-Design §7, S2.
//
// Per-slide capture (timeline layouts are time-addressed: slide i at its
// start `t`) → `slides.pptx` (pptxgenjs, LAYOUT_WIDE full-bleed images, S2:
// PowerPoint shows 3 slides at 960×540pt) + `slides.pdf` (pdf-lib, 16:9
// pages). The PNGs stay in the folder too (review/compare reuse).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import PptxGenJS from 'pptxgenjs';
import { captureShots, serveStatic, type StaticServer } from './capture';
import { throwIfCancelled, type SlidesJob } from './job';
import { type StepContext } from './run';
import { runViteBuild, type ViteBuildOptions } from './web';

/** 16:9 page in points (S2: PowerPoint shows 960×540pt). */
export const SLIDE_POINTS = { width: 960, height: 540 } as const;

/** One full-bleed image per PNG (S2-verified layout). */
export async function buildImagePptx(pngPaths: readonly string[], outPath: string): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  for (const png of pngPaths) {
    const slide = pptx.addSlide();
    slide.addImage({ path: png, x: 0, y: 0, w: '100%', h: '100%' });
  }
  await pptx.writeFile({ fileName: outPath });
  return outPath;
}

/** One 16:9 page per PNG. */
export async function buildSlidesPdf(pngPaths: readonly string[], outPath: string, width = SLIDE_POINTS.width, height = SLIDE_POINTS.height): Promise<string> {
  const doc = await PDFDocument.create();
  for (const png of pngPaths) {
    const image = await doc.embedPng(await readPng(png));
    const page = doc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  writeFileSync(outPath, await doc.save());
  return outPath;
}

async function readPng(pngPath: string): Promise<Uint8Array> {
  const { readFile } = await import('node:fs/promises');
  return readFile(pngPath);
}

export interface SlidesDeps {
  runBuild?: (options: ViteBuildOptions) => Promise<void>;
  serve?: (distDir: string) => Promise<StaticServer>;
  capture?: typeof captureShots;
  makePptx?: (pngs: readonly string[], outPath: string) => Promise<string>;
  makePdf?: (pngs: readonly string[], outPath: string) => Promise<string>;
}

/** Capture slides, then assemble PPTX/PDF. Returns all produced files. */
export async function exportSlides(job: SlidesJob, ctx: StepContext, deps: SlidesDeps = {}): Promise<string[]> {
  const runBuild = deps.runBuild ?? runViteBuild;
  const serve = deps.serve ?? serveStatic;
  const capture = deps.capture ?? captureShots;
  const makePptx = deps.makePptx ?? buildImagePptx;
  const makePdf = deps.makePdf ?? ((pngs, out) => buildSlidesPdf(pngs, out));
  throwIfCancelled(ctx.signal);
  const distDir = path.join(job.outDir, '.build', 'dist');
  mkdirSync(job.outDir, { recursive: true });
  ctx.onEvent({ type: 'progress', percent: 5, step: 'build', message: 'vite build' });
  await runBuild({
    projectDir: job.projectDir,
    distDir,
    ffmpeg: job.ffmpeg,
    signal: ctx.signal,
    onLog: (stream, line) => ctx.onEvent({ type: 'log', stream, line }),
  });
  throwIfCancelled(ctx.signal);
  const server = await serve(distDir);
  const files: string[] = [];
  try {
    ctx.onEvent({ type: 'progress', percent: 15, step: 'capture', message: `${job.slides.length} slides` });
    const pngs = await capture({
      baseUrl: server.url,
      shots: job.slides,
      width: job.width,
      height: job.height,
      scale: job.scale,
      type: 'png',
      outDir: job.outDir,
      executablePath: job.chromePath,
      signal: ctx.signal,
    });
    files.push(...pngs);
    throwIfCancelled(ctx.signal);
    if (job.pptx) {
      ctx.onEvent({ type: 'progress', percent: 80, step: 'pptx', message: 'slides.pptx' });
      files.push(await makePptx(pngs, path.join(job.outDir, 'slides.pptx')));
    }
    throwIfCancelled(ctx.signal);
    if (job.pdf) {
      ctx.onEvent({ type: 'progress', percent: 90, step: 'pdf', message: 'slides.pdf' });
      files.push(await makePdf(pngs, path.join(job.outDir, 'slides.pdf')));
    }
  } finally {
    await server.close();
    rmSync(path.join(job.outDir, '.build'), { recursive: true, force: true });
  }
  throwIfCancelled(ctx.signal);
  ctx.onEvent({ type: 'progress', percent: 100, step: 'done', message: `${files.length} files` });
  return files;
}
