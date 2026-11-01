// 예제 라이브러리 도구(D-047). 사용법은 resources/examples/README.md.
//   pnpm examples new <kind> <id> [--motion]   예제 폴더 만들기
//   pnpm examples check                        전체 규칙 검사
//   pnpm examples capture [kind/id ...] [--force]   preview.webp 생성(없거나 오래된 것만)
//   pnpm examples backlog                      Docs/Planning/Examples-Backlog.md 재생성
//   pnpm examples status                       종류별 진행률
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(REPO, 'resources');
const ROOT = join(RES, 'examples');
const BACKLOG = join(REPO, 'Docs/Planning/Examples-Backlog.md');
const FRAMES = 8;
const MAX_HTML_BYTES = 32 * 1024;
const MAX_PREVIEW_BYTES = 150 * 1024;
const BATCH_SIZE = 12;
const CHROMES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

/** 예제를 받을 수 있는 전체 항목. id는 폴더명이 되고 앱은 kind/id로 찾는다. */
function catalog() {
  const items = [];
  const push = (kind, id, label, group, hasPreview, hint) => items.push({ kind, id, label, group, hasPreview, hint });

  const lib = json(join(RES, 'workspace-template/STYLE_LIBRARY.json'));
  for (const s of lib.styles) push('style', s.id, s.label.ko, s.family, false, s.example);

  for (const t of json(join(RES, 'project-templates/catalog.json')).templates) {
    push('template', t.id, t.label.ko, 'project', false, t.summary.ko);
  }

  const terms = new Map();
  for (const type of readdirSync(join(RES, 'guides'))) {
    for (const dir of readdirSync(join(RES, 'guides', type))) {
      const base = join(RES, 'guides', type, dir);
      const meta = json(join(base, 'template.json'));
      push('guide', meta.id, meta.label.ko, type, Boolean(meta.previewUrl), meta.description?.ko ?? '');
      if (!existsSync(join(base, 'glossary.json'))) continue;
      for (const term of json(join(base, 'glossary.json')).terms) {
        const seen = terms.get(term.id);
        if (seen) seen.hasPreview ||= Boolean(term.previewUrl);
        else terms.set(term.id, { label: term.label.ko, group: term.category ?? type, hasPreview: Boolean(term.previewUrl), hint: term.definition.ko });
      }
    }
  }
  for (const [id, t] of terms) push('technique', id, t.label, t.group, t.hasPreview, t.hint);

  const opus = json(join(RES, 'opus/opus-catalog.json'));
  for (const p of opus.decomposedPresets) push('preset', p.id, p.label.ko, p.category, Boolean(p.previewUrl), p.description.ko);
  for (const r of opus.recipes) push('recipe', r.id, r.title.ko, r.sceneType, Boolean(r.previewUrl), r.summary.ko);

  for (const file of readdirSync(join(RES, 'palettes')).filter((f) => f.endsWith('.json'))) {
    const p = json(join(RES, 'palettes', file));
    push('palette', p.id, p.name, p.scheme ?? 'palette', Boolean(p.previewUrl), Object.values(p.colors).slice(0, 4).join(' '));
  }
  return items;
}

const dirOf = (kind, id) => join(ROOT, kind, id);
const isDone = ({ kind, id }) => existsSync(join(dirOf(kind, id), 'preview.webp'));

function authored() {
  const found = [];
  for (const kind of readdirSync(ROOT, { withFileTypes: true })) {
    if (!kind.isDirectory() || kind.name.startsWith('_')) continue;
    for (const id of readdirSync(join(ROOT, kind.name))) found.push({ kind: kind.name, id });
  }
  return found;
}

// 예제는 카드 안에서 재생되는 오프라인 자료라 외부 의존과 비결정 입력을 모두 막는다.
const BANNED = [
  [/https?:\/\/(?!www\.w3\.org\/)/i, 'external URL'],
  [/<script[^>]+\bsrc=/i, 'external script'],
  [/<link\b/i, '<link> tag'],
  [/@import\b/i, '@import'],
  [/url\(\s*['"]?(?!data:|#)/i, 'url() that is not data: or #fragment'],
  [/<img\b(?![^>]*src=["']data:)/i, '<img> that is not data:'],
  [/<(video|audio|iframe)\b/i, 'media or iframe tag'],
  [/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b/, 'network or storage API'],
  [/Math\.random|Date\.now|new Date|performance\.now/, 'non-deterministic input'],
  [/\b(gsap|greensock)\b/i, 'GSAP (D-007)'],
  [/pixar|disney|lego|ghibli|nintendo|minecraft|pok[eé]mon|barbie|funko|sanrio|hello kitty|marvel|simpsons?|tim burton|grand theft auto/i, 'trademark name'],
];

function checkOne({ kind, id }, known) {
  const problems = [];
  const dir = dirOf(kind, id);
  if (!known.has(`${kind}/${id}`)) problems.push('not in the catalog');
  const metaPath = join(dir, 'example.json');
  const htmlPath = join(dir, 'example.html');
  if (!existsSync(metaPath) || !existsSync(htmlPath)) return [...problems, 'example.json and example.html are required'];

  const meta = json(metaPath);
  if (typeof meta.seconds !== 'number' || meta.seconds < 0 || meta.seconds > 12) problems.push('seconds must be 0 (still) to 12');
  if (!meta.note?.ko?.trim() || !meta.note?.en?.trim()) problems.push('note.ko and note.en are required');

  const html = readFileSync(htmlPath, 'utf8');
  if (Buffer.byteLength(html) > MAX_HTML_BYTES) problems.push(`example.html is over ${MAX_HTML_BYTES} bytes`);
  if (/TODO/.test(html)) problems.push('starter TODO left in example.html');
  for (const [pattern, why] of BANNED) if (pattern.test(html)) problems.push(`banned: ${why}`);
  if (meta.seconds > 0 && !/seekExample|@keyframes/.test(html)) problems.push('motion needs window.seekExample or CSS @keyframes');

  const preview = join(dir, 'preview.webp');
  if (!existsSync(preview)) problems.push('preview.webp missing, run pnpm examples capture');
  else if (statSync(preview).size > MAX_PREVIEW_BYTES) problems.push(`preview.webp is over ${MAX_PREVIEW_BYTES} bytes`);
  return problems;
}

function cmdCheck() {
  const known = new Set(catalog().map((i) => `${i.kind}/${i.id}`));
  let bad = 0;
  const all = authored();
  for (const item of all) {
    for (const p of checkOne(item, known)) {
      bad += 1;
      console.error(`${item.kind}/${item.id}: ${p}`);
    }
  }
  if (bad) process.exit(1);
  console.log(`ok: ${all.length} examples`);
}

function cmdNew(kind, id, motion) {
  if (!kind || !id) fail('usage: pnpm examples new <kind> <id> [--motion]');
  const item = catalog().find((i) => i.kind === kind && i.id === id);
  if (!item) fail(`${kind}/${id} is not in the catalog`);
  const dir = dirOf(kind, id);
  if (existsSync(dir)) fail(`${dir} already exists`);
  mkdirSync(dir, { recursive: true });
  cpSync(join(ROOT, '_starter', motion ? 'motion.html' : 'still.html'), join(dir, 'example.html'));
  writeFileSync(join(dir, 'example.json'), `${JSON.stringify({ seconds: motion ? 4 : 0, note: { ko: '', en: '' } }, null, 2)}\n`);
  console.log(`${dir}\nhint: ${item.hint}`);
}

async function launch() {
  const entry = join(REPO, 'packages/export-worker/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js');
  if (!existsSync(entry)) fail('puppeteer-core is missing, run pnpm install');
  const executablePath = CHROMES.find((p) => existsSync(p));
  if (!executablePath) fail('Chrome or Edge not found, set CHROME_PATH');
  const { default: puppeteer } = await import(pathToFileURL(entry).href);
  return puppeteer.launch({ executablePath, headless: true, args: ['--force-device-scale-factor=1', '--hide-scrollbars'] });
}

const SEEK = (t) => {
  for (const a of document.getAnimations()) {
    a.pause();
    a.currentTime = t * 1000;
  }
  window.seekExample?.(t);
};

async function shoot(page, t) {
  await page.evaluate(SEEK, t);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  return page.screenshot({
    type: 'png',
    encoding: 'base64',
    clip: { x: 0, y: 0, width: 1280, height: 720, scale: 0.375 },
  });
}

async function stitch(page, frames) {
  return page.evaluate(async (pngs) => {
    const images = await Promise.all(
      pngs.map(
        (png) =>
          new Promise((done, reject) => {
            const img = new Image();
            img.onload = () => done(img);
            img.onerror = reject;
            img.src = `data:image/png;base64,${png}`;
          }),
      ),
    );
    const canvas = document.createElement('canvas');
    canvas.width = images[0].width * images.length;
    canvas.height = images[0].height;
    const ctx = canvas.getContext('2d');
    images.forEach((img, i) => ctx.drawImage(img, i * img.width, 0));
    return canvas.toDataURL('image/webp', 0.7).split(',')[1];
  }, frames);
}

async function captureOne(browser, { kind, id }) {
  const dir = dirOf(kind, id);
  const meta = json(join(dir, 'example.json'));
  const errors = [];
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().startsWith('file:') || req.url().startsWith('data:')) void req.continue();
      else {
        errors.push(`blocked request ${req.url()}`);
        void req.abort();
      }
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(pathToFileURL(join(dir, 'example.html')).href, { waitUntil: 'load' });

    const count = meta.seconds > 0 ? FRAMES : 1;
    const frames = [];
    for (let i = 0; i < count; i += 1) frames.push(await shoot(page, (meta.seconds * i) / count));
    if (count > 1) {
      if (new Set(frames).size < 3) errors.push('frames barely change, seek is not driving the animation');
      if ((await shoot(page, (meta.seconds * 2) / count)) !== frames[2]) errors.push('seek is not deterministic');
    }
    if (errors.length) return errors;
    const blank = await browser.newPage();
    const webp = await stitch(blank, frames);
    await blank.close();
    writeFileSync(join(dir, 'preview.webp'), Buffer.from(webp, 'base64'));
    return [];
  } finally {
    await page.close();
  }
}

async function cmdCapture(args) {
  const force = args.includes('--force');
  const named = args.filter((a) => !a.startsWith('--')).map((a) => {
    const [kind, id] = a.split('/');
    return { kind, id };
  });
  const targets = (named.length ? named : authored()).filter(({ kind, id }) => {
    if (force || named.length) return true;
    const dir = dirOf(kind, id);
    const preview = join(dir, 'preview.webp');
    return !existsSync(preview) || statSync(preview).mtimeMs < statSync(join(dir, 'example.html')).mtimeMs;
  });
  if (!targets.length) return console.log('nothing to capture');
  const browser = await launch();
  let bad = 0;
  try {
    for (const item of targets) {
      const errors = await captureOne(browser, item);
      for (const e of errors) console.error(`${item.kind}/${item.id}: ${e}`);
      bad += errors.length;
      if (!errors.length) console.log(`captured ${item.kind}/${item.id}`);
    }
  } finally {
    await browser.close();
  }
  if (bad) process.exit(1);
}

const KIND_ORDER = ['style', 'template', 'guide', 'preset', 'recipe', 'technique', 'palette'];

/** 일감 묶음. 진행 상태와 무관하게 카탈로그 순서로 나눠서 배치 번호가 흔들리지 않는다. */
function batches(items) {
  const out = [];
  for (const kind of KIND_ORDER) {
    const groups = new Map();
    for (const item of items.filter((i) => i.kind === kind)) {
      const key = kind === 'style' ? item.group : kind;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const [group, rows] of groups) {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        out.push({ name: `${kind}:${group}`, rows: rows.slice(i, i + BATCH_SIZE) });
      }
    }
  }
  return out.map((b, i) => ({ ...b, id: `E${String(i + 1).padStart(2, '0')}` }));
}

function progress(items) {
  return KIND_ORDER.map((kind) => {
    const rows = items.filter((i) => i.kind === kind);
    const missing = rows.filter((i) => !isDone(i));
    return { kind, total: rows.length, done: rows.length - missing.length, noVisual: missing.filter((i) => !i.hasPreview).length };
  });
}

function cmdBacklog() {
  const items = catalog();
  const table = progress(items)
    .map((p) => `| ${p.kind} | ${p.total} | ${p.done} | ${p.noVisual} |`)
    .join('\n');
  const sections = batches(items).map((b) => {
    const done = b.rows.filter(isDone).length;
    const priority = b.rows.some((r) => !r.hasPreview && !isDone(r)) ? 'P1' : 'P2';
    const rows = b.rows
      .map((r) => {
        const hint = r.hint.replace(/\s+/g, ' ').slice(0, 90);
        return `- [${isDone(r) ? 'x' : ' '}] \`${r.kind}/${r.id}\` ${r.label}${r.hasPreview ? ' (외부 이미지 있음)' : ''} — ${hint}`;
      })
      .join('\n');
    return `## ${b.id} \`${b.name}\` · ${priority} · ${done}/${b.rows.length}\n\n${rows}`;
  });
  writeFileSync(
    BACKLOG,
    `${[
      '# 예제 제작 백로그',
      '> `pnpm examples backlog`가 생성하는 파일입니다. 손으로 고치지 않습니다. 제작 규칙은 `resources/examples/README.md`, 진행 방식은 `TODO.md`의 E 항목을 봅니다.',
      'P1은 볼 수 있는 미리보기가 하나도 없는 항목을 포함한 묶음, P2는 외부 이미지만 있어 오프라인에서 안 보이는 항목의 묶음입니다.',
      `| 종류 | 전체 | 완료 | 미리보기 없음 |\n| --- | --- | --- | --- |\n${table}`,
      ...sections,
    ].join('\n\n')}\n`,
  );
  console.log(`${BACKLOG}: ${batches(items).length} batches`);
}

function cmdStatus() {
  console.table(progress(catalog()));
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'new') cmdNew(rest[0], rest[1], rest.includes('--motion'));
else if (cmd === 'check') cmdCheck();
else if (cmd === 'capture') await cmdCapture(rest);
else if (cmd === 'backlog') cmdBacklog();
else if (cmd === 'status') cmdStatus();
else fail('usage: pnpm examples <new|check|capture|backlog|status>');
