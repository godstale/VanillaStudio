// User palette save/import/export (T6.10, F-PAL-08, S).
// Storage reuses D2's project-local API (`listProjectPalettes` /
// `saveProjectPalette`, `src/lib/design/palettes.ts`); this module adds the
// JSON file exchange plus "save the current DESIGN.md colors as a palette".
import { parseDesign } from '@/lib/design/parse';
import {
  parsePaletteFile,
  type PaletteFile,
  type PaletteParseResult,
  type PaletteScheme,
} from '@/lib/design/palettes';
import type { Colors } from '@/lib/design/roles';

/** Pretty `palette.json` text for download. */
export function exportPaletteFile(palette: PaletteFile): string {
  return `${JSON.stringify(palette, null, 2)}\n`;
}

/** Validate pasted/dropped `palette.json` text. */
export function importPaletteText(text: string): PaletteParseResult {
  return parsePaletteFile(text);
}

/** `my-palette` style ids from a display name. */
export function slugifyPaletteName(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

export interface PaletteFromDesignInput {
  id: string;
  name: string;
  scheme: PaletteScheme;
  tags?: string[];
}

/** Build a `user` palette from parsed DESIGN.md colors (validated, throws on bad colors). */
export function paletteFromDesignColors(colors: Colors, input: PaletteFromDesignInput): PaletteFile {
  const parsed = parsePaletteFile({
    version: 1,
    id: input.id,
    name: input.name,
    tags: input.tags ?? [],
    scheme: input.scheme,
    colors,
    source: 'user',
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.palette;
}

/** Read DESIGN.md text and return its resolved colors (throws when color-less). */
export function designTextToColors(text: string): Colors {
  const { colors } = parseDesign(text);
  if (Object.keys(colors).length === 0) throw new Error('no-colors');
  return colors;
}
