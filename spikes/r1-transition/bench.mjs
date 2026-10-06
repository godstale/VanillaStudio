// PoC R-1: 서로 다른 iframe 신 사이의 전환 합성(Refactor-Spec-v2 §8, 리스크 R-1).
//   node spikes/r1-transition/bench.mjs [--json]
// 방식 A(두 iframe 오버레이): 호스트 페이지에 신 두 개를 별도 origin(127.0.0.1)의 iframe으로 겹쳐 두고, 위 iframe 요소에 CSS/WAAPI 전환(opacity·transform·clip-path)을 건다.
//   신은 서로의 DOM을 볼 수 없어도(cross-origin) 합성은 호스트의 요소 단위로 이뤄지므로 신 코드는 전환을 몰라도 된다.
// 측정: 전환 600ms 동안 rAF 프레임 간격(평균·p95·최대·드롭), 전환 중간 스크린샷의 픽셀로 "두 신이 실제로 합성되었는가", 콜드 로드 vs 프리로드 시 다음 신이 보이기까지 걸리는 시간.
// Chrome(로컬 설치)과 packages/export-worker의 puppeteer-core가 필요하다.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { default: puppeteer } = await import(pathToFileURL(join(REPO, 'packages/export-worker/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).href);

const DURATION_MS = 600;
const VIEW = { width: 1280, height: 720 };

// 전환 정의: 위(from) iframe을 어떻게 치우는가. 아래(to)는 그대로 있다. (slide-in 처럼 to가 움직이는 변형은 같은 원리라 생략)
const TRANSITIONS = {
  cut: { keyframes: [{ opacity: 1 }, { opacity: 0 }], duration: 0 },
  crossfade: { keyframes: [{ opacity: 1 }, { opacity: 0 }] },
  'slide-left': { keyframes: [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }] },
  'mask-wipe': { keyframes: [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }] },
  'circular-reveal': { keyframes: [{ clipPath: 'circle(75% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)' }] },
  'zoom-through': { keyframes: [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(2.2)', opacity: 0 }] },
};

const sceneHtml = readFileSync(join(HERE, 'scene.html'), 'utf8');
const sceneServer = createServer((req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(sceneHtml);
});
const hostServer = createServer((req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end('<!doctype html><html><body style="margin:0;background:#000"></body></html>');
});
const listen = (s, host) => new Promise((r) => s.listen(0, host, () => r(s.address().port)));
const scenePort = await listen(sceneServer, '127.0.0.1');
const hostPort = await listen(hostServer, '127.0.0.1');
const sceneUrl = (name, color) => `http://127.0.0.1:${scenePort}/scene.html?name=${name}&color=${encodeURIComponent(color)}`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--enable-gpu-rasterization'] });
const results = { chrome: await browser.version(), viewport: VIEW, durationMs: DURATION_MS, transitions: {}, preload: {} };

async function openHost() {
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  // host는 localhost, 신은 127.0.0.1: 서로 다른 origin(앱과 같은 구성)
  await page.goto(`http://localhost:${hostPort}/`, { waitUntil: 'load' });
  await page.evaluate(
    (w, h) => {
      window.__ready = {};
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'ready') window.__ready[e.data.name] = performance.now();
      });
      window.__mk = (id, src, z) => {
        const f = document.createElement('iframe');
        f.id = id;
        f.src = src;
        Object.assign(f.style, { position: 'absolute', left: 0, top: 0, width: w + 'px', height: h + 'px', border: 0, zIndex: z });
        document.body.appendChild(f);
        return f;
      };
    },
    VIEW.width,
    VIEW.height,
  );
  return page;
}

const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] : 0);

// 한 전환을 재생하며 프레임 간격을 잰다. 중간(50%)에 스크린샷을 찍기 위해 시각을 알려 준다.
async function runTransition(name, def) {
  const page = await openHost();
  await page.evaluate((a, b) => {
    window.__mk('to', b, 1);
    window.__mk('from', a, 2);
  }, sceneUrl('A', '#d02020'), sceneUrl('B', '#2040d0'));
  await page.waitForFunction(() => window.__ready.A && window.__ready.B, { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300)); // 두 신의 애니메이션이 돌아가는 상태

  const duration = def.duration ?? DURATION_MS;
  await page.evaluate((keyframes, ms) => {
    window.__frames = [];
    window.__done = false;
    const el = document.getElementById('from');
    const anim = el.animate(keyframes, { duration: ms, easing: 'linear', fill: 'forwards' });
    anim.id = 'transition';
    let last = performance.now();
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (!window.__done) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    anim.onfinish = () => (window.__done = true);
    if (ms === 0) window.__done = true;
  }, def.keyframes, duration);

  let mid = null;
  if (duration > 0) {
    await new Promise((r) => setTimeout(r, duration / 2));
    mid = await page.screenshot({ encoding: 'base64' });
  }
  await page.waitForFunction(() => window.__done, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 100));
  const frames = await page.evaluate(() => window.__frames);
  const end = await page.screenshot({ encoding: 'base64' });

  // 스크린샷(PNG)을 호스트 페이지의 canvas로 읽어 픽셀을 본다(data URL 이미지는 same-origin이라 읽을 수 있다).
  const sample = (b64, points) =>
    page.evaluate(
      async (data, pts) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + data;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return pts.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3)));
      },
      b64,
      points,
    );
  // 모서리 근처(애니메이션 요소를 피한 곳)와 가운데를 본다.
  const pts = [[VIEW.width * 0.25, VIEW.height * 0.5], [VIEW.width * 0.5, VIEW.height * 0.5], [VIEW.width * 0.75, VIEW.height * 0.5]];
  const midPixels = mid ? await sample(mid, pts) : null;
  const endPixels = await sample(end, pts);
  await page.close();

  const f = frames.slice(1); // 첫 간격은 시작 시점이라 제외
  return {
    frames: f.length,
    avgMs: +(f.reduce((a, b) => a + b, 0) / Math.max(1, f.length)).toFixed(2),
    p95Ms: +pct(f, 95).toFixed(2),
    maxMs: +Math.max(...f, 0).toFixed(2),
    dropped: f.filter((x) => x > 25).length, // 60Hz에서 한 프레임 이상 놓침
    midPixels,
    endPixels,
  };
}

const isRed = ([r, g, b]) => r > 150 && g < 90 && b < 90;
const isBlue = ([r, g, b]) => b > 150 && r < 90 && g < 90;
const mixed = ([r, g, b]) => !isRed([r, g, b]) && !isBlue([r, g, b]) && r + b > 120; // 빨강·파랑이 섞인 색

for (const [name, def] of Object.entries(TRANSITIONS)) {
  const r = await runTransition(name, def);
  // 판정: 끝 상태는 모두 파랑(to 신), 중간(cut 제외)에는 빨강·파랑이 한 화면에 함께 있거나 섞여 있어야 한다.
  const endOk = r.endPixels.every(isBlue);
  const mid = r.midPixels;
  const midOk = name === 'cut' ? true : mid.some(isRed) || mid.some(mixed) ? mid.some(isBlue) || mid.some(mixed) : false;
  results.transitions[name] = { ...r, endShowsNextScene: endOk, midShowsBothScenes: midOk };
}

// 프리로드: 다음 신을 미리 로드해 둔 경우 vs 전환 시점에 로드하는 경우, "다음 신 ready까지" 걸리는 시간.
async function measureReady(preloaded) {
  const page = await openHost();
  await page.evaluate((a) => window.__mk('from', a, 2), sceneUrl('A', '#d02020'));
  await page.waitForFunction(() => window.__ready.A, { timeout: 15000 });
  if (preloaded) {
    await page.evaluate((b) => window.__mk('to', b, 1), sceneUrl('B', '#2040d0'));
    await page.waitForFunction(() => window.__ready.B, { timeout: 15000 });
  }
  const ms = await page.evaluate(async (b, pre) => {
    const t0 = performance.now();
    if (!pre) {
      window.__mk('to', b, 1);
      await new Promise((r) => {
        const poll = () => (window.__ready.B ? r() : setTimeout(poll, 1));
        poll();
      });
    }
    return performance.now() - t0; // 프리로드면 이미 준비되어 있어 ~0
  }, sceneUrl('B', '#2040d0'), preloaded);
  await page.close();
  return +ms.toFixed(1);
}
const cold = [];
for (let i = 0; i < 5; i += 1) cold.push(await measureReady(false));
results.preload = { coldReadyMs: cold, coldMedianMs: pct(cold, 50), preloadedReadyMs: await measureReady(true) };

await browser.close();
sceneServer.close();
hostServer.close();

if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
else {
  console.log(`Chrome ${results.chrome}, ${VIEW.width}x${VIEW.height}, ${DURATION_MS}ms transitions, two cross-origin iframes`);
  console.log('transition        frames  avg    p95    max   dropped  midBoth  endNext');
  for (const [n, r] of Object.entries(results.transitions)) {
    console.log(`${n.padEnd(16)} ${String(r.frames).padStart(6)} ${String(r.avgMs).padStart(6)} ${String(r.p95Ms).padStart(6)} ${String(r.maxMs).padStart(6)} ${String(r.dropped).padStart(8)}  ${String(r.midShowsBothScenes).padStart(7)}  ${r.endShowsNextScene}`);
  }
  console.log(`next-scene ready: cold median ${results.preload.coldMedianMs}ms (runs ${results.preload.coldReadyMs.join(', ')}), preloaded ${results.preload.preloadedReadyMs}ms`);
}
const bad = Object.entries(results.transitions).filter(([, r]) => !r.endShowsNextScene || !r.midShowsBothScenes);
if (bad.length) {
  console.error('FAIL: ' + bad.map(([n]) => n).join(', '));
  process.exit(1);
}
