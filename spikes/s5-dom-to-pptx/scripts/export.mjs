// S5: convert three DOM slides to an editable PPTX with dom-to-pptx inside headless Chrome.
// Variant A exports as-is; variant B first rasterizes <canvas> elements to <img> (our WebGL fallback).
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

mkdirSync('out', { recursive: true });
const shellRoot = path.join(homedir(), '.cache/puppeteer/chrome-headless-shell');
const chrome = readdirSync(shellRoot)
  .map((v) => path.join(shellRoot, v, 'chrome-headless-shell-win64/chrome-headless-shell.exe'))
  .filter(existsSync)
  .sort()
  .at(-1);

const server = await createServer({ logLevel: 'warn', server: { port: 5305, strictPort: true, host: '127.0.0.1' } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, defaultViewport: { width: 1920, height: 1080 } });

async function run(variant) {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto('http://127.0.0.1:5305/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__vanillaReady === true, { timeout: 20000 });

  // Reference screenshots and text positions (px) from the browser.
  const reference = {};
  for (const id of ['s1', 's2', 's3']) {
    const el = await page.$(`#${id}`);
    await el.screenshot({ path: `out/ref-${id}.png` });
    reference[id] = await page.evaluate((sid) => {
      const root = document.getElementById(sid).getBoundingClientRect();
      const out = [];
      const walk = document.createTreeWalker(document.getElementById(sid), NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const t = walk.currentNode.textContent.trim();
        if (!t) continue;
        const r = walk.currentNode.parentElement.getBoundingClientRect();
        out.push({ text: t, x: r.x - root.x, y: r.y - root.y });
      }
      return out;
    }, id);
  }

  writeFileSync('out/reference.json', JSON.stringify(reference, null, 1));
  if (variant === 'system-font') {
    // Same slides with the web font swapped for a font every Windows PC has.
    await page.addStyleTag({ content: '.serif { font-family: Georgia, serif !important; }' });
    await page.evaluate(() => document.fonts.ready);
  }
  if (variant === 'rasterized-canvas') {
    await page.evaluate(() => {
      for (const c of document.querySelectorAll('canvas')) {
        const img = document.createElement('img');
        img.src = c.toDataURL('image/png');
        img.style.cssText = c.style.cssText;
        img.width = c.width;
        img.height = c.height;
        c.replaceWith(img);
      }
    });
  }

  await page.addScriptTag({ path: 'node_modules/dom-to-pptx/dist/dom-to-pptx.bundle.js' });
  const started = Date.now();
  const b64 = await page.evaluate(async () => {
    const slides = ['s1', 's2', 's3'].map((id) => document.getElementById(id));
    const blob = await window.domToPptx.exportToPptx(slides, { skipDownload: true, width: 13.333, height: 7.5, autoEmbedFonts: true, svgAsVector: true });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  });
  const ms = Date.now() - started;
  const file = `out/deck-${variant}.pptx`;
  writeFileSync(file, Buffer.from(b64, 'base64'));
  await page.close();
  return { variant, file, ms, bytes: Buffer.from(b64, 'base64').length, logs: logs.filter((l) => !l.startsWith('debug')).slice(0, 15) };
}

const results = [await run('as-is'), await run('rasterized-canvas'), await run('system-font')];
writeFileSync('out/export.json', JSON.stringify(results, null, 2));
// Reference text positions once (identical across variants).
console.log(JSON.stringify(results, null, 2));
await browser.close();
await server.close();
process.exit(0);
