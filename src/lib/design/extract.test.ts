import { describe, expect, it } from 'vitest';
import {
  assignRoles,
  extractDominantColors,
  extractPaletteFromPixels,
  extractionReport,
  pixelsFromRgba,
  type Rgb,
} from './extract';

// Synthetic logo: white page, navy wordmark, crimson mark, gold rule.
const NAVY = '#1F2A5A';
const CRIMSON = '#C03028';
const GOLD = '#E0A92E';

function logoPixels(): Rgb[] {
  const px: Rgb[] = [];
  const push = (hex: string, n: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    for (let i = 0; i < n; i += 1) px.push({ r, g, b });
  };
  push('#FFFFFF', 700);
  push(NAVY, 150);
  push(CRIMSON, 100);
  push(GOLD, 50);
  return px;
}

describe('pixelsFromRgba', () => {
  it('flattens RGBA bytes and skips transparent pixels', () => {
    const px = pixelsFromRgba([255, 0, 0, 255, 0, 255, 0, 0]);
    expect(px).toEqual([{ r: 255, g: 0, b: 0 }]);
  });
});

describe('extractDominantColors', () => {
  it('returns logo colors most-frequent-first', () => {
    const colors = extractDominantColors(logoPixels(), 4);
    expect(colors[0]).toBe('#FFFFFF');
    expect(colors).toContain(NAVY);
    expect(colors).toContain(CRIMSON);
    expect(colors).toContain(GOLD);
  });

  it('rejects empty input', () => {
    expect(() => extractDominantColors([])).toThrow();
  });
});

describe('assignRoles', () => {
  it('assigns the core four roles from a logo (F-PAL-05)', () => {
    const roles = assignRoles(['#FFFFFF', NAVY, CRIMSON, GOLD]);
    expect(roles.scheme).toBe('light');
    expect(roles.canvas).toBe('#FFFFFF');
    expect(roles.ink).toBe(NAVY);
    expect([roles.primary, roles.accent].sort()).toEqual([CRIMSON, GOLD].sort());
  });

  it('detects a dark background scheme', () => {
    const roles = assignRoles(['#141414', '#E8E8E8', '#E8837A', '#6CC49A']);
    expect(roles.scheme).toBe('dark');
    expect(roles.ink).toBe('#E8E8E8');
  });

  it('repairs contrast so every WCAG pair passes', () => {
    // Mid-gray on mid-gray would fail without repair.
    const roles = assignRoles(['#888888', '#777777', '#999999', '#AAAAAA']);
    expect(extractionReport(roles).every((r) => r.ok)).toBe(true);
  });
});

describe('extractPaletteFromPixels', () => {
  it('goes from logo pixels to contrast-safe roles', () => {
    const roles = extractPaletteFromPixels(logoPixels());
    expect(roles.canvas).toBe('#FFFFFF');
    expect(roles.ink).toBe(NAVY);
    expect(extractionReport(roles).every((r) => r.ok)).toBe(true);
  });
});
