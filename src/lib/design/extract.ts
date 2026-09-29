// Logo/material color extraction (T6.9, F-PAL-05): representative colors from raw
// pixels plus automatic assignment to the four core roles. Local computation only
// (no image codecs, no network): callers pass decoded RGB pixels in.
import { formatHex, oklch, parse, wcagLuminance } from 'culori';
import { contrast } from './color';
import { contrastReport, deriveRoles, type Colors } from './roles';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export type PaletteScheme = 'light' | 'dark';

/** Flatten RGBA bytes (canvas `ImageData.data`, PNG decoders) into RGB pixels. */
export function pixelsFromRgba(data: ArrayLike<number>): Rgb[] {
  const out: Rgb[] = [];
  for (let i = 0; i + 3 < data.length + 1; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 255;
    if (a < 128) continue;
    out.push({ r, g, b });
  }
  return out;
}

interface Bin {
  count: number;
  r: number;
  g: number;
  b: number;
}

const toHexByte = (v: number) => Math.round(Math.max(0, Math.min(255, v)));

function centroidHex(bin: Bin): string {
  const r = toHexByte(bin.r / bin.count);
  const g = toHexByte(bin.g / bin.count);
  const b = toHexByte(bin.b / bin.count);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

function rgbDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * Most-frequent quantized colors, most frequent first. 4-bit bins keep logos and
 * flat illustrations stable; near-duplicate bins collapse so gradients do not
 * crowd out real brand colors.
 */
export function extractDominantColors(pixels: Rgb[], count = 6): string[] {
  if (pixels.length === 0) throw new Error('no pixels to extract from');
  const bins = new Map<number, Bin>();
  for (const p of pixels) {
    const key = (p.r >> 4) + (p.g >> 4) * 16 + (p.b >> 4) * 256;
    const bin = bins.get(key);
    if (bin) {
      bin.count += 1;
      bin.r += p.r;
      bin.g += p.g;
      bin.b += p.b;
    } else {
      bins.set(key, { count: 1, r: p.r, g: p.g, b: p.b });
    }
  }
  const ranked = [...bins.values()].sort((a, b) => b.count - a.count);
  const picked: Rgb[] = [];
  for (const bin of ranked) {
    if (picked.length >= Math.max(1, count)) break;
    const c = { r: bin.r / bin.count, g: bin.g / bin.count, b: bin.b / bin.count };
    if (picked.every((p) => rgbDistance(p, c) >= 24)) picked.push(c);
  }
  return picked.map((c) => centroidHex({ count: 1, r: c.r, g: c.g, b: c.b }));
}

const luminance = (hex: string): number => wcagLuminance(parse(hex) ?? '#000000');

function chroma(hex: string): number {
  const c = oklch(parse(hex) ?? '#000000');
  return c?.c ?? 0;
}

function hue(hex: string): number | null {
  const c = oklch(parse(hex) ?? '#000000');
  if (!c || (c.c ?? 0) < 0.02) return null;
  return c.h ?? null;
}

function withLightness(hex: string, l: number): string {
  const c = oklch(parse(hex) ?? '#000000');
  if (!c) return hex;
  return (formatHex({ mode: 'oklch', l, c: c.c ?? 0, h: c.h }) ?? hex).toUpperCase();
}

/**
 * Move a color's OKLCH lightness (hue/chroma kept) until it reaches `min`
 * contrast against every background, choosing the smallest visible change.
 * Greedy stepping gets stuck at local optima (e.g. white at 3.5:1 when black
 * would pass), so the full lightness range is sampled instead. One of the
 * black/white extremes always passes 4.5:1 against any single background.
 */
function shiftLightnessForContrast(color: string, backgrounds: string[], min: number): string {
  const base = oklch(parse(color) ?? '#000000');
  if (!base) return color;
  const l0 = base.l ?? 0.5;
  let best: string | null = null;
  let bestScore = Infinity;
  for (let i = 0; i <= 100; i += 1) {
    const candidate = withLightness(color, 0.01 + (i / 100) * 0.97);
    if (!backgrounds.every((bg) => contrast(candidate, bg) >= min)) continue;
    const change = Math.abs(i / 100 - l0);
    if (change < bestScore) {
      best = candidate;
      bestScore = change;
    }
  }
  return best ?? color;
}

/** Nudge ink/primary until the WCAG pairs can pass; accent is decorative. */
export function ensureRoleContrast(roles: { canvas: string; ink: string; primary: string; accent: string }): {
  canvas: string;
  ink: string;
  primary: string;
  accent: string;
} {
  const { canvas, accent } = roles;
  let { ink, primary } = roles;
  // The derived `surface` (6% toward ink) moves with ink, so ink is repaired
  // against both canvas and the recomputed surface until the pair holds.
  for (let round = 0; round < 5; round += 1) {
    if (contrast(ink, canvas) < 4.5) ink = shiftLightnessForContrast(ink, [canvas], 4.5);
    const surface = deriveRoles({ canvas, ink, primary, accent }).surface ?? canvas;
    if (contrast(ink, canvas) >= 4.5 && contrast(ink, surface) >= 4.5) break;
    ink = shiftLightnessForContrast(ink, [canvas, surface], 4.5);
  }
  const onCandidates = [ink, canvas, '#FFFFFF', '#000000'];
  if (!onCandidates.some((fg) => contrast(fg, primary) >= 4.5)) {
    primary = shiftLightnessForContrast(primary, ['#FFFFFF'], 4.5);
    if (!onCandidates.some((fg) => contrast(fg, primary) >= 4.5)) {
      primary = shiftLightnessForContrast(primary, ['#000000'], 4.5);
    }
  }
  return { canvas, ink, primary, accent };
}

export interface ExtractedRoles {
  canvas: string;
  ink: string;
  primary: string;
  accent: string;
  scheme: PaletteScheme;
}

/**
 * Assign the four core roles: the most frequent color is the background
 * (canvas, which also decides the scheme), ink is the opposite extreme, and
 * primary/accent are the most saturated remaining colors with distinct hues.
 */
export function assignRoles(colors: string[]): ExtractedRoles {
  if (colors.length === 0) throw new Error('no colors to assign roles from');
  const [first, ...rest] = colors as [string, ...string[]];
  const canvas = first;
  const scheme: PaletteScheme = luminance(canvas) >= 0.4 ? 'light' : 'dark';
  const byLum = [...rest].sort((a, b) => luminance(a) - luminance(b));
  const ink = (scheme === 'light' ? byLum[0] : byLum[byLum.length - 1]) ?? (scheme === 'light' ? '#111111' : '#F5F5F5');
  const remaining = rest.filter((c) => c !== ink);
  const saturated = [...remaining].sort((a, b) => chroma(b) - chroma(a));
  const accents: string[] = [];
  for (const c of saturated) {
    const h = hue(c);
    if (accents.every((p) => hue(p) === null || h === null || Math.abs(h - (hue(p) ?? 0)) >= 12)) {
      accents.push(c);
    }
    if (accents.length >= 2) break;
  }
  while (accents.length < 2) accents.push(accents[0] ?? ink);
  const [primaryRaw, accentRaw] = accents as [string, string];
  const repaired = ensureRoleContrast({ canvas, ink, primary: primaryRaw, accent: accentRaw });
  return { ...repaired, scheme };
}

/** Full pipeline: dominant colors → role assignment with contrast repair. */
export function extractPaletteFromPixels(pixels: Rgb[], count = 6): ExtractedRoles {
  return assignRoles(extractDominantColors(pixels, count));
}

/** Readiness check used by tests and the future compare view. */
export function extractionReport(roles: ExtractedRoles) {
  const colors: Colors = { ...roles };
  return contrastReport(deriveRoles(colors));
}
