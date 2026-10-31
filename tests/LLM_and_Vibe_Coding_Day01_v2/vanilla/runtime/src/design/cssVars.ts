// DESIGN.md tokens -> CSS custom properties. Names match `design.md export --format css-vars`.
import type { Design } from './types';

export function cssVars(design: Design): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(design.colors)) vars[`--color-${k}`] = v;
  for (const [k, v] of Object.entries(design.spacing)) vars[`--spacing-${k}`] = String(v);
  for (const [k, v] of Object.entries(design.rounded)) vars[`--rounded-${k}`] = v;
  return vars;
}

/** Set `next`, and remove variables from `prev` that no longer exist (e.g. a cleared override). */
export function applyCssVars(style: Pick<CSSStyleDeclaration, 'setProperty' | 'removeProperty'>, next: Record<string, string>, prev: Record<string, string> = {}): void {
  for (const name of Object.keys(prev)) if (!(name in next)) style.removeProperty(name);
  for (const [name, value] of Object.entries(next)) if (prev[name] !== value) style.setProperty(name, value);
}
