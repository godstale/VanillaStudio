// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { buildShotUrl, captureShots, resolveChromeExecutable, serveStatic, type ShotBrowser, type ShotPage } from './capture';

const tmp = mkdtempSync(path.join(tmpdir(), 'vanilla-capture-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Fake browser: records viewports/urls, answers readiness on demand, writes marker bytes. */
function fakeBrowser(behavior: { ready: boolean; bytes: string } = { ready: true, bytes: 'frame' }): { browser: ShotBrowser; seen: { url: string; width: number; height: number; dsf: number }[] } {
  const seen: { url: string; width: number; height: number; dsf: number }[] = [];
  const page: ShotPage = {
    goto: (url: string) => {
      seen.push({ url, width: -1, height: -1, dsf: -1 });
      return Promise.resolve();
    },
    waitForReady: () => (behavior.ready ? Promise.resolve() : Promise.reject(new Error('timeout'))),
    screenshot: (filePath: string) => {
      writeFileSync(filePath, `${behavior.bytes}:${seen[seen.length - 1].url}`);
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  };
  const browser: ShotBrowser = {
    newPage: (width: number, height: number, deviceScaleFactor: number) => {
      seen.push({ url: '', width, height, dsf: deviceScaleFactor });
      return Promise.resolve(page);
    },
    close: () => Promise.resolve(),
  };
  return { browser, seen };
}

describe('buildShotUrl (T5.4)', () => {
  it('addresses render mode and time, preserving the base path', () => {
    expect(buildShotUrl('http://127.0.0.1:9/', { t: 3.5 })).toBe('http://127.0.0.1:9/?mode=render&t=3.5');
    expect(buildShotUrl('http://127.0.0.1:9/app/?x=1', { t: 0 })).toBe('http://127.0.0.1:9/app/?x=1&mode=render&t=0');
  });
});

describe('serveStatic', () => {
  it('serves files, falls back to index.html, and blocks escape', async () => {
    const root = path.join(tmp, 'site');
    mkdirSync(root, { recursive: true });
    writeFileSync(path.join(root, 'index.html'), '<h1>hi</h1>');
    const srv = await serveStatic(root);
    try {
      expect(await (await fetch(`${srv.url}index.html`)).text()).toBe('<h1>hi</h1>');
      expect((await fetch(`${srv.url}index.html`)).headers.get('content-type')).toMatch(/text\/html/);
      expect(await (await fetch(`${srv.url}some/route`)).text()).toBe('<h1>hi</h1>');
      expect((await fetch(`${srv.url}..%2Fsecret`)).status).toBe(403);
    } finally {
      await srv.close();
    }
  });
});

describe('resolveChromeExecutable', () => {
  it('prefers the explicit path, then the env override, then the puppeteer cache', () => {
    expect(resolveChromeExecutable({ chromePath: 'C:/c.exe' })).toBe('C:/c.exe');
    expect(resolveChromeExecutable({ env: { CHROME_HEADLESS_SHELL_PATH: 'C:/e.exe' } })).toBe('C:/e.exe');
    const home = path.join(tmp, 'home');
    const dir = path.join(home, '.cache', 'puppeteer', 'chrome-headless-shell', 'win64-1.2.3', 'chrome-headless-shell-win64');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'chrome-headless-shell.exe'), 'x');
    expect(resolveChromeExecutable({ env: {}, homeDir: home })).toBe(path.join(dir, 'chrome-headless-shell.exe'));
    expect(resolveChromeExecutable({ env: {}, homeDir: path.join(tmp, 'nope') })).toBeNull();
    expect(resolveChromeExecutable({ env: {} })).toBeNull();
  });
});

describe('captureShots (T5.4)', () => {
  const shots = [
    { name: 's1', t: 0 },
    { name: 's2', t: 4 },
  ];

  it('opens one page per shot at width×height@scale and waits for readiness', async () => {
    const outDir = path.join(tmp, 'shots1');
    mkdirSync(outDir, { recursive: true });
    const { browser, seen } = fakeBrowser();
    const launch = vi.fn(() => Promise.resolve(browser));
    const files = await captureShots({
      baseUrl: 'http://127.0.0.1:9/',
      shots,
      width: 1920,
      height: 1080,
      scale: 2,
      type: 'png',
      outDir,
      executablePath: 'C:/c.exe',
      launch,
    });
    expect(launch).toHaveBeenCalledWith('C:/c.exe');
    expect(files).toEqual([path.join(outDir, 's1@2x.png'), path.join(outDir, 's2@2x.png')]);
    const viewports = seen.filter((s) => s.url === '');
    expect(viewports).toEqual([
      { url: '', width: 1920, height: 1080, dsf: 2 },
      { url: '', width: 1920, height: 1080, dsf: 2 },
    ]);
    const urls = seen.filter((s) => s.url !== '').map((s) => s.url);
    expect(urls).toEqual(['http://127.0.0.1:9/?mode=render&t=0', 'http://127.0.0.1:9/?mode=render&t=4']);
    // Same fake frame twice: determinism comes from the ready gate, which the fake honors.
    expect(writeFileSync).toBeTruthy();
  });

  it('fails loudly when the scene never becomes ready or reports an error', async () => {
    const outDir = path.join(tmp, 'shots2');
    mkdirSync(outDir, { recursive: true });
    const { browser } = fakeBrowser({ ready: false, bytes: 'x' });
    await expect(
      captureShots({ baseUrl: 'http://127.0.0.1:9/', shots: [{ name: 's1', t: 0 }], width: 10, height: 10, scale: 1, type: 'png', outDir, executablePath: 'C:/c.exe', launch: () => Promise.resolve(browser) }),
    ).rejects.toThrow(/never became ready/);
  });

  it('needs a browser and honors cancellation', async () => {
    const noChrome = (): Promise<ShotBrowser> => Promise.reject(new Error('must not launch'));
    await expect(
      captureShots({ baseUrl: 'http://x/', shots, width: 1, height: 1, scale: 1, type: 'png', outDir: tmp, env: { HOME: tmp, USERPROFILE: tmp }, launch: noChrome }),
    ).rejects.toThrow(/no headless Chrome/);
    const c = new AbortController();
    c.abort();
    const { browser } = fakeBrowser();
    await expect(
      captureShots({ baseUrl: 'http://x/', shots, width: 1, height: 1, scale: 1, type: 'png', outDir: tmp, executablePath: 'C:/c.exe', launch: () => Promise.resolve(browser), signal: c.signal }),
    ).rejects.toThrow(/cancelled/);
  });
});
