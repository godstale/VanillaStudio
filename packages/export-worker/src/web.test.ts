// @vitest-environment node
import JSZip from 'jszip';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { WebJob } from './job';
import { exportWeb, resolveViteBin, zipDirectory } from './web';

const tmp = mkdtempSync(path.join(tmpdir(), 'vanilla-web-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const job = (outDir: string): WebJob => ({ version: 1, kind: 'web', format: 'web', projectDir: path.join(tmp, 'proj'), outDir });

describe('zipDirectory (T5.3)', () => {
  it('zips deterministically (same bytes twice)', async () => {
    const src = path.join(tmp, 'dist');
    mkdirSync(path.join(src, 'assets'), { recursive: true });
    writeFileSync(path.join(src, 'index.html'), '<html></html>');
    writeFileSync(path.join(src, 'assets', 'app.js'), 'console.log(1)');
    const a = path.join(tmp, 'a.zip');
    const b = path.join(tmp, 'b.zip');
    await zipDirectory(src, a);
    await zipDirectory(src, b);
    expect(readFileSync(a).equals(readFileSync(b))).toBe(true);
    const zip = await JSZip.loadAsync(readFileSync(a));
    expect(Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name).sort()).toEqual(['assets/app.js', 'index.html']);
    expect(await zip.files['index.html'].async('string')).toBe('<html></html>');
  });

  it('rejects a missing source dir', async () => {
    await expect(zipDirectory(path.join(tmp, 'nope'), path.join(tmp, 'x.zip'))).rejects.toThrow(/nothing to zip/);
  });
});

describe('resolveViteBin', () => {
  it('finds the project vite and complains when it is not installed', () => {
    const proj = path.join(tmp, 'proj2');
    mkdirSync(path.join(proj, 'node_modules', 'vite', 'bin'), { recursive: true });
    writeFileSync(path.join(proj, 'node_modules', 'vite', 'bin', 'vite.js'), '');
    expect(resolveViteBin(proj)).toBe(path.join(proj, 'node_modules', 'vite', 'bin', 'vite.js'));
    expect(() => resolveViteBin(path.join(tmp, 'missing'))).toThrow(/vite not found/);
  });
});

describe('exportWeb (T5.3)', () => {
  it('emits progress/log events and returns site.zip (unzip → index.html serves the site)', async () => {
    const outDir = path.join(tmp, 'out2');
    const events: unknown[] = [];
    const runBuild = vi.fn(({ distDir, onLog }: { distDir: string; onLog?: (s: 'stdout' | 'stderr', l: string) => void }) => {
      mkdirSync(distDir, { recursive: true });
      writeFileSync(path.join(distDir, 'index.html'), '<html><body>hi</body></html>');
      onLog?.('stdout', 'built in 1s');
      return Promise.resolve();
    });
    const files = await exportWeb(job(outDir), { onEvent: (e) => events.push(e) }, { runBuild });
    expect(runBuild).toHaveBeenCalledOnce();
    expect(files).toEqual([path.join(outDir, 'site.zip')]);
    // Scratch build dir is gone; only the zip remains.
    expect(existsSync(path.join(outDir, '.build'))).toBe(false);
    const zip = await JSZip.loadAsync(readFileSync(files[0]));
    expect(await zip.files['index.html'].async('string')).toBe('<html><body>hi</body></html>');
    const steps = events.filter((e) => (e as { type: string }).type === 'progress').map((e) => (e as { step: string }).step);
    expect(steps).toEqual(['build', 'zip', 'done']);
    expect(events).toContainEqual({ type: 'log', stream: 'stdout', line: 'built in 1s' });
  });

  it('fails when the build produces no index.html and aborts when cancelled', async () => {
    const nope = exportWeb(job(path.join(tmp, 'out3')), { onEvent: () => {} }, { runBuild: ({ distDir }) => {
      mkdirSync(distDir, { recursive: true });
      return Promise.resolve();
    } });
    await expect(nope).rejects.toThrow(/no index.html/);
    const c = new AbortController();
    c.abort();
    await expect(exportWeb(job(path.join(tmp, 'out4')), { onEvent: () => {}, signal: c.signal }, {})).rejects.toThrow(/cancelled/);
  });
});
