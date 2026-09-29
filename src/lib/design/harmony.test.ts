import { describe, expect, it } from 'vitest';
import { oklch, parse, wcagLuminance } from 'culori';
import {
  HARMONY_KINDS,
  buildCompareSnapshots,
  generateHarmony,
  harmonyHues,
  paletteFromHarmony,
} from './harmony';
import { contrastReport, deriveRoles } from './roles';

const lum = (hex: string) => wcagLuminance(parse(hex) ?? '#000000');

describe('harmonyHues', () => {
  it('offsets hues per kind', () => {
    expect(harmonyHues(100, 'complementary')).toEqual([280]);
    expect(harmonyHues(100, 'analogous')).toEqual([70, 130]);
    expect(harmonyHues(100, 'triadic')).toEqual([220, 340]);
  });
});

describe('generateHarmony', () => {
  it('returns the seed first plus one variant per offset (F-PAL-06)', () => {
    for (const kind of HARMONY_KINDS) {
      const out = generateHarmony('#0D5CC6', kind);
      expect(out.length).toBeGreaterThanOrEqual(2);
      expect(new Set(out).size).toBe(out.length);
    }
    expect(generateHarmony('#0D5CC6', 'triadic')).toHaveLength(3);
  });

  it('monochromatic varies lightness at a fixed hue', () => {
    const [a, b, c] = generateHarmony('#0D5CC6', 'monochromatic') as [string, string, string];
    expect(new Set([lum(a), lum(b), lum(c)]).size).toBe(3);
    const hues = [a, b, c].map((x) => oklch(parse(x) ?? '#000000')?.h ?? 0);
    // sRGB gamut clipping shifts the hue a few degrees on round-trip.
    expect(Math.max(...hues) - Math.min(...hues)).toBeLessThan(10);
  });

  it('tolerates an achromatic seed', () => {
    expect(() => generateHarmony('#888888', 'complementary')).not.toThrow();
    expect(generateHarmony('#888888', 'complementary')).toHaveLength(2);
  });
});

describe('paletteFromHarmony', () => {
  it.each(['light', 'dark'] as const)('builds contrast-safe roles for a %s scheme', (scheme) => {
    const p = paletteFromHarmony('#0D5CC6', 'triadic', scheme);
    expect(p.scheme).toBe(scheme);
    expect(contrastReport(deriveRoles({ ...p })).every((r) => r.ok)).toBe(true);
  });
});

describe('buildCompareSnapshots', () => {
  it('resolves each palette to derived roles for side-by-side compare (F-PAL-07)', () => {
    const rows = buildCompareSnapshots([
      { id: 'a', name: 'A', colors: { canvas: '#FFFFFF', ink: '#111111', primary: '#1E2BFA', accent: '#F59E0B' } },
      { id: 'b', name: 'B', colors: { canvas: '#18191C', ink: '#D9DBE1', primary: '#6F9EF0', accent: '#E0B26A' } },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    for (const row of rows) {
      expect(row.colors['on-primary']).toBeDefined();
      expect(row.ok).toBe(true);
    }
  });
});
