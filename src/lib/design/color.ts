import { formatHex, interpolate, parse, wcagContrast } from 'culori';

export function isColor(value: string): boolean {
  return parse(value) !== undefined;
}

export function toHex(value: string): string {
  const c = parse(value);
  if (!c) throw new Error(`invalid color: ${value}`);
  return formatHex(c)!.toUpperCase();
}

/** Mix in OKLCH so derived shades keep perceived hue. t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  return formatHex(interpolate([a, b], 'oklch')(t))!.toUpperCase();
}

export function contrast(a: string, b: string): number {
  return Math.round(wcagContrast(a, b) * 100) / 100;
}
