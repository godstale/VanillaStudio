// Editable PPTX export (Beta, T5.7): Technical-Design §7, S5.
//
// Image PPTX (slides.ts) is pixels; this module converts the live DOM with the
// vendored `dom-to-pptx` browser bundle (`resources/workers/vendor/`, MIT —
// the npm package drags in all of puppeteer, so only the bundle is vendored):
//
//   per slide: goto `?mode=render&t=` → `__vanillaReady` → inject bundle →
//   `domToPptx.exportToPptx('#root', { width: 13.333, height: 7.5,
//   skipDownload: true })` (Blob, S5: 3 slides ≈ 0.24s)
//
// …then merge the one-slide decks into one deck (OOXML slide transplant via
// JSZip) and set `wrap="none"` on single-line text boxes (S5: without it
// PowerPoint wraps the line and shapes overlap).
//
// Limits (shipped next to the file in FONTS-README.md): PowerPoint does not
// use embedded web fonts, so the used @fontsource files are bundled with an
// install note; gradients/shadows are approximations; WebGL canvases need
// `preserveDrawingBuffer` to convert at all.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { buildShotUrl, resolveChromeExecutable, serveStatic, type StaticServer } from './capture';
import { throwIfCancelled, type SlidesJob } from './job';
import { type StepContext } from './run';
import { runViteBuild, type ViteBuildOptions } from './web';

/** 13.333in × 7.5in at 72dpi = 960×540pt (S2: PowerPoint shows 960×540pt). */
export const EDITABLE_INCHES = { width: 13.333, height: 7.5 } as const;

/** Slide root converted per navigation (the viewport is the slide size). */
export const EDITABLE_SELECTOR = '#root';

export const EDITABLE_FILE = 'slides-editable.pptx';
export const FONTS_DIR = 'fonts';
export const FONTS_GUIDE = 'FONTS-README.md';
export const VENDOR_BUNDLE = 'dom-to-pptx.bundle.js';

/** Max @fontsource files copied next to the deck. */
export const MAX_BUNDLED_FONTS = 24;

/**
 * Locate the vendored bundle. In production the worker runs as
 * `resources/workers/vanilla-export.mjs` with `vendor/` next to it.
 */
export function resolveVendorBundle(scriptPath: string = process.argv[1] ?? ''): string {
  return path.join(path.dirname(scriptPath), 'vendor', VENDOR_BUNDLE);
}

// ---- page seam (puppeteer in prod, fakes in tests) ---------------------------

export interface EditableSlidePage {
  goto(url: string): Promise<void>;
  /** Resolve once `__vanillaReady` is true; reject on `__vanillaError` or timeout. */
  waitForReady(timeoutMs: number): Promise<void>;
  injectBundle(code: string): Promise<void>;
  exportSlideHtml(selector: string, widthIn: number, heightIn: number): Promise<Uint8Array>;
  close(): Promise<void>;
}

export interface EditableSlideBrowser {
  newPage(width: number, height: number, deviceScaleFactor: number): Promise<EditableSlidePage>;
  close(): Promise<void>;
}

export type LaunchEditableBrowser = (executablePath: string) => Promise<EditableSlideBrowser>;

/**
 * Build the browser expression for one slide conversion. `page.evaluate`
 * treats a string first argument as an expression and ignores any extra
 * args, so the call must be self-contained: an async IIFE with
 * JSON-serialized arguments. Passing `(fnSource, sel, w, h)` never invoked
 * the function and produced an empty deck (W1 fix).
 */
export function buildEditableExportExpression(selector: string, widthIn: number, heightIn: number): string {
  const args = `${JSON.stringify(selector)}, ${JSON.stringify(widthIn)}, ${JSON.stringify(heightIn)}`;
  return `(async (sel, w, h) => {
    const blob = await globalThis.domToPptx.exportToPptx(sel, { width: w, height: h, skipDownload: true });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  })(${args})`;
}

class PuppeteerEditablePage implements EditableSlidePage {
  constructor(
    private readonly page: Page,
    private readonly bundleCode: string,
  ) {}

  goto(url: string): Promise<void> {
    return this.page.goto(url, { waitUntil: 'load', timeout: 60_000 }).then(() => undefined);
  }

  async waitForReady(timeoutMs: number): Promise<void> {
    await this.page.waitForFunction('window.__vanillaReady === true', { timeout: timeoutMs, polling: 100 });
    const error: unknown = await this.page.evaluate('window.__vanillaError ?? null').catch(() => null);
    if (typeof error === 'string' && error) throw new Error(`export worker: scene reported an error: ${error}`);
  }

  injectBundle(): Promise<void> {
    return this.page.addScriptTag({ content: this.bundleCode }).then(() => undefined);
  }

  async exportSlideHtml(selector: string, widthIn: number, heightIn: number): Promise<Uint8Array> {
    // Single-argument call: `page.evaluate` treats a string as an expression
    // and ignores extra args, so the slide conversion must be self-contained.
    const raw: unknown = await this.page.evaluate(buildEditableExportExpression(selector, widthIn, heightIn));
    if (!Array.isArray(raw) || !raw.every((n: unknown) => typeof n === 'number')) {
      throw new Error('export worker: editable export returned no PPTX bytes');
    }
    return Uint8Array.from(raw as number[]);
  }

  close(): Promise<void> {
    return this.page.close().catch(() => undefined).then(() => undefined);
  }
}

class PuppeteerEditableBrowser implements EditableSlideBrowser {
  constructor(
    private readonly browser: Browser,
    private readonly bundleCode: string,
  ) {}

  async newPage(width: number, height: number, deviceScaleFactor: number): Promise<EditableSlidePage> {
    const page = await this.browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    return new PuppeteerEditablePage(page, this.bundleCode);
  }

  close(): Promise<void> {
    void this.browser.close().catch(() => undefined);
    return Promise.resolve();
  }
}

/** Default launcher: puppeteer-core over stdio pipes (see `launchManagedBrowser`). */
export function launchEditableBrowser(executablePath: string, bundleCode: string): Promise<EditableSlideBrowser> {
  return puppeteer
    .launch({ executablePath, headless: true, pipe: true })
    .then((b) => new PuppeteerEditableBrowser(b, bundleCode));
}

// ---- wrap="none" post-processing (S5) ----------------------------------------

export interface WrapFix {
  xml: string;
  patched: number;
}

/**
 * Set `wrap="none"` on single-line text boxes only: a `<p:sp>` with exactly
 * one `<a:p>` and no `<a:br/>`. Multi-line boxes keep wrapping (with
 * wrap="none" their text would overflow instead).
 */
export function applyWrapNone(slideXml: string): WrapFix {
  let patched = 0;
  const xml = slideXml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, (shape: string) => {
    const paras = shape.match(/<a:p[\s>]/g) ?? [];
    if (paras.length !== 1 || /<a:br[\s/>]/.test(shape)) return shape;
    return shape.replace(/<a:bodyPr\b((?:[^>"']|"[^"]*"|'[^']*)*?)(\/?)>/, (tag: string, attrs: string, slash: string) => {
      if (/wrap\s*=/.test(attrs)) return tag;
      patched += 1;
      return `<a:bodyPr${attrs} wrap="none"${slash}>`;
    });
  });
  return { xml, patched };
}

// ---- deck merge (one-slide decks → one deck) ----------------------------------

const SLIDE_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const SLIDE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
const NOTES_SLIDE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide';

function maxId(text: string, re: RegExp): number {
  let max = 0;
  for (const m of text.matchAll(re)) max = Math.max(max, Number(m[1]));
  return max;
}

/**
 * Remove `notesSlide` relationships from a slide rels document. Donor decks
 * each carry their own notes slide, but the merge keeps the base deck's notes
 * parts only — two slides sharing one notes slide makes PowerPoint refuse to
 * open the merged deck (T7.2). A slide without notes is valid OOXML.
 */
export function stripSharedNotesSlideRels(relsXml: string): { xml: string; stripped: number } {
  let stripped = 0;
  const escaped = NOTES_SLIDE_REL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const xml = relsXml.replace(new RegExp(`<Relationship\\b[^>]*?${escaped}"[^>]*?/>\\s*`, 'g'), () => {
    stripped += 1;
    return '';
  });
  return { xml, stripped };
}

/**
 * Bring `docProps/app.xml` slide metadata in line with the merged slide count
 * (`<Slides>`, the "Slide Titles" heading-pair count and the title entries).
 * PowerPoint tolerates a stale count for opening, but the properties dialog
 * and search indexing read these. No-op when the part is absent.
 */
export function fixAppXmlSlideCount(appXml: string, baseSlides: number, totalSlides: number): string {
  let out = appXml.replace(/<Slides>\d+<\/Slides>/, `<Slides>${totalSlides}</Slides>`);
  out = out.replace(
    /(<vt:lpstr>Slide Titles<\/vt:lpstr><\/vt:variant>\s*<vt:variant><vt:i4>)\d+/,
    `$1${totalSlides}`,
  );
  const titles: string[] = [];
  for (let i = baseSlides + 1; i <= totalSlides; i++) titles.push(`<vt:lpstr>Slide ${i}</vt:lpstr>`);
  if (titles.length > 0) {
    out = out.replace(/<vt:vector size="(\d+)" baseType="lpstr">/, (tag: string, size: string) => {
      const extra = titles.join('');
      return tag.replace(`size="${size}"`, `size="${Number(size) + titles.length}"`) + extra;
    });
  }
  return out;
}

/**
 * Transplant slides 2..N into the first deck: copy each donor's slide part +
 * rels under a fresh name, carry over missing parts (fonts/media), extend
 * `[Content_Types]`, `ppt/presentation.xml` and its rels.
 */
export async function mergeSlideDecks(decks: readonly Uint8Array[]): Promise<Uint8Array> {
  if (decks.length === 0) throw new Error('export worker: nothing to merge');
  const base = await JSZip.loadAsync(decks[0]);
  const readText = async (zip: JSZip, name: string): Promise<string> => {
    const file = zip.file(name);
    if (!file) throw new Error(`export worker: deck is missing ${name}`);
    return file.async('string');
  };
  let slideCount = Object.keys(base.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length;
  let presentation = await readText(base, 'ppt/presentation.xml');
  let presentationRels = await readText(base, 'ppt/_rels/presentation.xml.rels');
  let contentTypes = await readText(base, '[Content_Types].xml');
  let nextSldId = Math.max(256, maxId(presentation, /<p:sldId\b[^>]*\bid="(\d+)"/g) + 1);
  let nextRId = maxId(presentationRels, /\bId="rId(\d+)"/g) + 1;
  const baseSlideCount = slideCount;

  for (const donorBytes of decks.slice(1)) {
    const donor = await JSZip.loadAsync(donorBytes);
    slideCount += 1;
    const slideName = `ppt/slides/slide${slideCount}.xml`;
    const slideRelsName = `ppt/slides/_rels/slide${slideCount}.xml.rels`;
    base.file(slideName, await readText(donor, 'ppt/slides/slide1.xml'));
    const donorRels = donor.file('ppt/slides/_rels/slide1.xml.rels');
    if (donorRels) {
      // Donor notes slides are not transplanted (the base deck's notes parts
      // stay) — strip the rel so no two slides share one notes slide (T7.2).
      const { xml } = stripSharedNotesSlideRels(await donorRels.async('string'));
      base.file(slideRelsName, xml);
    }
    // Shared parts (embedded fonts, media): same project → same bytes, keep the base copy.
    for (const [name, entry] of Object.entries(donor.files)) {
      if (entry.dir) continue;
      if (
        name === 'ppt/slides/slide1.xml' ||
        name === 'ppt/slides/_rels/slide1.xml.rels' ||
        name === 'ppt/presentation.xml' ||
        name === 'ppt/_rels/presentation.xml.rels' ||
        name === '[Content_Types].xml'
      ) {
        continue;
      }
      if (!base.file(name)) {
        const data = await donor.file(name)?.async('uint8array');
        if (data) base.file(name, data);
      }
    }
    const rId = `rId${nextRId}`;
    nextRId += 1;
    if (!contentTypes.includes(`PartName="/${slideName}"`)) {
      contentTypes = contentTypes.replace(
        '</Types>',
        `  <Override PartName="/${slideName}" ContentType="${SLIDE_TYPE}"/>\n</Types>`,
      );
    }
    presentationRels = presentationRels.replace(
      '</Relationships>',
      `  <Relationship Id="${rId}" Type="${SLIDE_REL}" Target="slides/slide${slideCount}.xml"/>\n</Relationships>`,
    );
    presentation = presentation.replace(
      '</p:sldIdLst>',
      `    <p:sldId id="${nextSldId}" r:id="${rId}"/>\n  </p:sldIdLst>`,
    );
    nextSldId += 1;
  }
  base.file('ppt/presentation.xml', presentation);
  base.file('ppt/_rels/presentation.xml.rels', presentationRels);
  base.file('[Content_Types].xml', contentTypes);
  const appXml = base.file('docProps/app.xml');
  if (appXml) {
    base.file('docProps/app.xml', fixAppXmlSlideCount(await appXml.async('string'), baseSlideCount, slideCount));
  }
  return base.generateAsync({ type: 'uint8array' });
}

/** Run {@link applyWrapNone} over every slide part of a deck. */
export async function postProcessDeck(deck: Uint8Array): Promise<{ deck: Uint8Array; patched: number }> {
  const zip = await JSZip.loadAsync(deck);
  let patched = 0;
  for (const name of Object.keys(zip.files)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue;
    const file = zip.file(name);
    if (!file) continue;
    const fixed = applyWrapNone(await file.async('string'));
    patched += fixed.patched;
    zip.file(name, fixed.xml);
  }
  return { deck: await zip.generateAsync({ type: 'uint8array' }), patched };
}

// ---- fonts + guide ------------------------------------------------------------

export interface BundledFont {
  src: string;
  name: string;
}

function walkFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else if (/\.(woff2?|ttf|otf)$/i.test(entry)) out.push(full);
  }
}

/** Used @fontsource files of the project (OFL, cwd-relative names kept). */
export function collectProjectFonts(projectDir: string): BundledFont[] {
  const root = path.join(projectDir, 'node_modules', '@fontsource');
  if (!existsSync(root)) return [];
  const found: string[] = [];
  walkFiles(root, found);
  return found
    .sort()
    .slice(0, MAX_BUNDLED_FONTS)
    .map((src) => ({ src, name: path.relative(projectDir, src).split(path.sep).join('/') }));
}

const GUIDE_LINES = [
  '# Fonts for the editable PPTX (Beta)',
  '',
  'PowerPoint does not use embedded web fonts, so install the files in `fonts/`',
  '(double-click → Install) before editing `slides-editable.pptx`. The deck was',
  'converted from these web fonts; without them PowerPoint substitutes metrics',
  'and text boxes may reflow.',
  '',
  'Known approximations (Technical-Design §7): gradient angles and shadows are',
  'close but not exact; WebGL scenes need `preserveDrawingBuffer` to convert.',
  '',
  '## Bundled files',
  '',
];

/** Copy the project fonts next to the deck and write the install note. Returns all written files. */
export function bundleProjectFonts(projectDir: string, outDir: string): string[] {
  const fonts = collectProjectFonts(projectDir);
  const written: string[] = [];
  if (fonts.length > 0) {
    const target = path.join(outDir, FONTS_DIR);
    mkdirSync(target, { recursive: true });
    for (const font of fonts) {
      const dest = path.join(target, path.basename(font.src));
      copyFileSync(font.src, dest);
      written.push(dest);
    }
  }
  const guide = path.join(outDir, FONTS_GUIDE);
  const lines = [...GUIDE_LINES];
  if (fonts.length === 0) {
    lines.push('(no @fontsource files found in this project)');
  } else {
    for (const font of fonts) lines.push(`- \`${FONTS_DIR}/${path.basename(font.src)}\` (from \`${font.name}\`)`);
  }
  lines.push('');
  writeFileSync(guide, `${lines.join('\n')}`);
  written.push(guide);
  return written;
}

// ---- orchestration ------------------------------------------------------------

export interface EditableDeps {
  runBuild?: (options: ViteBuildOptions) => Promise<void>;
  serve?: (distDir: string) => Promise<StaticServer>;
  launch?: (executablePath: string, bundleCode: string) => Promise<EditableSlideBrowser>;
  /** Read the vendored bundle (default: from `vendor/` next to the worker script). */
  readBundle?: () => string;
  readyTimeoutMs?: number;
}

function defaultReadBundle(): string {
  const file = resolveVendorBundle();
  if (!existsSync(file)) {
    throw new Error(`export worker: dom-to-pptx bundle not found at ${file} (expected resources/workers/vendor/)`);
  }
  return readFileSync(file, 'utf8');
}

/**
 * Convert each slide's DOM to a one-slide deck, merge, wrap-fix, and bundle
 * fonts + guide. Returns all produced files.
 */
export async function exportEditableSlides(job: SlidesJob, ctx: StepContext, deps: EditableDeps = {}): Promise<string[]> {
  const runBuild = deps.runBuild ?? runViteBuild;
  const serve = deps.serve ?? serveStatic;
  const readBundle = deps.readBundle ?? defaultReadBundle;
  throwIfCancelled(ctx.signal);
  const distDir = path.join(job.outDir, '.build', 'dist');
  mkdirSync(job.outDir, { recursive: true });
  ctx.onEvent({ type: 'progress', percent: 5, step: 'build', message: 'vite build' });
  await runBuild({
    projectDir: job.projectDir,
    distDir,
    ffmpeg: job.ffmpeg,
    signal: ctx.signal,
    onLog: (stream, line) => ctx.onEvent({ type: 'log', stream, line }),
  });
  throwIfCancelled(ctx.signal);
  const bundleCode = readBundle();
  const executablePath = job.chromePath ?? resolveChromeExecutable();
  if (!executablePath) throw new Error('export worker: no headless Chrome found (run `hyperframes browser` or check Doctor → export)');
  const launch = deps.launch ?? launchEditableBrowser;
  const server = await serve(distDir);
  const files: string[] = [];
  const browser = await launch(executablePath, bundleCode);
  try {
    const decks: Uint8Array[] = [];
    for (let i = 0; i < job.slides.length; i++) {
      throwIfCancelled(ctx.signal);
      const slide = job.slides[i];
      ctx.onEvent({ type: 'progress', percent: 15 + Math.floor((55 * i) / job.slides.length), step: 'editable', message: slide.name });
      const page = await browser.newPage(job.width, job.height, job.scale);
      try {
        await page.goto(buildShotUrl(server.url, slide));
        try {
          await page.waitForReady(deps.readyTimeoutMs ?? 60_000);
        } catch (e) {
          throw new Error(`export worker: slide "${slide.name}" never became ready (${(e as Error).message})`, { cause: e });
        }
        await page.injectBundle(bundleCode);
        decks.push(await page.exportSlideHtml(EDITABLE_SELECTOR, EDITABLE_INCHES.width, EDITABLE_INCHES.height));
      } finally {
        await page.close();
      }
    }
    throwIfCancelled(ctx.signal);
    ctx.onEvent({ type: 'progress', percent: 75, step: 'editable', message: 'merge slides' });
    const merged = await mergeSlideDecks(decks);
    ctx.onEvent({ type: 'progress', percent: 85, step: 'editable', message: 'wrap fix' });
    const { deck, patched } = await postProcessDeck(merged);
    const outPath = path.join(job.outDir, EDITABLE_FILE);
    writeFileSync(outPath, deck);
    files.push(outPath);
    ctx.onEvent({ type: 'progress', percent: 90, step: 'editable', message: `${job.slides.length} slides, ${patched} wrap fixes` });
    files.push(...bundleProjectFonts(job.projectDir, job.outDir));
  } finally {
    await browser.close();
    await server.close();
    rmSync(path.join(job.outDir, '.build'), { recursive: true, force: true });
  }
  throwIfCancelled(ctx.signal);
  ctx.onEvent({ type: 'progress', percent: 100, step: 'done', message: `${files.length} files` });
  return files;
}
