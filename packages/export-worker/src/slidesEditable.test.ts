// Editable PPTX (Beta, T5.7) tests: wrap fix, deck merge, fonts/guide and the
// orchestration with fake pages (no browser needed).
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  applyWrapNone,
  buildEditableExportExpression,
  bundleProjectFonts,
  EDITABLE_FILE,
  EDITABLE_INCHES,
  exportEditableSlides,
  FONTS_GUIDE,
  mergeSlideDecks,
  postProcessDeck,
} from './slidesEditable';
import { CancelledError } from './job';
import type { SlidesJob } from './job';
import type { StepContext } from './run';

const SINGLE_LINE = `<p:sp><p:nvSpPr/><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp>`;
const MULTI_LINE = `<p:sp><p:nvSpPr/><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>One</a:t></a:r><a:br/><a:r><a:t>Two</a:t></a:r></a:p></p:txBody></p:sp>`;

describe('applyWrapNone', () => {
  it('patches single-line boxes only', () => {
    expect(applyWrapNone(SINGLE_LINE)).toEqual({ xml: expect.stringContaining('wrap="none"'), patched: 1 });
    const multi = applyWrapNone(MULTI_LINE);
    expect(multi).toEqual({ xml: MULTI_LINE, patched: 0 });
  });

  it('keeps an explicit wrap and self-closing tags valid', () => {
    const explicit = SINGLE_LINE.replace('<a:bodyPr/>', '<a:bodyPr wrap="square"/>');
    expect(applyWrapNone(explicit)).toEqual({ xml: explicit, patched: 0 });
    const { xml } = applyWrapNone(SINGLE_LINE);
    expect(xml).toContain('<a:bodyPr wrap="none"/>');
    expect(xml).not.toContain('<<');
  });
});

/** Minimal one-slide deck: enough structure for the merge to transplant. */
async function oneSlideDeck(title: string, withFont: Uint8Array | null): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="rels"/><Override PartName="/ppt/presentation.xml" ContentType="presentation"/><Override PartName="/ppt/slides/slide1.xml" ContentType="slide"/></Types>`,
  );
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`,
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<Relationships xmlns="rels"><Relationship Id="rId1" Type="theme" Target="theme/theme1.xml"/><Relationship Id="rId2" Type="slide" Target="slides/slide1.xml"/></Relationships>`,
  );
  zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="p"><p:cSld><p:spTree>${SINGLE_LINE.replace('Hello', title)}</p:spTree></p:cSld></p:sld>`);
  zip.file('ppt/slides/_rels/slide1.xml.rels', `<Relationships xmlns="rels"><Relationship Id="rId1" Type="layout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`);
  if (withFont) zip.file('ppt/fonts/font1.odttf', withFont);
  return zip.generateAsync({ type: 'uint8array' });
}

describe('mergeSlideDecks', () => {
  it('transplants donor slides and extends content types, rels and the slide list', async () => {
    const merged = await mergeSlideDecks([await oneSlideDeck('A', null), await oneSlideDeck('B', null), await oneSlideDeck('C', null)]);
    const zip = await JSZip.loadAsync(merged);
    expect(Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort()).toEqual([
      'ppt/slides/slide1.xml',
      'ppt/slides/slide2.xml',
      'ppt/slides/slide3.xml',
    ]);
    const presentation = await zip.file('ppt/presentation.xml')?.async('string');
    expect(presentation?.match(/<p:sldId /g)).toHaveLength(3);
    const rels = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
    expect(rels).toContain('slides/slide2.xml');
    expect(rels).toContain('slides/slide3.xml');
    const types = await zip.file('[Content_Types].xml')?.async('string');
    expect(types).toContain('/ppt/slides/slide2.xml');
    const slide2 = await zip.file('ppt/slides/slide2.xml')?.async('string');
    expect(slide2).toContain('>B<');
    // Donor rels travel with their slide.
    expect(await zip.file('ppt/slides/_rels/slide3.xml.rels')?.async('string')).toContain('slideLayout1.xml');
  });

  it('keeps the base copy of shared parts (embedded fonts)', async () => {
    const baseFont = Uint8Array.from([1, 2, 3]);
    const donorFont = Uint8Array.from([9, 9, 9]);
    const merged = await mergeSlideDecks([await oneSlideDeck('A', baseFont), await oneSlideDeck('B', donorFont)]);
    const zip = await JSZip.loadAsync(merged);
    expect(Array.from(await zip.file('ppt/fonts/font1.odttf')?.async('uint8array') ?? [])).toEqual([1, 2, 3]);
  });

  it('rejects an empty deck list', async () => {
    await expect(mergeSlideDecks([])).rejects.toThrow(/nothing to merge/);
  });
});

describe('postProcessDeck', () => {
  it('wrap-fixes every slide part', async () => {
    const deck = await oneSlideDeck('A', null);
    const { deck: fixed, patched } = await postProcessDeck(deck);
    expect(patched).toBe(1);
    const zip = await JSZip.loadAsync(fixed);
    expect(await zip.file('ppt/slides/slide1.xml')?.async('string')).toContain('wrap="none"');
  });
});

describe('buildEditableExportExpression', () => {
  // ZIP magic, like a real one-slide deck (O lane: 21KB normal deck).
  const DECK_BYTES = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x01, 0x02]);

  /**
   * Evaluate with real `page.evaluate` semantics: a string first argument is
   * an expression, extra args are ignored. The old
   * `evaluate(fnSource, sel, w, h)` shape never invoked the function here.
   */
  async function evaluateLikePuppeteer(expr: string, ...extra: unknown[]): Promise<unknown> {
    if (extra.length > 0) throw new Error('expression must be self-contained (single evaluate argument)');
    const seen: { sel: unknown; width: unknown; height: unknown } = { sel: null, width: null, height: null };
    const g = globalThis as unknown as Record<string, unknown>;
    const prev = g['domToPptx'];
    g['domToPptx'] = {
      exportToPptx: (sel: unknown, opts: unknown) => {
        const o = opts as { width: unknown; height: unknown };
        seen.sel = sel;
        seen.width = o.width;
        seen.height = o.height;
        return Promise.resolve(new Blob([DECK_BYTES]));
      },
    };
    try {
      const out: unknown = await eval(expr);
      return { out, seen };
    } finally {
      if (prev === undefined) delete g['domToPptx'];
      else g['domToPptx'] = prev;
    }
  }

  it('is a self-invoking expression that yields deck bytes with no extra args', async () => {
    const expr = buildEditableExportExpression('#root', EDITABLE_INCHES.width, EDITABLE_INCHES.height);
    expect(expr.trimStart().startsWith('(async')).toBe(true);
    const result = (await evaluateLikePuppeteer(expr)) as { out: unknown; seen: { sel: unknown; width: unknown; height: unknown } };
    expect(Array.from(result.out as ArrayLike<number>)).toEqual(Array.from(DECK_BYTES));
    expect(result.seen).toEqual({ sel: '#root', width: EDITABLE_INCHES.width, height: EDITABLE_INCHES.height });
  });

  it('escapes hostile selectors through JSON serialization', async () => {
    const hostile = `#a"b\\c'd`;
    const result = (await evaluateLikePuppeteer(
      buildEditableExportExpression(hostile, 13.333, 7.5),
    )) as { out: unknown; seen: { sel: unknown } };
    expect(result.seen.sel).toBe(hostile);
    expect(Array.from(result.out as ArrayLike<number>)).toEqual(Array.from(DECK_BYTES));
  });
});

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'editable-'));
}

describe('bundleProjectFonts', () => {
  it('copies @fontsource files and writes the guide', () => {
    const project = tempDir();
    try {
      const fontDir = path.join(project, 'node_modules', '@fontsource', 'pkg', 'files');
      mkdirSync(fontDir, { recursive: true });
      writeFileSync(path.join(fontDir, 'font-a.woff2'), 'a');
      writeFileSync(path.join(fontDir, 'font-b.ttf'), 'b');
      const out = path.join(project, 'out');
      mkdirSync(out, { recursive: true });
      const written = bundleProjectFonts(project, out);
      expect(written.map((f) => path.basename(f)).sort()).toEqual([FONTS_GUIDE, 'font-a.woff2', 'font-b.ttf']);
      const guide = readFileSync(path.join(out, FONTS_GUIDE), 'utf8');
      expect(guide).toContain('fonts/font-a.woff2');
      expect(guide).toContain('PowerPoint');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('writes a guide with a note when the project has no fonts', () => {
    const project = tempDir();
    try {
      const out = path.join(project, 'out');
      mkdirSync(out, { recursive: true });
      const written = bundleProjectFonts(project, out);
      expect(written).toHaveLength(1);
      expect(readFileSync(written[0], 'utf8')).toContain('no @fontsource files found');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});

function testJob(projectDir: string, outDir: string): SlidesJob {
  return {
    version: 1,
    kind: 'slides',
    projectDir,
    outDir,
    slides: [
      { name: 's1', t: 0 },
      { name: 's2', t: 5 },
    ],
    width: 960,
    height: 540,
    scale: 1,
    pptx: false,
    pdf: false,
    editable: true,
  };
}

describe('exportEditableSlides', () => {
  it('converts, merges and bundles with fake pages', async () => {
    const project = tempDir();
    const outDir = path.join(project, 'exports', 'x-slides');
    const events: Array<{ type: string; percent?: number; step?: string }> = [];
    const ctx: StepContext = {
      signal: undefined,
      onEvent: (e) => {
        if (e.type === 'progress') events.push({ type: e.type, percent: e.percent, step: e.step });
      },
    };
    const deckA = await oneSlideDeck('A', null);
    const deckB = await oneSlideDeck('B', null);
    const decks = [deckA, deckB];
    const files = await exportEditableSlides(testJob(project, outDir), ctx, {
      runBuild: async () => undefined,
      serve: async () => ({ url: 'http://127.0.0.1:1/', close: async () => undefined }),
      readBundle: () => '/* fake bundle */',
      launch: async () => ({
        newPage: async () => ({
          goto: async () => undefined,
          waitForReady: async () => undefined,
          injectBundle: async () => undefined,
          exportSlideHtml: async () => {
            const next = decks.shift();
            if (!next) throw new Error('no more decks');
            return next;
          },
          close: async () => undefined,
        }),
        close: async () => undefined,
      }),
    });
    expect(files[0]).toBe(path.join(outDir, EDITABLE_FILE));
    expect(files[files.length - 1]).toBe(path.join(outDir, FONTS_GUIDE));
    const zip = await JSZip.loadAsync(readFileSync(files[0]));
    expect(Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))).toHaveLength(2);
    expect(await zip.file('ppt/slides/slide2.xml')?.async('string')).toContain('wrap="none"');
    const percents = events.map((e) => e.percent ?? 0);
    expect(percents[0]).toBe(5);
    expect(percents[percents.length - 1]).toBe(100);
    expect(events.some((e) => e.step === 'editable')).toBe(true);
    rmSync(project, { recursive: true, force: true });
  });

  it('fails fast when the bundle is missing and stops on cancel', async () => {
    const project = tempDir();
    try {
      const ctx: StepContext = { signal: undefined, onEvent: () => undefined };
      await expect(
        exportEditableSlides(testJob(project, path.join(project, 'o1')), ctx, {
          runBuild: async () => undefined,
          readBundle: () => {
            throw new Error('export worker: dom-to-pptx bundle not found at X');
          },
        }),
      ).rejects.toThrow(/bundle not found/);
      const ac = new AbortController();
      ac.abort();
      const cancelledCtx: StepContext = { signal: ac.signal, onEvent: () => undefined };
      await expect(
        exportEditableSlides(testJob(project, path.join(project, 'o2')), cancelledCtx, {
          runBuild: async () => undefined,
        }),
      ).rejects.toBeInstanceOf(CancelledError);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
