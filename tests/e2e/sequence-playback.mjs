// 시퀀스 재생 E2E (T6.6·T6.7·T6.8): 샘플 시퀀스(motion → static steps → 3d + choice 분기)를 실제 신·실제 프리뷰 서버·실제 Chrome으로 재생한다.
//   node tests/e2e/sequence-playback.mjs [--keep] [--fixture <dir>] [--json]
// 구성: 워크스페이스 픽스처(템플릿 + 런타임 + resources/samples/sequence-demo) → pnpm install → vite-runner(프리뷰 서버, 127.0.0.1)
//   → 하네스 페이지(Vite dev, localhost: 앱과 다른 origin)에서 앱의 시퀀스 매니저·IframeSceneHost·전환 러너를 그대로 구동.
// 검증: 자동 진행(end)·static 클릭 단계·3d 렌더·choice 분기·전환 합성·끝 화면, 전환·로드 지연 수치(T6.7).
// 통과하면 종료 코드 0. Chrome(로컬 설치)과 pnpm이 필요하다.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(join(fileURLToPath(import.meta.url), '..', '..', '..'));
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SAMPLE = join(REPO, 'resources', 'samples', 'sequence-demo');
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
};
const log = (step, extra = {}) => console.log(JSON.stringify({ step, ...extra }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { default: puppeteer } = await import(pathToFileURL(join(REPO, 'packages/export-worker/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).href);
const { createServer: createViteServer } = await import(pathToFileURL(join(REPO, 'node_modules/vite/dist/node/index.js')).href);

// ---- 픽스처 -------------------------------------------------------------------------------------

function buildFixture(dir) {
  mkdirSync(dir, { recursive: true });
  const vars = { workspaceName: 'Sequence Demo', workspaceId: 'ws_sampleseq0001', workspaceSlug: 'sequence-demo' };
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
  cpSync(SAMPLE, dir, { recursive: true }); // workspace.json·sequence.json·scenes/ 를 덮어쓴다
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

// ---- 시나리오 -----------------------------------------------------------------------------------

const keep = arg('keep');
const dir = typeof arg('fixture') === 'string' ? resolve(arg('fixture')) : mkdtempSync(join(tmpdir(), 'vanilla-seq-e2e-'));
const results = { transitions: {}, loads: {} };
let runner = null;
let vite = null;
let browser = null;
let failed = null;

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

async function waitState(page, predicate, label, timeout = 30_000) {
  const start = Date.now();
  for (;;) {
    const s = await page.evaluate(() => window.__pg.state());
    if (predicate(s)) return s;
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for ${label}; state=${JSON.stringify(s)}`);
    await sleep(50);
  }
}

async function frameOf(page, sceneId) {
  const handle = await page.$(`iframe[data-scene-id="${sceneId}"]`);
  assert(handle, `iframe for ${sceneId} not found`);
  return handle.contentFrame();
}

async function scenario(serverPort, harnessUrl) {
  const sequence = JSON.parse(readFileSync(join(dir, 'sequence.json'), 'utf8'));
  const workspace = JSON.parse(readFileSync(join(dir, 'workspace.json'), 'utf8'));
  const ids = { intro: 'scn_demoIntro01', page: 'scn_demoPage001', globe: 'scn_demoGlobe01', outro: 'scn_demoOutro01' };
  const scenes = Object.entries(ids).map(([slug, id]) => {
    const scene = JSON.parse(readFileSync(join(dir, 'scenes', slug, 'scene.json'), 'utf8'));
    return [id, { type: scene.type, name: scene.name, slug, entry: scene.runtime.entry }];
  });
  const config = { sequence, scenes, serverUrl: `http://127.0.0.1:${serverPort}`, canvas: workspace.canvas, workspaceId: workspace.workspaceId };

  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--enable-gpu-rasterization', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const problems = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  if (process.env.E2E_DEBUG) page.on('console', (m) => console.log(JSON.stringify({ console: m.text().slice(0, 300) })));
  await page.goto(harnessUrl, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pgReady === true, { timeout: 60_000 });

  // 1) 시작 신(motion) 로드·재생. 콜드 로드 시간을 잰다.
  const tStart = Date.now();
  await page.evaluate((c) => window.__pg.run(c), config);
  const s0 = await waitState(page, (s) => s.status === 'playing' && s.current === ids.intro, 'intro playing');
  results.loads.coldStartMs = Date.now() - tStart;
  assert(s0.duration === 4, `intro duration ${s0.duration}`);
  log('intro-playing', { coldStartMs: results.loads.coldStartMs });
  let layers = await page.evaluate(() => window.__pg.layers());
  assert(layers.find((l) => l.id === ids.intro)?.opacity === '1', 'intro iframe is visible');
  assert(layers.find((l) => l.id === ids.page)?.opacity === '0', 'next scene is preloaded but invisible');
  await waitState(page, (s) => s.t > 0.3, 'intro clock advancing');
  const introFrame = await frameOf(page, ids.intro);
  assert((await introFrame.$eval('h1', (el) => el.textContent)) === 'Vanilla Studio', 'intro renders its copy');

  // 2) end 트리거: 길이에 도달하면 crossfade로 static 페이지로 넘어간다. 전환 지연을 잰다.
  await waitState(page, (s) => s.status === 'transitioning' && s.next === ids.page, 'transition to page', 15_000);
  const tTrans = Date.now();
  await waitState(page, (s) => s.status === 'playing' && s.current === ids.page, 'page playing');
  results.transitions.crossfade = { configuredMs: 600, observedMs: Date.now() - tTrans };
  log('page-playing', results.transitions.crossfade);
  const pageFrame = await frameOf(page, ids.page);
  assert((await pageFrame.$eval('#step-title', (el) => el.textContent)) === 'Welcome', 'page starts on step 1');
  assert(await page.evaluate(() => window.__pg.iframeCount()) <= 3, 'old scene was disposed');

  // 3) static: 클릭은 step으로 위임된다(마지막 step 전에는 시퀀스가 움직이지 않는다).
  await page.evaluate(() => window.__pg.input({ kind: 'click' }));
  await waitState(page, (s) => s.step && s.step.index === 1, 'step 2');
  assert((await pageFrame.$eval('#step-title', (el) => el.textContent)) === 'Steps', 'page moved to step 2');
  assert((await page.evaluate(() => window.__pg.state().current)) === ids.page, 'still on the page after step 1 → 2');
  await page.evaluate(() => window.__pg.input({ kind: 'click' }));
  await waitState(page, (s) => s.step && s.step.index === 2, 'step 3');
  assert((await pageFrame.$eval('#step-count', (el) => el.textContent)).includes('3 / 3'), 'page is on its last step');

  // 4) 마지막 step에서 입력 → done → 엣지(click, slide-left) → 3d 신.
  const tSlide = Date.now();
  await page.evaluate(() => window.__pg.input({ kind: 'click' }));
  await waitState(page, (s) => s.status === 'playing' && s.current === ids.globe, 'globe playing');
  results.transitions['slide-left'] = { configuredMs: 500, observedMs: Date.now() - tSlide };
  log('globe-playing', results.transitions['slide-left']);
  const globeFrame = await frameOf(page, ids.globe);
  await globeFrame.waitForSelector('canvas', { timeout: 20_000 });
  assert(await page.evaluate(() => window.__pg.state().choices.join(',')) === 'Finish,Again', 'choices are offered on the 3d scene');

  // 5) choice 분기 "Finish": circular-reveal → outro → 끝.
  const tReveal = Date.now();
  await page.evaluate(() => window.__pg.choose('Finish'));
  await waitState(page, (s) => s.status === 'playing' && s.current === ids.outro, 'outro playing');
  results.transitions['circular-reveal'] = { configuredMs: 700, observedMs: Date.now() - tReveal };
  log('outro-playing', results.transitions['circular-reveal']);
  const outroFrame = await frameOf(page, ids.outro);
  assert((await outroFrame.$eval('h1', (el) => el.textContent)) === 'Thank you', 'outro renders');
  await waitState(page, (s) => s.status === 'ended', 'sequence ended', 15_000);
  log('ended');

  // 6) 분기 "Again": 3d 신에서 처음으로 돌아가는 순환(입력 엣지가 있는 순환은 허용). 점프로 3d에 간 뒤 선택한다.
  await page.evaluate((id) => window.__pg.jump(id), ids.globe);
  await waitState(page, (s) => s.status === 'playing' && s.current === ids.globe, 'jumped to globe');
  const tZoom = Date.now();
  await page.evaluate(() => window.__pg.choose('Again'));
  await waitState(page, (s) => s.status === 'playing' && s.current === ids.intro, 'back to intro');
  results.transitions['zoom-through'] = { configuredMs: 600, observedMs: Date.now() - tZoom };
  log('looped', results.transitions['zoom-through']);

  // 7) 프리로드 효과: 프리로드된 이웃으로의 전환 vs 프리로드되지 않은 신으로의 점프(콜드 로드).
  const tCold = Date.now();
  await page.evaluate((id) => window.__pg.jump(id), ids.globe); // 이웃이 아닌 신: 로드 후 재생
  await waitState(page, (s) => s.status === 'playing' && s.current === ids.globe, 'cold jump to globe');
  results.loads.coldJumpMs = Date.now() - tCold;
  log('cold-jump', { ms: results.loads.coldJumpMs });

  const errors = problems.filter((p) => !/Download the React DevTools/.test(p));
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
}

try {
  if (!existsSync(join(dir, 'package.json'))) {
    log('fixture', { dir });
    buildFixture(dir);
  }
  if (!existsSync(join(dir, 'node_modules', 'vite'))) {
    log('pnpm-install');
    sh('pnpm', ['install', '--ignore-workspace'], dir);
  }
  const r = await startRunner(dir);
  runner = r;
  log('runner', { port: r.port });
  vite = await createViteServer({
    root: REPO,
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { '@': join(REPO, 'src') } },
    server: { host: 'localhost', port: 0, strictPort: false, fs: { allow: [REPO] } },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  await vite.listen();
  const harnessPort = vite.httpServer.address().port;
  await scenario(r.port, `http://localhost:${harnessPort}/tests/e2e/harness/playground.html`);
  log('pass', results);
} catch (e) {
  failed = e;
}

try {
  await browser?.close();
  await vite?.close();
  if (runner?.child && runner.child.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(runner.child.pid), '/T', '/F']);
    else runner.child.kill();
  }
  await sleep(500);
  if (!keep && !arg('fixture')) rmSync(dir, { recursive: true, force: true });
} catch {
  /* best effort cleanup */
}

if (arg('json')) console.log(JSON.stringify(results, null, 2));
if (failed) {
  console.error(JSON.stringify({ step: 'fail', message: String(failed?.message ?? failed), results }));
  process.exit(1);
}
