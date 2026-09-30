// video export (T5.8): Technical-Design §2.3, §7, S1.
//
// Render build (`vite build`) → stamp the HyperFrames composition attributes
// the scaffold does not emit yet (`data-duration/fps/width/height`,
// `data-no-timeline`) → `hyperframes render --workers <mem-based>` →
// MP4/WebM + poster still. Environment always goes through `buildExportEnv`
// (T5.1: no tracking, no skill fetch, no Gemini vision).
//
// Release hardware baseline (M5 lesson, see `wiki/sources/milestone-m5.md`:
// workers:2 stalled with 2 browsers and no navigation 3/3; workers:1 on the
// GPU path reached frame 12/30 then `ERR_NETWORK_CHANGED`; later attempts
// stalled at frame 0 on the same fixture/handshake, so host state, not code):
// `--workers` stays memory-sized (~4GiB per worker, clamped to [1, cpus]),
// and release/CI renders should prefer software GL (`--no-browser-gpu`
// where the pinned HyperFrames supports it) for headless determinism.
// Re-verify on release hardware in T7.2; this lane retries no renders.
import { cpus, totalmem } from 'node:os';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { captureShots, serveStatic, type StaticServer } from './capture';
import { throwIfCancelled, type VideoJob } from './job';
import { spawnFixed, type StepContext } from './run';
import { runViteBuild, type ViteBuildOptions } from './web';

/** ~4GiB per render worker (S1: "V8 heap 4GB → 4 workers recommended").
 * Release rule (M5): size from memory, never from CPU count alone — each
 * worker holds a full headless browser + frame buffers. */
export const BYTES_PER_WORKER = 4 * 1024 * 1024 * 1024;

/** Size `--workers` from memory, clamped to [1, cpus]. */
export function resolveWorkerCount(options: { totalMemBytes?: number; cpuCount?: number } = {}): number {
  const cpus_ = options.cpuCount ?? cpus().length;
  const mem = options.totalMemBytes ?? totalmem();
  const byMem = Math.floor(mem / BYTES_PER_WORKER);
  const cap = Number.isFinite(cpus_) && cpus_ > 0 ? Math.floor(cpus_) : 1;
  return Math.min(Math.max(1, byMem), cap);
}

export interface RenderBundleOptions {
  compositionId?: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
}

/**
 * Stamp the composition attributes HyperFrames reads (S1) onto the built
 * `index.html` root. The scaffold will own this markup later (handoff);
 * until then the worker makes the render bundle explicit from the job.
 */
export function prepareRenderBundle(distDir: string, options: RenderBundleOptions): string {
  const htmlPath = path.join(distDir, 'index.html');
  if (!existsSync(htmlPath)) throw new Error(`export worker: no index.html in render bundle at ${distDir}`);
  const attrs = [
    `data-composition-id="${options.compositionId ?? 'main'}"`,
    `data-duration="${options.duration}"`,
    `data-fps="${options.fps}"`,
    `data-width="${options.width}"`,
    `data-height="${options.height}"`,
    'data-no-timeline',
  ];
  const html = readFileSync(htmlPath, 'utf8');
  const m = /<div([^>]*)\bid\s*=\s*["']root["']([^>]*)>/.exec(html);
  if (!m) throw new Error('export worker: render bundle index.html has no <div id="root">');
  let tag = m[0];
  for (const attr of attrs) {
    const name = attr.split('=')[0];
    tag = tag.includes(`${name}=`) || tag.includes(name) ? tag.replace(new RegExp(`\\s${name}(="[^"]*")?`), ` ${attr}`) : tag.replace(/>$/, ` ${attr}>`);
  }
  writeFileSync(htmlPath, `${html.slice(0, m.index)}${tag}${html.slice(m.index + m[0].length)}`);
  return htmlPath;
}

// ---- HyperFrames invocation ------------------------------------------------

export interface HyperframesCommand {
  bin: string;
  prefixArgs: string[];
}

/**
 * Resolve how to run HyperFrames: an explicit JS entry runs under node (the
 * ACP-adapter pattern, §3.1), a native executable runs directly. Falls back
 * to the project's own hyperframes install; otherwise the app (T5.2) must
 * install it and pass the path in the job.
 */
export function resolveHyperframesBin(options: { hyperframesBin?: string; projectDir: string }): HyperframesCommand {
  const asCommand = (file: string): HyperframesCommand =>
    /\.[cm]?js$/.test(file) ? { bin: process.execPath, prefixArgs: [file] } : { bin: file, prefixArgs: [] };
  if (options.hyperframesBin) {
    if (!existsSync(options.hyperframesBin)) throw new Error(`export worker: hyperframes not found at ${options.hyperframesBin}`);
    return asCommand(options.hyperframesBin);
  }
  const pkgPath = path.join(options.projectDir, 'node_modules', 'hyperframes', 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { bin?: string | Record<string, string> };
    const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin ? Object.values(pkg.bin)[0] : undefined;
    if (rel) return asCommand(path.join(options.projectDir, 'node_modules', 'hyperframes', rel));
  }
  throw new Error('export worker: hyperframes is not installed (pass hyperframesBin in the job)');
}

export interface RenderOptions {
  distDir: string;
  outFile: string;
  format: 'mp4' | 'webm';
  workers: number;
}

export function buildHyperframesArgs(options: RenderOptions): string[] {
  return ['render', options.distDir, '-o', options.outFile, '--format', options.format, '--workers', String(options.workers), '--quiet'];
}

export interface HyperframesRunOptions {
  command: HyperframesCommand;
  args: string[];
  ffmpeg?: { ffmpegPath?: string; ffprobePath?: string };
  signal?: AbortSignal;
  onLog?: (stream: 'stdout' | 'stderr', line: string) => void;
}

/** Run HyperFrames with the export environment (T5.1). */
export async function runHyperframes(options: HyperframesRunOptions): Promise<void> {
  const r = await spawnFixed(options.command.bin, [...options.command.prefixArgs, ...options.args], {
    ffmpeg: options.ffmpeg,
    signal: options.signal,
    onLine: options.onLog,
  });
  if (r.code !== 0) throw new Error(`export worker: hyperframes render failed (exit ${r.code})`);
}

export interface VideoDeps {
  runBuild?: (options: ViteBuildOptions) => Promise<void>;
  render?: (options: HyperframesRunOptions) => Promise<void>;
  serve?: (distDir: string) => Promise<StaticServer>;
  capture?: typeof captureShots;
  workerCount?: (options?: { totalMemBytes?: number; cpuCount?: number }) => number;
}

/** Render the video and capture the poster. Returns `[video, poster.png]`. */
export async function exportVideo(job: VideoJob, ctx: StepContext, deps: VideoDeps = {}): Promise<string[]> {
  const runBuild = deps.runBuild ?? runViteBuild;
  const render = deps.render ?? runHyperframes;
  const serve = deps.serve ?? serveStatic;
  const capture = deps.capture ?? captureShots;
  const workerCount = deps.workerCount ?? resolveWorkerCount;
  throwIfCancelled(ctx.signal);
  const distDir = path.join(job.outDir, '.build', 'dist');
  mkdirSync(job.outDir, { recursive: true });
  ctx.onEvent({ type: 'progress', percent: 5, step: 'build', message: 'vite build (render bundle)' });
  await runBuild({
    projectDir: job.projectDir,
    distDir,
    ffmpeg: job.ffmpeg,
    signal: ctx.signal,
    onLog: (stream, line) => ctx.onEvent({ type: 'log', stream, line }),
  });
  throwIfCancelled(ctx.signal);
  prepareRenderBundle(distDir, { duration: job.duration, fps: job.fps, width: job.width, height: job.height });
  const workers = job.workers === 'auto' ? workerCount() : job.workers;
  const ext = job.format === 'webm' ? 'webm' : 'mp4';
  const outFile = path.join(job.outDir, `video.${ext}`);
  ctx.onEvent({ type: 'progress', percent: 15, step: 'render', message: `hyperframes render (${workers} workers)` });
  await render({
    command: resolveHyperframesBin({ hyperframesBin: job.hyperframesBin, projectDir: job.projectDir }),
    args: buildHyperframesArgs({ distDir, outFile, format: job.format, workers }),
    ffmpeg: job.ffmpeg,
    signal: ctx.signal,
    onLog: (stream, line) => ctx.onEvent({ type: 'log', stream, line }),
  });
  throwIfCancelled(ctx.signal);
  ctx.onEvent({ type: 'progress', percent: 90, step: 'poster', message: 'poster.png' });
  const server = await serve(distDir);
  try {
    const [poster] = await capture({
      baseUrl: server.url,
      shots: [job.poster],
      width: job.width,
      height: job.height,
      scale: 1,
      type: 'png',
      outDir: job.outDir,
      nameFor: () => 'poster.png',
      executablePath: job.chromePath,
      signal: ctx.signal,
    });
    return [outFile, poster];
  } finally {
    await server.close();
    rmSync(path.join(job.outDir, '.build'), { recursive: true, force: true });
    ctx.onEvent({ type: 'progress', percent: 100, step: 'done', message: `video.${ext} + poster.png` });
  }
}
