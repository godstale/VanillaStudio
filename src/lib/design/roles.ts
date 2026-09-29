// Vanilla color roles: functional names, because `primary` means different things across ecosystems
// (Google DESIGN.md example: ink; HyperFrames: background; Material: brand).
import { contrast, mix } from './color';

export const CORE_ROLES = ['canvas', 'ink', 'primary', 'accent'] as const;
export const DERIVED_ROLES = ['surface', 'ink-muted', 'line', 'secondary', 'on-primary'] as const;
export type Role = (typeof CORE_ROLES)[number] | (typeof DERIVED_ROLES)[number];
export type Colors = Record<string, string>;

/** Fill derived roles the palette does not define. Existing values always win. */
export function deriveRoles(colors: Colors): Colors {
  const c = { ...colors };
  const missing = CORE_ROLES.filter((r) => !c[r]);
  if (missing.length) throw new Error(`missing core roles: ${missing.join(', ')}`);
  c.surface ??= mix(c.canvas, c.ink, 0.06);
  // Pull muted ink toward the canvas only as far as it stays readable (≥ 3:1).
  if (!c['ink-muted']) {
    let t = 0.4;
    while (t > 0 && contrast(mix(c.ink, c.canvas, t), c.canvas) < 3) t -= 0.05;
    c['ink-muted'] = mix(c.ink, c.canvas, Math.max(0, t));
  }
  c.line ??= mix(c.ink, c.canvas, 0.8);
  c.secondary ??= mix(c.primary, c.ink, 0.35);
  if (!c['on-primary']) {
    const candidates = [c.ink, c.canvas, '#FFFFFF', '#000000'];
    c['on-primary'] = candidates.reduce((best, x) => (contrast(x, c.primary) > contrast(best, c.primary) ? x : best));
  }
  return c;
}

/** Text/background pairs checked against WCAG (min ratio). */
export const CONTRAST_PAIRS: [fg: string, bg: string, min: number][] = [
  ['ink', 'canvas', 4.5],
  ['ink', 'surface', 4.5],
  ['ink-muted', 'canvas', 3],
  ['on-primary', 'primary', 4.5],
];

export function contrastReport(colors: Colors) {
  return CONTRAST_PAIRS.map(([fg, bg, min]) => {
    const ratio = contrast(colors[fg], colors[bg]);
    return { pair: `${fg}/${bg}`, ratio, min, ok: ratio >= min };
  });
}
