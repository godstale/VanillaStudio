// Map a HyperFrames palette to Vanilla roles.
// HyperFrames role names are not functional: in light palettes `primary` is the background and
// `secondary` the ink, in dark ones it is the other way round, and `tertiary` is a mid-tone
// supporting color, not a surface. So canvas/ink are chosen by luminance and the scheme.
import { parse, wcagLuminance } from 'culori';
import type { Colors } from './roles';

export interface HfPalette {
  id: string;
  name: string;
  tokens: { primary: string; secondary: string; tertiary: string; accent: string };
  extras: Record<string, string>;
}

const lum = (c: string) => wcagLuminance(parse(c)!);

export function hfToVanilla(p: HfPalette, scheme: 'light' | 'dark' = /dark|midnight/.test(p.id) ? 'dark' : 'light'): Colors {
  const [light, dark] = lum(p.tokens.primary) >= lum(p.tokens.secondary) ? [p.tokens.primary, p.tokens.secondary] : [p.tokens.secondary, p.tokens.primary];
  const extras = Object.values(p.extras);
  return {
    canvas: scheme === 'light' ? light : dark,
    ink: scheme === 'light' ? dark : light,
    primary: p.tokens.accent,
    secondary: p.tokens.tertiary,
    accent: extras[0] ?? p.tokens.tertiary,
    // surface, ink-muted, line, on-primary are derived.
  };
}
