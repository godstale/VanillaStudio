// S7 measurements: palette swap latency, layout stability, reversibility, DESIGN.md HMR, HF palette contrast, CLI lint.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

mkdirSync('out', { recursive: true });
const shellRoot = path.join(homedir(), '.cache/puppeteer/chrome-headless-shell');
const chrome = readdirSync(shellRoot)
  .map((v) => path.join(shellRoot, v, 'chrome-headless-shell-win64/chrome-headless-shell.exe'))
  .find(existsSync);

const server = await createServer({ configFile: 'vite.config.ts', logLevel: 'warn' });
await server.listen();
const base = 'http://127.0.0.1:5207';
const { replaceColors } = await server.ssrLoadModule('/src/design/rewrite.ts');
const { parseDesign } = await server.ssrLoadModule('/src/design/parse.ts');
const { deriveRoles, contrastReport } = await server.ssrLoadModule('/src/design/roles.ts');
const { hfToVanilla } = await server.ssrLoadModule('/src/design/hyperframes.ts');
const hf = JSON.parse(readFileSync('refs/hyperframes-presets.json', 'utf8'));
const pal = (id) => deriveRoles(hfToVanilla(hf.palettes.find((p) => p.id === id)));

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1);
  return { n: s.length, min: q(0), p50: q(0.5), p95: q(0.95), max: q(1) };
};

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, defaultViewport: { width: 1280, height: 720 } });
const page = await browser.newPage();
await page.goto(`${base}/host.html`);
await page.evaluate(() => window.hostApi.ready);
await new Promise((r) => setTimeout(r, 1500)); // let the WebGL canvas settle
const frame = page.frames().find((f) => f.url().endsWith('/index.html'));
const shot = async (name) => {
  const el = await page.$('#preview');
  const buf = await el.screenshot({ path: `out/${name}.png` });
  return Buffer.from(buf);
};
const rects = () =>
  frame.evaluate(() =>
    ['#card', '#title', '#body', '#badge', '#accent'].map((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return [s, r.x, r.y, r.width, r.height].join(',');
    }),
  );
const cssVar = (name) => frame.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

const result = {};
const shotA = await shot('A-file-palette');
const rectsA = await rects();

// 1. Swap latency (Bridge setDesign → painted), alternating two HyperFrames palettes.
const B = pal('midnight-dark');
const C = pal('clean-white');
const times = [];
for (let i = 0; i < 40; i++) times.push(await page.evaluate((c) => window.hostApi.setDesign(c), i % 2 ? C : B));
result.swapLatencyMs = stats(times);

await page.evaluate((c) => window.hostApi.setDesign(c), B);
const shotB = await shot('B-midnight-override');
result.cssVarAfterSwap = await cssVar('--color-canvas');
result.layoutStableAcrossPalettes = JSON.stringify(await rects()) === JSON.stringify(rectsA);
result.paletteChangesPixels = !shotA.equals(shotB);

// 2. Reversibility: clearing the override restores the file palette pixel-for-pixel.
await page.evaluate(() => window.hostApi.setDesign(null));
const shotA2 = await shot('A2-restored');
result.restoreIsPixelIdentical = shotA.equals(shotA2);

// 3. DESIGN.md hot update: write a new palette into the file, time until the scene repaints with it.
const original = readFileSync('DESIGN.md', 'utf8');
const D = pal('blue-professional-default');
const coreD = Object.fromEntries(['canvas', 'surface', 'ink', 'ink-muted', 'primary', 'secondary', 'accent', 'line'].map((k) => [k, D[k]]));
const hmr = [];
try {
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const target = i % 2 ? parseDesign(original).tokens.colors : coreD;
    const t0 = await page.evaluate(() => window.hostApi.now());
    writeFileSync('DESIGN.md', replaceColors(original, target, { updateProse: true }).text);
    const t1 = await page.waitForFunction(
      (p) => window.hostApi.designEvents().find((e) => e.primary.toUpperCase() === p.toUpperCase() && e.receivedAt > 0)?.receivedAt,
      { timeout: 10000 },
      target.primary,
    );
    hmr.push((await t1.jsonValue()) - t0);
    await page.evaluate(() => window.hostApi.designEvents().splice(0));
  }
  await shot('D-file-hmr');
} finally {
  writeFileSync('DESIGN.md', original);
}
result.designFileHmrMs = stats(hmr);

// 4. HyperFrames palettes expressed with Vanilla roles + contrast.
const report = hf.palettes.map((p) => {
  const colors = deriveRoles(hfToVanilla(p));
  const checks = contrastReport(colors);
  return { id: p.id, colors, checks, failing: checks.filter((c) => !c.ok).map((c) => `${c.pair} ${c.ratio}`) };
});
writeFileSync('out/hf-palettes-report.json', JSON.stringify(report, null, 1));
result.hfPalettes = { count: report.length, allPass: report.filter((r) => r.failing.length === 0).length, failing: report.filter((r) => r.failing.length).map((r) => `${r.id}: ${r.failing.join(', ')}`) };

// 5. Official CLI lint on a rewritten file.
writeFileSync('out/DESIGN.midnight.md', replaceColors(original, Object.fromEntries(Object.entries(B).filter(([k]) => k !== 'on-primary')), { updateProse: true }).text);
const lint = JSON.parse(execFileSync(process.execPath, ['node_modules/@google/design.md/dist/index.js', 'lint', 'out/DESIGN.midnight.md'], { encoding: 'utf8', input: '' }));
result.cliLintRewritten = lint.summary;

writeFileSync('out/measure.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
await server.close();
process.exit(0);
