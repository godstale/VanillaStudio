// web/interactive export (T5.3): Technical-Design §7.
//
// `vite build` (live mode is the scaffold default: free-time compositions play
// themselves, no render entry needed) → zip `dist/` → `<outDir>/site.zip`.
// The zip is deterministic (sorted entries, fixed timestamps) so repeated
// exports of the same build are byte-identical.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { throwIfCancelled, type WebJob } from './job';
import { spawnFixed, type StepContext } from './run';

/** Fixed timestamp so zips are reproducible (mirrors the runtime build rule). */
export const ZIP_EPOCH = new Date('2020-01-01T00:00:00.000Z');

export interface ViteBuildOptions {
  projectDir: string;
  /** Where vite writes the bundle (created empty). */
  distDir: string;
  viteBin?: string;
  node?: string;
  ffmpeg?: { ffmpegPath?: string; ffprobePath?: string };
  signal?: AbortSignal;
  onLog?: (stream: 'stdout' | 'stderr', line: string) => void;
}

/** `vite` bundled with the user project (the scaffold depends on it). */
export function resolveViteBin(projectDir: string): string {
  const bin = path.join(projectDir, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(bin)) throw new Error(`export worker: vite not found at ${bin} (run pnpm install in the project first)`);
  return bin;
}

/** `node <vite> build --outDir <dist> --emptyOutDir` (fixed argv, D-012), run with the project dir. */
export async function runViteBuild(options: ViteBuildOptions): Promise<void> {
  const viteBin = options.viteBin ?? resolveViteBin(options.projectDir);
  const r = await spawnFixed(options.node ?? process.execPath, [viteBin, 'build', '--outDir', options.distDir, '--emptyOutDir'], {
    cwd: options.projectDir,
    ffmpeg: options.ffmpeg,
    signal: options.signal,
    onLine: options.onLog,
  });
  if (r.code !== 0) throw new Error(`export worker: vite build failed (exit ${r.code})`);
}

/** Zip a directory (sorted, deterministic). Returns the zip path. */
export async function zipDirectory(srcDir: string, zipPath: string): Promise<string> {
  const zip = new JSZip();
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : [full];
      });
  if (!existsSync(srcDir)) throw new Error(`export worker: nothing to zip at ${srcDir}`);
  for (const full of walk(srcDir)) {
    const name = path.relative(srcDir, full).split(path.sep).join('/');
    zip.file(name, readFileSync(full), { date: ZIP_EPOCH, compression: 'DEFLATE', compressionOptions: { level: 9 } });
  }
  mkdirSync(path.dirname(zipPath), { recursive: true });
  writeFileSync(zipPath, await zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' }));
  return zipPath;
}

export interface WebDeps {
  runBuild?: (options: ViteBuildOptions) => Promise<void>;
  zipDir?: (srcDir: string, zipPath: string) => Promise<string>;
}

/** Build the project and zip it. Emits progress; returns `[site.zip]`. */
export async function exportWeb(job: WebJob, ctx: StepContext, deps: WebDeps = {}): Promise<string[]> {
  const runBuild = deps.runBuild ?? runViteBuild;
  const zipDir = deps.zipDir ?? zipDirectory;
  const distDir = path.join(job.outDir, '.build', 'dist');
  const zipPath = path.join(job.outDir, 'site.zip');
  throwIfCancelled(ctx.signal);
  ctx.onEvent({ type: 'progress', percent: 5, step: 'build', message: 'vite build' });
  mkdirSync(distDir, { recursive: true });
  await runBuild({
    projectDir: job.projectDir,
    distDir,
    ffmpeg: job.ffmpeg,
    signal: ctx.signal,
    onLog: (stream, line) => ctx.onEvent({ type: 'log', stream, line }),
  });
  throwIfCancelled(ctx.signal);
  if (!existsSync(path.join(distDir, 'index.html'))) throw new Error(`export worker: vite build produced no index.html in ${distDir}`);
  ctx.onEvent({ type: 'progress', percent: 80, step: 'zip', message: 'site.zip' });
  await zipDir(distDir, zipPath);
  rmSync(path.join(job.outDir, '.build'), { recursive: true, force: true });
  throwIfCancelled(ctx.signal);
  ctx.onEvent({ type: 'progress', percent: 100, step: 'done', message: 'site.zip' });
  void statSync(zipPath);
  return [zipPath];
}
