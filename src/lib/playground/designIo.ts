// DESIGN.md import/export (T6.10, F-DSN-07, S).
// Export converts the project's parsed tokens to other tools' formats
// (raw markdown, Tailwind CSS variables, DTCG JSON). Import validates an
// outside DESIGN.md with the same parser the app uses (`src/lib/design`).
import { parseDesign } from '@/lib/design/parse';
import type { Colors } from '@/lib/design/roles';

export interface DesignImportResult {
  ok: boolean;
  /** Blocking problems. Everything else in `warnings` is advisory. */
  error: string | null;
  warnings: string[];
  colorCount: number;
}

/** An outside DESIGN.md is importable when it has token front matter with at least one valid color. */
export function validateDesignImport(text: string): DesignImportResult {
  const { colors, issues } = parseDesign(text);
  const warnings = [...issues];
  const roles = Object.entries(colors);
  if (issues.some((i) => i.startsWith('no YAML front matter'))) {
    return { ok: false, error: 'missing-token-front-matter', warnings, colorCount: 0 };
  }
  if (roles.length === 0) {
    return { ok: false, error: 'no-colors', warnings, colorCount: 0 };
  }
  const invalid = issues.find((i) => i.includes('invalid color'));
  if (invalid) {
    return { ok: false, error: invalid, warnings, colorCount: roles.length };
  }
  return { ok: true, error: null, warnings, colorCount: roles.length };
}

/** `:root` CSS variables in role order (`--color-<role>`). */
export function designToTailwindCss(colors: Colors): string {
  const lines = Object.entries(colors)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([role, value]) => `  --color-${role}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}

/** DTCG draft shape (`color.<role>.$value`), pretty-printed. */
export function designToDtcgJson(colors: Colors): string {
  const color: Record<string, { $value: string; $type: string }> = {};
  for (const [role, value] of Object.entries(colors).sort(([a], [b]) => a.localeCompare(b))) {
    color[role] = { $value: value, $type: 'color' };
  }
  return `${JSON.stringify({ color }, null, 2)}\n`;
}

/** Browser download (Blob + anchor). Test seam: jsdom covers Blob/anchor. */
export function downloadTextFile(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
