import { describe, expect, it } from 'vitest';
import { designTextToColors, exportPaletteFile, importPaletteText, paletteFromDesignColors, slugifyPaletteName } from './paletteIo';

const PALETTE = JSON.stringify({
  version: 1,
  id: 'my-warm',
  name: 'My Warm',
  tags: ['warm'],
  scheme: 'light',
  colors: { canvas: '#FFFFFF', ink: '#111111', primary: '#1E2BFA', accent: '#F59E0B' },
  source: 'user',
});

describe('paletteIo', () => {
  it('round-trips a palette file', () => {
    const parsed = importPaletteText(PALETTE);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(exportPaletteFile(parsed.palette)).toBe(`${JSON.stringify(parsed.palette, null, 2)}\n`);
    }
  });

  it('rejects broken palette JSON', () => {
    expect(importPaletteText('{oops').ok).toBe(false);
    expect(importPaletteText(JSON.stringify({ version: 1 })).ok).toBe(false);
  });

  it('slugifies names', () => {
    expect(slugifyPaletteName('My Warm 2026!', 'fallback')).toBe('my-warm-2026');
    expect(slugifyPaletteName('!!!', 'fallback')).toBe('fallback');
  });

  it('builds a user palette from DESIGN.md colors', () => {
    const colors = designTextToColors('---\ncolors:\n  canvas: "#FFFFFF"\n  ink: "#111111"\n  primary: "#1E2BFA"\n  accent: "#F59E0B"\n---\n');
    const palette = paletteFromDesignColors(colors, { id: 'from-design', name: 'From design', scheme: 'light' });
    expect(palette.source).toBe('user');
    expect(palette.colors.canvas).toBe('#FFFFFF');
  });

  it('rejects color-less DESIGN.md text', () => {
    expect(() => designTextToColors('# prose only')).toThrow('no-colors');
  });
});
