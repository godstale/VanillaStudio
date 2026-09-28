// S2: capture @2x stills per slide (ready-gated vs naive), then build image PPTX and PDF.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import PptxGenJS from 'pptxgenjs';
import { PDFDocument } from 'pdf-lib';
import { preview } from 'vite';

mkdirSync('out', { recursive: true });
const shellRoot = path.join(homedir(), '.cache/puppeteer/chrome-headless-shell');
const chrome = readdirSync(shellRoot).map((v) => path.join(shellRoot, v, 'chrome-headless-shell-win64/chrome-headless-shell.exe')).find(existsSync);

const server = await preview({ preview: { port: 5302, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' });
const base = 'http://127.0.0.1:5302/';
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const sha = (b) => createHash('sha1').update(b).digest('hex').slice(0, 12);

async function capture(slide, t, { gated, scale, slowFonts = false }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: scale });
  if (slowFonts) {
    // Simulate a slow font download (large CJK fonts, cold disk) to expose missing font waits.
    await page.setRequestInterception(true);
    page.on('request', (req) => (req.url().includes('.woff') ? setTimeout(() => req.continue(), 800) : req.continue()));
  }
  const started = Date.now();
  await page.goto(`${base}?slide=${slide}&t=${t}`, { waitUntil: gated ? 'load' : 'domcontentloaded' });
  let state = null;
  if (gated) {
    await page.waitForFunction(() => window.__vanillaReady === true, { timeout: 20000 });
    state = await page.evaluate(() => window.__vanillaState);
  }
  const buf = Buffer.from(await page.screenshot({ type: 'png' }));
  const ms = Date.now() - started;
  await page.close();
  return { buf, ms, state };
}

const slides = [
  { slide: 1, t: 2 },
  { slide: 2, t: 2.5 },
  { slide: 3, t: 3 },
];
const result = { slides: [] };
const files = [];
for (const { slide, t } of slides) {
  const a = await capture(slide, t, { gated: true, scale: 2 });
  const b = await capture(slide, t, { gated: true, scale: 2 });
  const naive = await capture(slide, t, { gated: false, scale: 2 });
  const slowGated = await capture(slide, t, { gated: true, scale: 2, slowFonts: true });
  const slowNaive = await capture(slide, t, { gated: false, scale: 2, slowFonts: true });
  if (slide === 1) writeFileSync('out/slide-1-slowfont-naive.png', slowNaive.buf);
  const file = `out/slide-${slide}@2x.png`;
  writeFileSync(file, a.buf);
  writeFileSync(`out/slide-${slide}-naive.png`, naive.buf);
  files.push(file);
  const w = a.buf.readUInt32BE(16);
  const h = a.buf.readUInt32BE(20);
  result.slides.push({
    slide, t, size: `${w}x${h}`, captureMs: a.ms, state: a.state,
    repeatIdentical: a.buf.equals(b.buf),
    naiveDiffersFromGated: !naive.buf.equals(a.buf),
    slowFont: { gatedStillIdentical: slowGated.buf.equals(a.buf), naiveDiffers: !slowNaive.buf.equals(a.buf), gatedMs: slowGated.ms },
    hashes: { gated: sha(a.buf), repeat: sha(b.buf), naive: sha(naive.buf) },
  });
}

// Image PPTX: one full-bleed 16:9 picture per slide (LAYOUT_WIDE = 13.333 x 7.5 in).
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
for (const f of files) pptx.addSlide().addImage({ path: f, x: 0, y: 0, w: 13.333, h: 7.5 });
await pptx.writeFile({ fileName: 'out/deck-image.pptx' });

// PDF: one 16:9 page per slide.
const pdf = await PDFDocument.create();
for (const f of files) {
  const img = await pdf.embedPng(readFileSync(f));
  const page = pdf.addPage([960, 540]);
  page.drawImage(img, { x: 0, y: 0, width: 960, height: 540 });
}
writeFileSync('out/deck.pdf', await pdf.save());

result.pptxBytes = readFileSync('out/deck-image.pptx').length;
result.pdfBytes = readFileSync('out/deck.pdf').length;
writeFileSync('out/capture.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
server.httpServer.close();
process.exit(0);
