// Built-in template registry (T6.4~T6.6, F-TPL-01).
// Bundles the three shipped template skills: manifest + default palette +
// preview SVG (authored with CSS `var(--color-*)` fills so the gallery can
// re-tint it per palette). Manifests and palettes are validated at import;
// a broken template fails fast instead of rendering a broken card.
import {
  BUILT_IN_PALETTES,
  getPalette,
  paletteDesignColors,
  parsePaletteFile,
  type PaletteFile,
} from '@/lib/design/palettes';
import type { OutputType } from '@/lib/types/project';
import { parseTemplateManifest, type TemplateManifest } from './template';
import editorialManifestJson from '../../../resources/templates/editorial-slides/template.json';
import editorialPaletteJson from '../../../resources/templates/editorial-slides/palette.json';
import editorialPreview from '../../../resources/templates/editorial-slides/preview/cover.svg?raw';
import showcaseManifestJson from '../../../resources/templates/product-showcase-video/template.json';
import showcasePaletteJson from '../../../resources/templates/product-showcase-video/palette.json';
import showcasePreview from '../../../resources/templates/product-showcase-video/preview/poster.svg?raw';
import kineticManifestJson from '../../../resources/templates/kinetic-type-web/template.json';
import kineticPaletteJson from '../../../resources/templates/kinetic-type-web/palette.json';
import kineticPreview from '../../../resources/templates/kinetic-type-web/preview/cover.svg?raw';

export interface BuiltInTemplate {
  manifest: TemplateManifest;
  /** Default palette shipped as the template's own `palette.json`. */
  palette: PaletteFile;
  /** Preview SVG source (CSS-var fills, re-tinted per palette). */
  previewSvg: string;
  /** Palette choices offered on the card: own palette + recommended ones. */
  recommended: PaletteFile[];
}

function mustManifest(raw: unknown, path: string): TemplateManifest {
  const r = parseTemplateManifest(JSON.stringify(raw));
  if (!r.ok) throw new Error(`${path}: ${r.error}`);
  return r.manifest;
}

function mustPalette(raw: unknown, path: string): PaletteFile {
  const r = parsePaletteFile(raw);
  if (!r.ok) throw new Error(`${path}: ${r.error}`);
  return r.palette;
}

function recommendedFor(manifest: TemplateManifest, own: PaletteFile): PaletteFile[] {
  const out: PaletteFile[] = [own];
  for (const id of manifest.recommendedPalettes) {
    if (id === own.id) continue;
    const found = getPalette(BUILT_IN_PALETTES, id);
    if (found && !out.some((p) => p.id === found.id)) out.push(found);
  }
  return out;
}

function entry(manifestRaw: unknown, paletteRaw: unknown, previewSvg: string, path: string): BuiltInTemplate {
  const manifest = mustManifest(manifestRaw, `${path}/template.json`);
  const palette = mustPalette(paletteRaw, `${path}/palette.json`);
  if (manifest.defaultPalette !== palette.id) {
    throw new Error(`${path}: template.json defaultPalette "${manifest.defaultPalette}" != palette.json id "${palette.id}"`);
  }
  return { manifest, palette, previewSvg, recommended: recommendedFor(manifest, palette) };
}

// Explicit index: adding a folder under `resources/templates/` means adding one line here.
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  entry(editorialManifestJson, editorialPaletteJson, editorialPreview, 'editorial-slides'),
  entry(showcaseManifestJson, showcasePaletteJson, showcasePreview, 'product-showcase-video'),
  entry(kineticManifestJson, kineticPaletteJson, kineticPreview, 'kinetic-type-web'),
];

export function getTemplate(templates: BuiltInTemplate[], id: string): BuiltInTemplate | null {
  return templates.find((t) => t.manifest.id === id) ?? null;
}

/** Sorted union of all tags (for the tag filter). */
export function templateTags(templates: BuiltInTemplate[]): string[] {
  return [...new Set(templates.flatMap((t) => t.manifest.tags))].sort((a, b) => a.localeCompare(b));
}

export interface TemplateFilter {
  outputType?: OutputType | 'all';
  tag?: string | 'all';
}

/** Case-insensitive match on id, name and description, plus type/tag filters. */
export function searchTemplates(
  templates: BuiltInTemplate[],
  query: string,
  filter: TemplateFilter = {},
): BuiltInTemplate[] {
  const q = query.trim().toLowerCase();
  return templates.filter((t) => {
    if (filter.outputType && filter.outputType !== 'all' && !t.manifest.outputTypes.includes(filter.outputType)) {
      return false;
    }
    if (filter.tag && filter.tag !== 'all' && !t.manifest.tags.includes(filter.tag)) return false;
    if (!q) return true;
    const m = t.manifest;
    return (
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });
}

/** Full role set for the card preview: derived roles filled from the palette. */
export function templatePreviewColors(palette: PaletteFile): Record<string, string> {
  return paletteDesignColors(palette);
}
