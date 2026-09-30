// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { HyperframesRunOptions } from './video';
import { buildHyperframesArgs, exportVideo, prepareRenderBundle, resolveHyperframesBin, resolveWorkerCount, BYTES_PER_WORKER } from './video';
import type { VideoJob } from './job';

const tmp = mkdtempSync(path.join(tmpdir(), 'vanilla-video-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const hfBin = path.join(tmp, 'hf.mjs');

const job = (outDir: string): VideoJob => ({
  version: 1,
  kind: 'video',
  projectDir: path.join(tmp, 'proj'),
  outDir,
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 15,
  format: 'mp4',
  workers: 'auto',
  poster: { name: 'poster', t: 0 },
  hyperframesBin: hfBin,
});
writeFileSync(hfBin, '// fake hyperframes entry');

describe('resolveWorkerCount (T5.8, S1: ~4GiB per worker)', () => {
  it('sizes workers from memory, clamped to [1, cpus]', () => {
    expect(resolveWorkerCount({ totalMemBytes: 16 * 1024 ** 3, cpuCount: 12 })).toBe(4);
    expect(resolveWorkerCount({ totalMemBytes: 6 * BYTES_PER_WORKER, cpuCount: 12 })).toBe(6);
    expect(resolveWorkerCount({ totalMemBytes: 64 * BYTES_PER_WORKER, cpuCount: 8 })).toBe(8);
    expect(resolveWorkerCount({ totalMemBytes: BYTES_PER_WORKER, cpuCount: 8 })).toBe(1);
    expect(resolveWorkerCount({ totalMemBytes: 0, cpuCount: 8 })).toBe(1);
    expect(resolveWorkerCount({ totalMemBytes: 64 * BYTES_PER_WORKER, cpuCount: 0 })).toBe(1);
  });
});

describe('prepareRenderBundle (T5.8)', () => {
  it('stamps composition attributes onto the root div', () => {
    const dist = path.join(tmp, 'dist1');
    mkdirSync(dist, { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><body><div id="root"></div></body></html>');
    prepareRenderBundle(dist, { duration: 15, fps: 30, width: 1920, height: 1080 });
    const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
    expect(html).toContain('<div id="root" data-composition-id="main" data-duration="15" data-fps="30" data-width="1920" data-height="1080" data-no-timeline>');
  });

  it('replaces stale attributes and rejects bundles without a root', () => {
    const dist = path.join(tmp, 'dist2');
    mkdirSync(dist, { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), '<div id="root" data-duration="3" class="x">y</div>');
    prepareRenderBundle(dist, { duration: 15, fps: 30, width: 1920, height: 1080 });
    const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
    expect(html).toContain('data-duration="15"');
    expect(html).not.toContain('data-duration="3"');
    expect(html).toContain('class="x"');
    expect(() => prepareRenderBundle(path.join(tmp, 'missing'), { duration: 1, fps: 1, width: 1, height: 1 })).toThrow(/no index.html/);
    const noroot = path.join(tmp, 'dist3');
    mkdirSync(noroot, { recursive: true });
    writeFileSync(path.join(noroot, 'index.html'), '<div id="app"></div>');
    expect(() => prepareRenderBundle(noroot, { duration: 1, fps: 1, width: 1, height: 1 })).toThrow(/no <div id="root">/);
  });
});

describe('resolveHyperframesBin', () => {
  it('runs JS entries under node and rejects missing binaries', () => {
    const entry = path.join(tmp, 'hf.mjs');
    writeFileSync(entry, 'x');
    expect(resolveHyperframesBin({ hyperframesBin: entry, projectDir: tmp })).toEqual({ bin: process.execPath, prefixArgs: [entry] });
    expect(() => resolveHyperframesBin({ hyperframesBin: path.join(tmp, 'nope.mjs'), projectDir: tmp })).toThrow(/not found/);
    expect(() => resolveHyperframesBin({ projectDir: tmp })).toThrow(/not installed/);
  });
});

describe('buildHyperframesArgs', () => {
  it('renders the dist dir quietly with memory-sized workers', () => {
    expect(buildHyperframesArgs({ distDir: 'd', outFile: 'o.mp4', format: 'mp4', workers: 4 })).toEqual([
      'render', 'd', '-o', 'o.mp4', '--format', 'mp4', '--workers', '4', '--quiet',
    ]);
  });
});

describe('exportVideo (T5.8)', () => {
  it('builds, renders with auto workers, captures the poster, and cleans up', async () => {
    const outDir = path.join(tmp, 'out1');
    const dist = path.join(outDir, '.build', 'dist');
    const renders: HyperframesRunOptions[] = [];
    const events: unknown[] = [];
    const server = { url: 'http://127.0.0.1:9/', close: vi.fn(() => Promise.resolve()) };
    const files = await exportVideo(job(outDir), { onEvent: (e) => events.push(e) }, {
      runBuild: ({ distDir }) => {
        mkdirSync(distDir, { recursive: true });
        writeFileSync(path.join(distDir, 'index.html'), '<div id="root"></div>');
        return Promise.resolve();
      },
      render: (o) => {
        renders.push(o);
        // Composition attributes were stamped for HyperFrames (S1) before render.
        expect(readFileSync(path.join(dist, 'index.html'), 'utf8')).toContain('data-no-timeline');
        writeFileSync(path.join(outDir, 'video.mp4'), 'mp4');
        return Promise.resolve();
      },
      serve: () => Promise.resolve(server),
      capture: (o) => {
        expect(o.shots).toEqual([{ name: 'poster', t: 0 }]);
        expect(o.nameFor?.({ name: 'poster', t: 0 })).toBe('poster.png');
        writeFileSync(path.join(o.outDir, 'poster.png'), 'png');
        return Promise.resolve([path.join(o.outDir, 'poster.png')]);
      },
      workerCount: () => 4,
    });
    expect(files).toEqual([path.join(outDir, 'video.mp4'), path.join(outDir, 'poster.png')]);
    expect(renders).toHaveLength(1);
    expect(renders[0].args).toContain('--workers');
    expect(renders[0].args[renders[0].args.indexOf('--workers') + 1]).toBe('4');
    expect(renders[0].args).toContain(path.join(outDir, 'video.mp4'));
    expect(server.close).toHaveBeenCalledOnce();
    const steps = events.filter((e) => (e as { type: string }).type === 'progress').map((e) => (e as { step: string }).step);
    expect(steps).toEqual(['build', 'render', 'poster', 'done']);
  });

  it('honors an explicit worker count and webm, and honors cancellation', async () => {
    const outDir = path.join(tmp, 'out2');
    const seen: string[][] = [];
    await exportVideo({ ...job(outDir), workers: 2, format: 'webm' }, { onEvent: () => {} }, {
      runBuild: ({ distDir }) => {
        mkdirSync(distDir, { recursive: true });
        writeFileSync(path.join(distDir, 'index.html'), '<div id="root"></div>');
        return Promise.resolve();
      },
      render: (o) => {
        seen.push(o.args);
        return Promise.resolve();
      },
      serve: () => Promise.resolve({ url: 'http://x/', close: () => Promise.resolve() }),
      capture: (o) => Promise.resolve([path.join(o.outDir, 'poster.png')]),
      workerCount: () => {
        throw new Error('must not be called');
      },
    });
    expect(seen[0]).toContain('--format');
    expect(seen[0][seen[0].indexOf('--format') + 1]).toBe('webm');
    expect(seen[0][seen[0].indexOf('--workers') + 1]).toBe('2');
    const c = new AbortController();
    c.abort();
    await expect(exportVideo(job(path.join(tmp, 'out3')), { onEvent: () => {}, signal: c.signal }, {})).rejects.toThrow(/cancelled/);
  });
});
