// Detecting hard-coded color literals (hex / rgb / hsl / ...) in source text, shared by the ESLint
// rule (TSX string literals) and check_scene's CSS scan. Colors must come from DESIGN.md tokens
// (`var(--color-*)`, `useDesign()`); a deliberate exception is marked with `ds-ignore`.

const HEX = /(?<![\w&#/-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z_-])/gi;
const FUNC = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(([^)]*)\)?/gi;

export interface ColorMatch {
  value: string;
  /** 0-based offset into the scanned text. */
  index: number;
}

/** Color literals in `text`. Functional colors that read a CSS variable (`rgb(var(--x) / 50%)`) are tokens, not literals. */
export function colorLiterals(text: string): ColorMatch[] {
  const out: ColorMatch[] = [];
  for (const m of text.matchAll(HEX)) out.push({ value: m[0], index: m.index });
  for (const m of text.matchAll(FUNC)) {
    if (/var\(/i.test(m[1])) continue;
    out.push({ value: m[0], index: m.index });
  }
  return out.sort((a, b) => a.index - b.index);
}

export const IGNORE_MARKER = 'ds-ignore';

export interface CssColorFinding {
  line: number;
  column: number;
  value: string;
}

/** Blank out CSS comments and `url(...)` while keeping offsets, so their contents are not scanned. */
function maskCss(css: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  return css.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/url\([^)]*\)/gi, blank);
}

/** Hard-coded colors in a CSS file. A `ds-ignore` comment on the same or the previous line exempts a line. */
export function findHardcodedColors(css: string): CssColorFinding[] {
  const lines = css.split(/\r?\n/);
  const ignored = lines.map((l) => l.includes(IGNORE_MARKER));
  const masked = maskCss(css).split(/\r?\n/);
  const out: CssColorFinding[] = [];
  masked.forEach((text, i) => {
    if (ignored[i] || (i > 0 && ignored[i - 1])) return;
    for (const m of colorLiterals(text)) out.push({ line: i + 1, column: m.index + 1, value: m.value });
  });
  return out;
}
