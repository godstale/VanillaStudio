// image export (T5.5): Technical-Design §7.
//
// Render build (`vite build`, same bundle as video/slides — `?mode=render`
// switches the runtime) → serve → one capture pass per format × scale →
// PNG/JPG/WebP files (`<shot>@<scale>x.<ext>`).
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { captureShots, serveStatic, type ScreenshotType, type StaticServer } from './capture';
import { throwIfCancelled, type ImageJob } from './job';
import { type StepContext } from './run';
import { runViteBuild, type ViteBuildOptions } from './web';

export interface ImageDeps {
  runBuild?: (options: ViteBuildOptions) => Promise<void>;
  serve?: (distDir: string) => Promise<StaticServer>;
  capture?: typeof captureShots;
}

const toScreenshotType = (format: ImageJob['formats'][number]): ScreenshotType => (format === 'jpg' ? 'jpeg' : format);

/** Capture every format × scale. Emits progress; returns absolute image paths. */
export async function exportImageShots(job: ImageJob, ctx: StepContext, deps: ImageDeps = {}): Promise<string[]> {
  const runBuild = deps.runBuild ?? runViteBuild;
  const serve = deps.serve ?? serveStatic;
  const capture = deps.capture ?? captureShots;
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
    const combos = job.formats.flatMap((format) => job.scales.map((scale) => ({ format, scale })));
    for (let i = 0; i < combos.length; i++) {
      throwIfCancelled(ctx.signal);
      const { format, scale } = combos[i];
      ctx.onEvent({ type: 'progress', percent: 10 + Math.round((80 * i) / combos.length), step: 'capture', message: `${format} @${scale}x` });
      const shotFiles = await capture({
        baseUrl: server.url,
        shots: job.shots,
        width: job.width,
        height: job.height,
        scale,
        type: toScreenshotType(format),
        outDir: job.outDir,
        executablePath: job.chromePath,
        signal: ctx.signal,
      });
      files.push(...shotFiles);
    }
  } finally {
    await server.close();
    rmSync(path.join(job.outDir, '.build'), { recursive: true, force: true });
  }
  throwIfCancelled(ctx.signal);
  ctx.onEvent({ type: 'progress', percent: 100, step: 'done', message: `${files.length} images` });
  return files;
}
