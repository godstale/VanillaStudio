// 신 미리보기 E2E (T4.7): 앱(Tauri) 없이 프리뷰 서버·런타임·Bridge v2를 실제 브라우저로 검증한다.
//   node tests/e2e/scene-preview.mjs [--keep] [--fixture <dir>]
// 순서: 워크스페이스 픽스처(템플릿 + 런타임 + 샘플 신) 만들기 → pnpm install → vite-runner 실행 → 호스트 페이지(다른 origin)에서 iframe으로 신 열기
//   → Bridge `ready` 수신 → `init`(canvas 주입) 반영 확인 → 신 소스 수정 → HMR 반영 확인.
// 통과하면 종료 코드 0. 단계는 JSON 줄로 출력한다. Chrome(로컬 설치)과 pnpm이 필요하다.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(join(fileURLToPath(import.meta.url), '..', '..', '..'));
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const log = (step, extra = {}) => console.log(JSON.stringify({ step, ...extra }));
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
};

const agentScene = process.argv.includes('--agent-scene');

const { default: puppeteer } = await import(pathToFileURL(join(REPO, 'packages/export-worker/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).href);

// ---- 픽스처 -------------------------------------------------------------------------------------

const SCENE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>demo</title><style>html,body,#root{margin:0;height:100%}</style></head>
<body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>
`;
// 워크스페이스 AGENTS.md의 부트스트랩 규약과 같다: composition 수정은 다시 마운트해 반영한다(새로고침 없음, 재생 위치 유지).
const SCENE_MAIN = `import { mountVanilla } from '@vanilla/runtime/app';
import type { Composition } from '@vanilla/runtime';
import composition from './composition';

let dispose = mountVanilla(composition);
if (import.meta.hot) {
  import.meta.hot.accept('./composition', (mod) => {
    if (!mod) return;
    dispose();
    dispose = mountVanilla((mod as unknown as { default: Composition }).default);
  });
}
`;
// 컴포넌트는 scene 모듈에, composition 모듈에는 컴포넌트를 두지 않는다: composition.tsx가 Fast Refresh 경계가 되면
// "default export is incompatible"로 무효화되어 전체 새로고침이 된다. (main.tsx가 composition을 accept하는 구조가 핵심)
const COMPOSITION = `import { defineComposition } from '@vanilla/runtime';
import scene from './scene';

export default defineComposition({ scenes: [scene], format: { width: 1920, height: 1080 } });
`;
const sceneTsx = (label) => `/* eslint-disable */
import { defineScene, useFrame, useTime } from '@vanilla/runtime';

function Demo() {
  const t = useTime();
  const f = useFrame();
  return (
    <div id="out" style={{ color: 'var(--color-ink)', background: 'var(--color-canvas)' }}>
      <span id="label">${label}</span> <span id="frame">{f.width}x{f.height}@{f.fps}</span> <span id="t">{t.toFixed(2)}</span>
    </div>
  );
}

export default defineScene({ id: 'demo', duration: 3, Component: Demo });
`;

function copyFiltered(src, dst) {
  cpSync(src, dst, { recursive: true, filter: (p) => !p.split(/[/\\]/).includes('node_modules') });
}

function buildFixture(dir) {
  mkdirSync(dir, { recursive: true });
  const vars = { workspaceName: 'E2E', workspaceId: 'ws_e2e', workspaceSlug: 'e2e-workspace' };
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
  copyFiltered(join(REPO, 'resources', 'runtime'), join(dir, 'vanilla', 'runtime'));
  const scene = join(dir, 'scenes', 'demo', 'src');
  mkdirSync(scene, { recursive: true });
  if (agentScene) {
    // T4.11: 소스는 목 에이전트가 쓴다. 입력은 앱이 만든 scene.json 한 장뿐이다.
    writeFileSync(
      join(dir, 'scenes', 'demo', 'scene.json'),
      JSON.stringify({ type: 'motion', name: 'Demo', duration: { seconds: 3 }, beats: [], copy: { textFidelity: 'exact', items: ['Vanilla Studio'] }, endCard: { holdSeconds: 1, elements: [] }, status: 'draft' }),
    );
    const r = spawnSync(process.execPath, [join(REPO, 'tests', 'e2e', 'mock-agent.mjs')], { cwd: join(dir, 'scenes', 'demo'), stdio: 'inherit' });
    if (r.status !== 0) throw new Error('mock agent failed');
    return dir;
  }
  writeFileSync(join(scene, 'index.html'), SCENE_HTML);
  writeFileSync(join(scene, 'main.tsx'), SCENE_MAIN);
  writeFileSync(join(scene, 'composition.tsx'), COMPOSITION);
  writeFileSync(join(scene, 'scene.tsx'), sceneTsx('first'));
  return dir;
}

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`command failed: ${cmd} ${args.join(' ')}`);
}

// ---- 서버·호스트 ---------------------------------------------------------------------------------

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

function hostPage(sceneUrl) {
  // 호스트는 `localhost` origin, 신은 `127.0.0.1` origin: 서로 다른 origin이라 Bridge의 origin 검사가 실제로 동작한다.
  return `<!doctype html><html><body><iframe id="f" style="width:960px;height:540px" src="${sceneUrl}"></iframe>
<script>
  window.__msgs = [];
  const frame = document.getElementById('f');
  window.addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow) return;
    window.__msgs.push({ origin: e.origin, data: e.data });
    if (e.data && e.data.type === 'ready') {
      frame.contentWindow.postMessage({ v: 2, type: 'init', payload: { mode: 'preview', paramsValues: {}, canvas: { width: 1080, height: 1920, fps: 24 } } }, e.origin);
    }
  });
</script></body></html>`;
}

function startHost(sceneUrl) {
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(hostPage(sceneUrl));
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port })));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 시나리오 -----------------------------------------------------------------------------------

const keep = arg('keep');
const dir = typeof arg('fixture') === 'string' ? resolve(arg('fixture')) : mkdtempSync(join(tmpdir(), 'vanilla-e2e-'));
let runner = null;
let host = null;
let browser = null;
let failed = null;

try {
  if (!existsSync(join(dir, 'package.json'))) {
    log('fixture', { dir });
    buildFixture(dir);
  }
  if (!existsSync(join(dir, 'node_modules', 'vite'))) {
    log('pnpm-install');
    sh('pnpm', ['install', '--ignore-workspace'], dir);
  }

  ({ child: runner, port: runner.port } = Object.assign(await startRunner(dir), {}));
} catch (e) {
  failed = e;
}

if (!failed) {
  try {
    const port = runner.port ?? null;
    log('runner', { port });
  } catch {
    /* ignore */
  }
}

async function scenario(serverPort) {
  const hostOrigin = (p) => `http://localhost:${p}`;
  // 호스트 포트는 먼저 정해야 신 URL의 ?host= 에 넣을 수 있어 임시 서버로 포트를 고른다.
  const probe = createServer();
  const hostPort = await new Promise((r) => probe.listen(0, '127.0.0.1', () => r(probe.address().port)));
  await new Promise((r) => probe.close(r));
  const sceneUrl = `http://127.0.0.1:${serverPort}/scenes/demo/src/index.html?mode=preview&host=${encodeURIComponent(hostOrigin(hostPort))}`;
  host = { server: createServer((req, res) => (res.setHeader('content-type', 'text/html'), res.end(hostPage(sceneUrl)))) };
  await new Promise((r) => host.server.listen(hostPort, '127.0.0.1', r));

  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  if (process.env.E2E_DEBUG) page.on('console', (m) => console.log(JSON.stringify({ console: m.text().slice(0, 300) })));
  await page.goto(hostOrigin(hostPort), { waitUntil: 'load' });

  // 1) ready 수신(origin 검사 통과, v2)
  await page.waitForFunction(() => window.__msgs.some((m) => m.data && m.data.type === 'ready'), { timeout: 60_000 });
  const ready = await page.evaluate(() => window.__msgs.find((m) => m.data.type === 'ready'));
  if (ready.data.v !== 2) throw new Error(`ready has protocol version ${ready.data.v}`);
  if (ready.origin !== `http://127.0.0.1:${serverPort}`) throw new Error(`ready came from ${ready.origin}`);
  if (!ready.data.payload.scenes.some((s) => s.id === 'demo')) throw new Error('ready did not list the demo scene');
  log('ready', { scenes: ready.data.payload.scenes.map((s) => s.id) });

  if (agentScene) {
    // 목 에이전트가 쓴 신: 소스가 빌드·재생되고 copy 원문이 DOM에 그대로 나온다(Text Fidelity).
    const f = await (await page.$('#f')).contentFrame();
    await f.waitForFunction(() => document.getElementById('copy')?.textContent === 'Vanilla Studio', { timeout: 30_000 });
    log('agent-scene-rendered', { copy: 'Vanilla Studio' });
    const errs = problems.filter((p) => !/Download the React DevTools/.test(p));
    if (errs.length) throw new Error(`page errors: ${errs.join(' | ')}`);
    return;
  }

  // 2) init의 canvas 주입이 신의 useFrame()에 반영된다
  const frameHandle = await page.$('#f');
  const frame = await frameHandle.contentFrame();
  await frame.waitForFunction(() => document.getElementById('frame')?.textContent === '1080x1920@24', { timeout: 15_000 });
  log('canvas-injected', { frame: await frame.$eval('#frame', (el) => el.textContent) });

  // 3) 신 소스 수정 → HMR로 DOM 반영(새로고침 없이)
  await frame.evaluate(() => (window.__noReload = true));
  writeFileSync(join(dir, 'scenes', 'demo', 'src', 'scene.tsx'), sceneTsx('second'));
  await frame.waitForFunction(() => document.getElementById('label')?.textContent === 'second', { timeout: 30_000 });
  const stillSame = await frame.evaluate(() => window.__noReload === true);
  if (!stillSame) throw new Error('the scene reloaded the whole page instead of hot-updating');
  log('hmr', { label: 'second', fullReload: false });

  const errors = problems.filter((p) => !/Download the React DevTools/.test(p));
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
}

if (!failed) {
  try {
    await scenario(runner.port);
    log('pass');
  } catch (e) {
    failed = e;
  }
}

try {
  await browser?.close();
  host?.server?.close();
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
  console.error(JSON.stringify({ step: 'fail', message: String(failed?.message ?? failed) }));
  process.exit(1);
}
