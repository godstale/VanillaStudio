// Harmony generation and palette comparison (T6.9, F-PAL-06/07): one or two seed
// colors → OKLCH hue-rotation harmonies → contrast-safe core roles, plus the
// per-palette snapshot rows a side-by-side compare view renders.
import { formatHex, oklch, parse } from 'culori';
import { contrastReport, deriveRoles, type Colors } from './roles';
import { ensureRoleContrast, type PaletteScheme } from './extract';

export const HARMONY_KINDS = ['complementary', 'analogous', 'triadic', 'monochromatic'] as const;
export type HarmonyKind = (typeof HARMONY_KINDS)[number];

const HUE_OFFSETS: Record<HarmonyKind, number[]> = {
  complementary: [180],
  analogous: [-30, 30],
  triadic: [120, 240],
  monochromatic: [0],
};

interface OklchColor {
  l: number;
  c: number;
  h: number;
}

function toOklch(hex: string): OklchColor {
  const c = oklch(parse(hex) ?? '#000000');
  // Achromatic seeds have no hue: fall back to a brand-blue hue so rotations
  // still produce distinct variants instead of identical grays.
  return { l: c?.l ?? 0.5, c: c?.c ?? 0, h: c?.h ?? 250 };
}

function fromOklch(c: OklchColor): string {
  return (formatHex({ mode: 'oklch', l: c.l, c: c.c, h: c.h }) ?? '#000000').toUpperCase();
}

const rot = (h: number, deg: number) => (h + deg + 360) % 360;

/** Hue offsets per harmony kind, in degrees. */
export function harmonyHues(baseHue: number, kind: HarmonyKind): number[] {
  return HUE_OFFSETS[kind].map((d) => rot(baseHue, d));
}

/**
 * Harmony variants for a seed color, seed first. Monochromatic varies lightness
 * at a fixed hue; the rest rotate the hue at the seed's lightness/chroma.
 */
export function generateHarmony(base: string, kind: HarmonyKind): string[] {
  const seed = toOklch(base);
  if (kind === 'monochromatic') {
    const steps = [0, 0.16, -0.16].map((d) => Math.max(0.12, Math.min(0.95, seed.l + d)));
    return [fromOklch(seed), ...steps.slice(1).map((l) => fromOklch({ ...seed, l }))];
  }
  return [fromOklch(seed), ...harmonyHues(seed.h, kind).map((h) => fromOklch({ ...seed, h }))];
}

export interface HarmonyPalette {
  canvas: string;
  ink: string;
  primary: string;
  accent: string;
  scheme: PaletteScheme;
  kind: HarmonyKind;
}

/**
 * Core roles from a seed color: a quiet neutral canvas/ink pair in the seed's
 * hue family plus the seed as primary and the first harmony variant as accent,
 * repaired until the WCAG pairs pass.
 */
export function paletteFromHarmony(base: string, kind: HarmonyKind, scheme: PaletteScheme): HarmonyPalette {
  const seed = toOklch(base);
  const neutral = { c: Math.min(seed.c, 0.02), h: seed.h };
  const canvas =
    scheme === 'light' ? fromOklch({ ...neutral, l: 0.96 }) : fromOklch({ ...neutral, l: 0.18 });
  const ink = scheme === 'light' ? fromOklch({ ...neutral, l: 0.25 }) : fromOklch({ ...neutral, l: 0.92 });
  const variants = generateHarmony(base, kind);
  const accent = variants[1] ?? variants[0] ?? base;
  const repaired = ensureRoleContrast({ canvas, ink, primary: variants[0] ?? base, accent });
  return { ...repaired, scheme, kind };
}

export interface CompareSnapshot {
  id: string;
  name: string;
  /** Derived role set for the scene snapshot (same scene, same timestamp). */
  colors: Colors;
  report: ReturnType<typeof contrastReport>;
  ok: boolean;
}

/**
 * F-PAL-07 rows: resolve every palette to its full derived role set so the same
 * scene can be snapshotted under each palette and compared side by side.
 */
export function buildCompareSnapshots(palettes: Array<{ id: string; name: string; colors: Colors }>): CompareSnapshot[] {
  return palettes.map((p) => {
    const colors = deriveRoles(p.colors);
    const report = contrastReport(colors);
    return { id: p.id, name: p.name, colors, report, ok: report.every((r) => r.ok) };
  });
}
