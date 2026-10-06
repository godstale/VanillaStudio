// v1 마이그레이션 출하 게이트 E2E (T7.5, D-033): v1 샘플 프로젝트 3종(web·video·slides)을 변환해 v2 워크스페이스에서 실제로 재생한다.
//   node tests/e2e/v1-migration.mjs [--keep] [--fixture <dir>]
// 순서: v1 픽스처(tests/fixtures/v1/*)를 앱의 변환기(src/lib/migrate/v1.ts, Vite SSR로 로드)로 변환 → 한 워크스페이스에 신 3개로 조립(템플릿 + 런타임)
//   → pnpm install → 프리뷰 서버 → Chrome에서 각 신을 열어 "손실 없이 재생"되는지 확인:
//   ① 페이지 오류 없음 ② 변환된 `params/*.values.json`의 값이 화면에 반영됨(v1 사용자 조절값 보존) ③ 신 코드·문구가 그대로 렌더됨 ④ 시계(video)가 흐름.
// 모두 통과해야 출하한다. 통과하면 종료 코드 0.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(join(fileURLToPath(import.meta.url), '..', '..', '..'));
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FIXTURES = join(REPO, 'tests', 'fixtures', 'v1');
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
};
const log = (step, extra = {}) => console.log(JSON.stringify({ step, ...extra }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { default: puppeteer } = await import(pathToFileURL(join(REPO, 'packages/export-worker/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).href);
const { createServer: createViteServer } = await import(pathToFileURL(join(REPO, 'node_modules/vite/dist/node/index.js')).href);

// ---- v1 번들 읽기(Rust read_v1_project와 같은 규칙) ----------------------------------------------

const TEXT_EXT = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'css', 'html', 'json', 'md', 'svg', 'glsl', 'vert', 'frag', 'txt', 'csv']);
const WANTED = new Set(['vanilla.json', 'DESIGN.md', 'frame.md', 'index.html', 'brief', 'plan', 'assets', 'src', 'params', 'public']);
function readBundle(root) {
  const out = { root, texts: {}, binaries: [], skipped: [] };
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith('.') || name === 'node_modules' || name === 'dist') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const rel = relative(root, p).split(sep).join('/');
        if (TEXT_EXT.has(name.split('.').pop().toLowerCase())) out.texts[rel] = readFileSync(p, 'utf8');
        else out.binaries.push(rel);
      }
    }
  };
  for (const name of readdirSync(root).sort()) {
    if (name.startsWith('.')) continue;
    if (!WANTED.has(name)) out.skipped.push(name);
    else if (statSync(join(root, name)).isDirectory()) walk(join(root, name));
    else out.texts[name] = readFileSync(join(root, name), 'utf8');
  }
  return out;
}

// ---- 워크스페이스 조립 -----------------------------------------------------------------------------

function buildWorkspace(dir, plans) {
  mkdirSync(dir, { recursive: true });
  const vars = { workspaceName: 'v1 migration gate', workspaceId: 'ws_v1gate000000001', workspaceSlug: 'v1-gate' };
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
  const put = (rel, text) => {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  };
  for (const { slug, plan, sceneJson, v1Root } of plans) {
    for (const [rel, text] of Object.entries(plan.workspaceFiles)) put(rel, text);
    for (const [rel, text] of Object.entries(plan.sceneFiles)) put(`scenes/${slug}/${rel}`, text);
    for (const c of plan.copies) cpSync(join(v1Root, ...c.from.split('/')), join(dir, ...(c.scope === 'scene' ? [`scenes/${slug}`, ...c.to.split('/')] : c.to.split('/'))));
    put(`scenes/${slug}/scene.json`, sceneJson);
  }
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

/** 샘플별 기대: 변환된 params 값이 첫 신의 제목에 반영되어야 한다(v1 사용자 조절값 보존). */
const EXPECT = {
  'web-landing': { slug: 'web-landing', title: 'Welcome (tuned)', also: ['Features', 'Three things we do well.'], clock: false },
  'video-promo': { slug: 'video-promo', title: 'Intro (tuned)', also: [], clock: true },
  'slides-deck': { slug: 'slides-deck', title: 'Opening (tuned)', also: ['Plan', 'Close'], clock: false },
};

const keep = arg('keep');
const dir = typeof arg('fixture') === 'string' ? resolve(arg('fixture')) : mkdtempSync(join(tmpdir(), 'vanilla-v1-gate-'));
const results = {};
let runner = null;
let vite = null;
let browser = null;
let failed = null;

try {
  vite = await createViteServer({ root: REPO, configFile: false, logLevel: 'error', appType: 'custom', resolve: { alias: { '@': join(REPO, 'src') } }, server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } });
  const mig = await vite.ssrLoadModule('/src/lib/migrate/v1.ts');
  const sceneMod = await vite.ssrLoadModule('/src/lib/scene/schema.ts');

  const plans = [];
  for (const name of Object.keys(EXPECT)) {
    const v1Root = join(FIXTURES, name);
    const r = mig.planV1Migration(readBundle(v1Root));
    if (!r.ok) throw new Error(`${name}: plan failed: ${r.error}`);
    const scene = r.plan.scene(`scn_gate${plans.length + 1}000000`);
    const sceneJson = sceneMod.serializeScene(scene); // 앱이 쓰는 것과 같은 정규화 직렬화(스키마 검증 포함)
    plans.push({ slug: name, plan: r.plan, sceneJson, v1Root });
    log('planned', { name, type: r.plan.sceneType, unconverted: r.plan.unconverted.length, warnings: r.plan.warnings });
  }

  if (!existsSync(join(dir, 'package.json'))) buildWorkspace(dir, plans);
  if (!existsSync(join(dir, 'node_modules', 'vite'))) {
    log('pnpm-install');
    sh('pnpm', ['install', '--ignore-workspace'], dir);
  }
  runner = await startRunner(dir);
  log('runner', { port: runner.port });

  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  for (const [name, exp] of Object.entries(EXPECT)) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    const problems = [];
    page.on('pageerror', (e) => problems.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && !/favicon|Download the React DevTools|Failed to load resource/.test(m.text()) && problems.push(m.text()));
    await page.goto(`http://127.0.0.1:${runner.port}/scenes/${exp.slug}/src/index.html?mode=preview`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('title')?.textContent, { timeout: 30_000 });
    const text = await page.evaluate(() => document.body.innerText);
    const title = await page.$eval('#title', (el) => el.textContent);
    const checks = {
      noPageErrors: problems.length === 0,
      paramsPreserved: title === exp.title,
      contentRendered: exp.also.every((s) => text.includes(s)),
    };
    if (exp.clock) {
      // 시계가 흐르는가: 제목의 투명도는 시간 함수(0 → 1)다.
      await sleep(900);
      const opacity = await page.$eval('#title', (el) => Number(getComputedStyle(el.parentElement).opacity));
      checks.clockAdvances = opacity > 0.5;
    }
    results[name] = { ok: Object.values(checks).every(Boolean), checks, title, problems };
    log('checked', { name, ...results[name] });
    await page.close();
  }
  const bad = Object.entries(results).filter(([, r]) => !r.ok).map(([n]) => n);
  if (bad.length) throw new Error(`migration gate failed for: ${bad.join(', ')}`);
  log('pass', { samples: Object.keys(results).length });
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

if (failed) {
  console.error(JSON.stringify({ step: 'fail', message: String(failed?.message ?? failed), results }));
  process.exit(1);
}
