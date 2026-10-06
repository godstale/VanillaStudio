// 샘플 재생 회귀 E2E (T7.6): 골든 샘플 3종(motion·static·3d)을 실제 프리뷰 서버·Chrome에서 열어 재생·결정성을 확인한다.
//   node tests/e2e/samples-playback.mjs [--keep] [--fixture <dir>]
// 시퀀스 샘플은 `pnpm test:e2e:sequence`가 맡는다. 여기서는 신 하나짜리 샘플을 한 워크스페이스에 모아 연다.
// 확인: ① 페이지 오류 없음 ② 내용 렌더(문구·캔버스) ③ clock 신(motion·3d)은 같은 t → 같은 프레임(렌더 모드로 두 번 열어 픽셀 비교), 다른 t → 다른 프레임.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(join(fileURLToPath(import.meta.url), '..', '..', '..'));
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SAMPLES = join(REPO, 'resources', 'samples');
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
};
const log = (step, extra = {}) => console.log(JSON.stringify({ step, ...extra }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { default: puppeteer } = await import(pathToFileURL(join(REPO, 'packages/export-worker/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).href);

const ONE_SCENE = [
  { sample: 'gangdong-forest-library-promo', slug: 'forest-promo', kind: 'motion' },
  { sample: 'landing-page', slug: 'landing', kind: 'static' },
  { sample: 'torus-showcase', slug: 'knot', kind: '3d' },
];

function buildWorkspace(dir) {
  mkdirSync(dir, { recursive: true });
  const vars = { workspaceName: 'Samples', workspaceId: 'ws_samples0000001', workspaceSlug: 'samples' };
  const walk = (from, to) => {
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from)) {
      const a = join(from, name);
      const b = join(to, name);
      if (statSync(a).isDirectory()) walk(a, b);
      else writeFileSync(b, Object.entries(vars).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(v), readFileSync(a, 'utf8')));
    }
  };
  walk(join(REPO, 'resources', 'workspace-template'), dir);
  cpSync(join(REPO, 'resources', 'runtime'), join(dir, 'vanilla', 'runtime'), { recursive: true, filter: (p) => !p.split(/[/\\]/).includes('node_modules') });
  for (const { sample, slug } of ONE_SCENE) cpSync(join(SAMPLES, sample, 'scenes', slug), join(dir, 'scenes', slug), { recursive: true });
}

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`command failed: ${cmd} ${args.join(' ')}`);
}

function startRunner(root) {
  const child = spawn(process.execPath, [join(REPO, 'resources', 'workers', 'vite-runner.mjs'), '--root', root], { stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res, rej) => {
    let buf = '';
    const timer = setTimeout(() => rej(new Error('runner did not report a port in time')), 90_000);
    child.stdout.on('data', (d) => {
      buf += d;
      for (const line of buf.split('\n')) {
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'listening') {
            clearTimeout(timer);
            res({ child, port: msg.port });
          }
          if (msg.type === 'error') rej(new Error(msg.message));
        } catch {
          /* partial line */
        }
      }
    });
    child.once('exit', (code) => rej(new Error(`runner exited early (${code})`)));
  });
}

const keep = arg('keep');
const dir = typeof arg('fixture') === 'string' ? resolve(arg('fixture')) : mkdtempSync(join(tmpdir(), 'vanilla-samples-'));
const results = {};
let runner = null;
let browser = null;
let failed = null;

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

try {
  if (!existsSync(join(dir, 'package.json'))) buildWorkspace(dir);
  if (!existsSync(join(dir, 'node_modules', 'vite'))) {
    log('pnpm-install');
    sh('pnpm', ['install', '--ignore-workspace'], dir);
  }
  runner = await startRunner(dir);
  log('runner', { port: runner.port });
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--enable-gpu-rasterization', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const base = `http://127.0.0.1:${runner.port}/scenes`;

  /** 렌더 모드로 시각 t에 맞춰 연 뒤 준비가 끝나면 그 프레임의 "지문"(캔버스 픽셀 해시 또는 스크린샷)을 돌려준다. */
  async function frameAt(slug, t, kind) {
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540 });
    const problems = [];
    page.on('pageerror', (e) => problems.push(String(e)));
    await page.goto(`${base}/${slug}/src/index.html?mode=render&t=${t}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__vanillaReady === true, { timeout: 60_000 });
    let print;
    if (kind === 'motion') {
      print = await page.evaluate(() => {
        const c = document.getElementById('forest');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let hash = 2166136261;
        let painted = 0;
        for (let i = 0; i < d.length; i += 4) {
          hash = Math.imul(hash ^ (d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11), 16777619) >>> 0;
          if (d[i + 3] > 0) painted += 1;
        }
        return { hash, painted };
      });
    } else {
      print = { shot: (await page.screenshot({ encoding: 'base64' })).length, hash: await page.screenshot({ encoding: 'base64' }) };
    }
    await page.close();
    return { print, problems };
  }

  // 1) motion: 강동 숲속 도서관 — 같은 t는 같은 프레임, 다른 t는 다른 프레임, 비어 있지 않다.
  const a1 = await frameAt('forest-promo', 3.2, 'motion');
  const a2 = await frameAt('forest-promo', 3.2, 'motion');
  const b1 = await frameAt('forest-promo', 6.1, 'motion');
  results.motion = { sameT: a1.print.hash === a2.print.hash, differentT: a1.print.hash !== b1.print.hash, painted: a1.print.painted, problems: [...a1.problems, ...a2.problems, ...b1.problems] };
  assert(results.motion.sameT, 'motion: the same t gave different frames (determinism broken)');
  assert(results.motion.differentT, 'motion: different times gave the same frame');
  assert(results.motion.painted > 1_000_000, `motion: the canvas looks empty (${results.motion.painted} painted pixels)`);
  assert(results.motion.problems.length === 0, `motion: page errors ${results.motion.problems.join(' | ')}`);
  log('motion', results.motion);

  // 2) 3d: 토러스 — 렌더 모드로 두 번 열어 같은 프레임, 다른 t는 다른 프레임.
  const c1 = await frameAt('knot', 2, '3d');
  const c2 = await frameAt('knot', 2, '3d');
  const d1 = await frameAt('knot', 4, '3d');
  results['3d'] = { sameT: c1.print.hash === c2.print.hash, differentT: c1.print.hash !== d1.print.hash, problems: [...c1.problems, ...c2.problems, ...d1.problems] };
  assert(results['3d'].sameT, '3d: the same t gave different frames (determinism broken)');
  assert(results['3d'].differentT, '3d: different times gave the same frame');
  assert(results['3d'].problems.length === 0, `3d: page errors ${results['3d'].problems.join(' | ')}`);
  log('3d', results['3d']);

  // 3) static: 랜딩 페이지 — 문구와 카드가 렌더된다(시간과 무관).
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const problems = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.goto(`${base}/landing/src/index.html?mode=preview`, { waitUntil: 'load' });
  await page.waitForSelector('#headline', { timeout: 30_000 });
  const headline = await page.$eval('#headline', (el) => el.textContent);
  const beans = await page.$$eval('[data-testid="bean"]', (els) => els.map((e) => e.querySelector('h3').textContent));
  await page.close();
  results.static = { headline, beans, problems };
  assert(headline === 'Fresh-roasted beans, every week', `static: headline ${headline}`);
  assert(beans.join(',') === 'Sunrise,Hearth,Midnight', `static: beans ${beans}`);
  assert(problems.length === 0, `static: page errors ${problems.join(' | ')}`);
  log('static', results.static);

  log('pass');
} catch (e) {
  failed = e;
}

try {
  await browser?.close();
  if (runner?.child && runner.child.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(runner.child.pid), '/T', '/F']);
    else runner.child.kill();
  }
  await sleep(500);
  if (!keep && !arg('fixture')) rmSync(dir, { recursive: true, force: true });
} catch {
  /* best effort cleanup */
}

if (failed) {
  console.error(JSON.stringify({ step: 'fail', message: String(failed?.message ?? failed), results }));
  process.exit(1);
}
