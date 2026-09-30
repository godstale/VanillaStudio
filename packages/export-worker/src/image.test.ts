// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { CaptureOptions } from './capture';
import { exportImageShots } from './image';
import type { ImageJob } from './job';

const tmp = mkdtempSync(path.join(tmpdir(), 'vanilla-image-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const job = (outDir: string): ImageJob => ({
  version: 1,
  kind: 'image',
  projectDir: path.join(tmp, 'proj'),
  outDir,
  shots: [
    { name: 'cover', t: 0 },
    { name: 'hero', t: 2.5 },
  ],
  width: 1920,
  height: 1080,
  formats: ['png', 'jpg', 'webp'],
  scales: [1, 2],
});

describe('exportImageShots (T5.5)', () => {
  it('captures every format x scale with spec sizes', async () => {
    const outDir = path.join(tmp, 'out1');
    const calls: CaptureOptions[] = [];
    const capture = vi.fn((o: CaptureOptions) => {
      calls.push(o);
      return Promise.resolve(o.shots.map((s) => path.join(o.outDir, `${s.name}@${o.scale}x.${o.type === 'jpeg' ? 'jpg' : o.type}`)));
    });
    const server = { url: 'http://127.0.0.1:9/', close: vi.fn(() => Promise.resolve()) };
    const events: unknown[] = [];
    const files = await exportImageShots(job(outDir), { onEvent: (e) => events.push(e) }, {
      runBuild: () => Promise.resolve(),
      serve: () => Promise.resolve(server),
      capture: (o) => capture(o),
    });
    expect(calls.map((c) => `${c.type}@${c.scale}`)).toEqual(['png@1', 'png@2', 'jpeg@1', 'jpeg@2', 'webp@1', 'webp@2']);
    for (const c of calls) {
      expect(c.width).toBe(1920);
      expect(c.height).toBe(1080);
      expect(c.shots.map((s) => s.t)).toEqual([0, 2.5]);
      expect(c.baseUrl).toBe('http://127.0.0.1:9/');
    }
    expect(files).toHaveLength(12);
    expect(files[0]).toBe(path.join(outDir, 'cover@1x.png'));
    expect(files).toContain(path.join(outDir, 'hero@2x.jpg'));
    expect(files).toContain(path.join(outDir, 'cover@2x.webp'));
    expect(server.close).toHaveBeenCalledOnce();
    const steps = events.filter((e) => (e as { type: string }).type === 'progress').map((e) => (e as { step: string }).step);
    expect(steps[0]).toBe('build');
    expect(steps[steps.length - 1]).toBe('done');
  });

  it('closes the server when capture fails and honors cancellation', async () => {
    const server = { url: 'http://x/', close: vi.fn(() => Promise.resolve()) };
    await expect(
      exportImageShots(job(path.join(tmp, 'out2')), { onEvent: () => {} }, {
        runBuild: () => Promise.resolve(),
        serve: () => Promise.resolve(server),
        capture: () => Promise.reject(new Error('chrome died')),
      }),
    ).rejects.toThrow('chrome died');
    expect(server.close).toHaveBeenCalledOnce();
    const c = new AbortController();
    c.abort();
    await expect(exportImageShots(job(path.join(tmp, 'out3')), { onEvent: () => {}, signal: c.signal }, {})).rejects.toThrow(/cancelled/);
  });
});
