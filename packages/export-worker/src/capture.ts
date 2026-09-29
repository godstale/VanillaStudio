// Still capture core (T5.4): Technical-Design §2.3, §7, S2.
//
// Render builds are opened in headless Chrome (S2: `puppeteer-core` driving
// the `chrome-headless-shell` that HyperFrames manages), each shot seeks with
// `?mode=render&t=<sec>`, the worker waits for the runtime readiness flag
// (`window.__vanillaReady`, §4.1 — fonts, textures, two painted frames), then
// screenshots with `deviceScaleFactor` = scale. Without the wait the capture
// is wrong (S2 control experiment: missing 3D objects, fallback fonts).
import { createServer, type Server } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { throwIfCancelled } from './job';

export interface Shot {
  name: string;
  t: number;
  sceneId?: string;
}

/** Append render-mode addressing (`mode=render&t=`) to a served URL. */
export function buildShotUrl(baseUrl: string, shot: Pick<Shot, 't'>): string {
  const url = new URL(baseUrl);
  url.searchParams.set('mode', 'render');
  url.searchParams.set('t', String(shot.t));
  return url.toString();
}

// ---- static server (serves a render/vite build to the capture browser) -----

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export interface StaticServer {
  url: string;
  close: () => Promise<void>;
}

/** Serve a directory on 127.0.0.1 (ephemeral port). SPA fallback: unknown paths serve index.html. */
export function serveStatic(rootDir: string): Promise<StaticServer> {
  const root = path.resolve(rootDir);
  const server: Server = createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
      const file = path.normalize(path.join(root, pathname.replace(/^\/+/, '')));
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      let target = file;
      try {
        if (statSync(target).isDirectory()) target = path.join(target, 'index.html');
      } catch {
        target = path.join(root, 'index.html');
      }
      const body = readFileSync(target);
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('export worker: static server has no address'));
        return;
      }
      resolve({ url: `http://127.0.0.1:${addr.port}/`, close: () => new Promise((done) => server.close(() => done())) });
    });
  });
}

// ---- browser executable ----------------------------------------------------

/**
 * Find headless Chrome. Order: explicit job path → `CHROME_HEADLESS_SHELL_PATH`
 * → the puppeteer cache HyperFrames fills (`hyperframes browser`, S1). Returns
 * null when nothing is installed (the caller reports the Doctor remedy).
 */
export function resolveChromeExecutable(options: { chromePath?: string; env?: NodeJS.ProcessEnv; homeDir?: string } = {}): string | null {
  const env = options.env ?? process.env;
  if (options.chromePath) return options.chromePath;
  if (env.CHROME_HEADLESS_SHELL_PATH) return env.CHROME_HEADLESS_SHELL_PATH;
  const home = options.homeDir ?? env.HOME ?? env.USERPROFILE ?? '';
  if (!home) return null;
  const cache = path.join(home, '.cache', 'puppeteer', 'chrome-headless-shell');
  let versions: string[];
  try {
    versions = readdirSync(cache);
  } catch {
    return null;
  }
  // Newest first: `win64-<chrome-version>/chrome-headless-shell-win64/chrome-headless-shell.exe`.
  for (const v of versions.sort().reverse()) {
    const exe = path.join(cache, v, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (existsSync(exe)) return exe;
  }
  return null;
}

// ---- capture ---------------------------------------------------------------

export type ScreenshotType = 'png' | 'jpeg' | 'webp';

/** Minimal page surface so tests can fake the browser. */
export interface ShotPage {
  goto: (url: string) => Promise<void>;
  /** Resolve once `__vanillaReady` is true; reject on `__vanillaError` or timeout. */
  waitForReady: (timeoutMs: number) => Promise<void>;
  screenshot: (filePath: string, type: ScreenshotType) => Promise<void>;
  close: () => Promise<void>;
}

export interface ShotBrowser {
  newPage: (width: number, height: number, deviceScaleFactor: number) => Promise<ShotPage>;
  close: () => Promise<void>;
}

export type LaunchBrowser = (executablePath: string) => Promise<ShotBrowser>;

class PuppeteerPage implements ShotPage {
  constructor(private readonly page: Page) {}

  goto(url: string): Promise<void> {
    return this.page.goto(url, { waitUntil: 'load', timeout: 60_000 }).then(() => undefined);
  }

  async waitForReady(timeoutMs: number): Promise<void> {
    await this.page.waitForFunction('window.__vanillaReady === true', { timeout: timeoutMs, polling: 100 });
    const error = await this.page.evaluate('window.__vanillaError ?? null').catch(() => null);
    if (typeof error === 'string' && error) throw new Error(`export worker: scene reported an error: ${error}`);
  }

  screenshot(filePath: string, type: ScreenshotType): Promise<void> {
    return this.page.screenshot({ path: filePath, type, fullPage: false }).then(() => undefined);
  }

  close(): Promise<void> {
    return this.page.close().catch(() => undefined).then(() => undefined);
  }
}

class PuppeteerBrowser implements ShotBrowser {
  constructor(private readonly browser: Browser) {}

  async newPage(width: number, height: number, deviceScaleFactor: number): Promise<ShotPage> {
    const page = await this.browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    return new PuppeteerPage(page);
  }

  close(): Promise<void> {
    void this.browser.close().catch(() => undefined);
    return Promise.resolve();
  }
}

/** Default launcher: puppeteer-core over the managed headless shell (S2). */
export function launchManagedBrowser(executablePath: string): Promise<ShotBrowser> {
  return puppeteer.launch({ executablePath, headless: true }).then((b) => new PuppeteerBrowser(b));
}

export interface CaptureOptions {
  baseUrl: string;
  shots: readonly Shot[];
  width: number;
  height: number;
  /** deviceScaleFactor (S2: @2x → 3840×2160 from a 1920×1080 viewport). */
  scale: number;
  type: ScreenshotType;
  outDir: string;
  /** File name without extension. Default: `<name>@<scale>x.<type>`. */
  nameFor?: (shot: Shot) => string;
  executablePath?: string;
  /** Environment for executable discovery (default: process.env). */
  env?: NodeJS.ProcessEnv;
  launch?: LaunchBrowser;
  readyTimeoutMs?: number;
  signal?: AbortSignal;
  onShot?: (shot: Shot, index: number, total: number) => void;
}

/**
 * Capture shots with one browser (fresh navigation per shot resets readiness).
 * Returns absolute PNG/JPG/WebP paths in shot order.
 */
export async function captureShots(options: CaptureOptions): Promise<string[]> {
  const executablePath = options.executablePath ?? resolveChromeExecutable({ env: options.env });
  if (!executablePath) throw new Error('export worker: no headless Chrome found (run `hyperframes browser` or check Doctor → export)');
  const launch = options.launch ?? launchManagedBrowser;
  const nameFor = options.nameFor ?? ((s) => `${s.name}@${options.scale}x.${options.type === 'jpeg' ? 'jpg' : options.type}`);
  const browser = await launch(executablePath);
  const out: string[] = [];
  try {
    for (let i = 0; i < options.shots.length; i++) {
      throwIfCancelled(options.signal);
      const shot = options.shots[i];
      const page = await browser.newPage(options.width, options.height, options.scale);
      try {
        await page.goto(buildShotUrl(options.baseUrl, shot));
        try {
          await page.waitForReady(options.readyTimeoutMs ?? 60_000);
        } catch (e) {
          throw new Error(`export worker: shot "${shot.name}" never became ready (${(e as Error).message})`, { cause: e });
        }
        const file = path.join(options.outDir, nameFor(shot));
        await page.screenshot(file, options.type);
        out.push(file);
        options.onShot?.(shot, i, options.shots.length);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  throwIfCancelled(options.signal);
  return out;
}
