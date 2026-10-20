// Palette library (T4.16, F-PAL-01): `palette.json` schema, built-in loading,
// search/filter, and project-local user palettes (`<project>/palettes/*.json`).
// Built-ins live in `resources/palettes/` and are bundled via explicit JSON imports
// (no glob: the same files are the source of truth for the T6.3 24-palette set).
import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { projectPath } from '@/lib/workspace/files';
import { isColor } from './color';
import { CORE_ROLES, deriveRoles, type Colors } from './roles';
import blushLedger from '../../../resources/palettes/blush-ledger.json';
import copperLoft from '../../../resources/palettes/copper-loft.json';
import coralMargin from '../../../resources/palettes/coral-margin.json';
import deepHarbor from '../../../resources/palettes/deep-harbor.json';
import duneNight from '../../../resources/palettes/dune-night.json';
import emberAsh from '../../../resources/palettes/ember-ash.json';
import emberNight from '../../../resources/palettes/ember-night.json';
import forestMist from '../../../resources/palettes/forest-mist.json';
import honeyArchive from '../../../resources/palettes/honey-archive.json';
import inkWashPaper from '../../../resources/palettes/ink-wash-paper.json';
import lavenderShelf from '../../../resources/palettes/lavender-shelf.json';
import midnightRampart from '../../../resources/palettes/midnight-rampart.json';
import mintWorkbench from '../../../resources/palettes/mint-workbench.json';
import mossLantern from '../../../resources/palettes/moss-lantern.json';
import paperDawn from '../../../resources/palettes/paper-dawn.json';
import pineSignal from '../../../resources/palettes/pine-signal.json';
import plumNight from '../../../resources/palettes/plum-night.json';
import plumPress from '../../../resources/palettes/plum-press.json';
import porcelainHarbor from '../../../resources/palettes/porcelain-harbor.json';
import reefDepth from '../../../resources/palettes/reef-depth.json';
import sageField from '../../../resources/palettes/sage-field.json';
import slateGrove from '../../../resources/palettes/slate-grove.json';
import tideGlass from '../../../resources/palettes/tide-glass.json';
import violetBunker from '../../../resources/palettes/violet-bunker.json';
import opusBotanicalParchment from '../../../resources/palettes/opus-botanical-parchment.json';
import opusCobaltCyan from '../../../resources/palettes/opus-cobalt-cyan.json';
import opusCyberMagenta from '../../../resources/palettes/opus-cyber-magenta.json';
import opusKeynoteLime from '../../../resources/palettes/opus-keynote-lime.json';
import opusMagneticMonument from '../../../resources/palettes/opus-magnetic-monument.json';
import opusOrbitalCoral from '../../../resources/palettes/opus-orbital-coral.json';
import opusSpotifyEditorial from '../../../resources/palettes/opus-spotify-editorial.json';
import opusStudioMint from '../../../resources/palettes/opus-studio-mint.json';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'kebab-case id');

// Product-Spec §8.2 `palette.json`. Unknown keys are allowed so newer files still load.
export const PALETTE_VERSION = 1;

export const paletteFileSchema = z
  .object({
    version: z.literal(PALETTE_VERSION),
    id: slug,
    name: z.string().trim().min(1).max(80),
    tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
    scheme: z.enum(['light', 'dark']),
    colors: z.record(z.string(), z.string()),
    source: z.enum(['builtin', 'user', 'extracted', 'generated']),
    license: z.string().max(40).optional(),
    previewUrl: z.string().url().optional(),
    actionUrl: z.string().url().optional(),
  })
  .passthrough()
  .superRefine((p, ctx) => {
    for (const role of CORE_ROLES) {
      if (!p.colors[role]) {
        ctx.addIssue({ code: 'custom', path: ['colors', role], message: 'missing core role' });
      }
    }
    for (const [role, value] of Object.entries(p.colors)) {
      if (!isColor(value)) ctx.addIssue({ code: 'custom', path: ['colors', role], message: `invalid color ${value}` });
    }
  });

export type PaletteFile = z.infer<typeof paletteFileSchema>;
export type PaletteScheme = PaletteFile['scheme'];

export type PaletteParseResult = { ok: true; palette: PaletteFile } | { ok: false; error: string };

export function parsePaletteFile(raw: unknown): PaletteParseResult {
  let json: unknown = raw;
  if (typeof raw === 'string') {
    try {
      json = JSON.parse(raw) as unknown;
    } catch (e) {
      return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  const r = paletteFileSchema.safeParse(json);
  if (!r.success) {
    return { ok: false, error: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ') };
  }
  return { ok: true, palette: r.data };
}

/** Full role set for preview/apply: derived roles filled, raw kept when core roles miss. */
export function paletteDesignColors(palette: PaletteFile): Colors {
  try {
    return deriveRoles(palette.colors);
  } catch {
    return { ...palette.colors };
  }
}

function mustParse(raw: unknown, path: string): PaletteFile {
  const r = parsePaletteFile(raw);
  if (!r.ok) throw new Error(`${path}: ${r.error}`);
  return r.palette;
}

// Explicit index: adding a file to `resources/palettes/` means adding one line here.
export const BUILT_IN_PALETTES: PaletteFile[] = [
  mustParse(blushLedger, 'blush-ledger.json'),
  mustParse(copperLoft, 'copper-loft.json'),
  mustParse(coralMargin, 'coral-margin.json'),
  mustParse(deepHarbor, 'deep-harbor.json'),
  mustParse(duneNight, 'dune-night.json'),
  mustParse(emberAsh, 'ember-ash.json'),
  mustParse(emberNight, 'ember-night.json'),
  mustParse(forestMist, 'forest-mist.json'),
  mustParse(honeyArchive, 'honey-archive.json'),
  mustParse(inkWashPaper, 'ink-wash-paper.json'),
  mustParse(lavenderShelf, 'lavender-shelf.json'),
  mustParse(midnightRampart, 'midnight-rampart.json'),
  mustParse(mintWorkbench, 'mint-workbench.json'),
  mustParse(mossLantern, 'moss-lantern.json'),
  mustParse(opusBotanicalParchment, 'opus-botanical-parchment.json'),
  mustParse(opusCobaltCyan, 'opus-cobalt-cyan.json'),
  mustParse(opusCyberMagenta, 'opus-cyber-magenta.json'),
  mustParse(opusKeynoteLime, 'opus-keynote-lime.json'),
  mustParse(opusMagneticMonument, 'opus-magnetic-monument.json'),
  mustParse(opusOrbitalCoral, 'opus-orbital-coral.json'),
  mustParse(opusSpotifyEditorial, 'opus-spotify-editorial.json'),
  mustParse(opusStudioMint, 'opus-studio-mint.json'),
  mustParse(paperDawn, 'paper-dawn.json'),
  mustParse(pineSignal, 'pine-signal.json'),
  mustParse(plumNight, 'plum-night.json'),
  mustParse(plumPress, 'plum-press.json'),
  mustParse(porcelainHarbor, 'porcelain-harbor.json'),
  mustParse(reefDepth, 'reef-depth.json'),
  mustParse(sageField, 'sage-field.json'),
  mustParse(slateGrove, 'slate-grove.json'),
  mustParse(tideGlass, 'tide-glass.json'),
  mustParse(violetBunker, 'violet-bunker.json'),
].sort((a, b) => a.name.localeCompare(b.name));

export function getPalette(palettes: PaletteFile[], id: string): PaletteFile | null {
  return palettes.find((p) => p.id === id) ?? null;
}

export interface PaletteFilter {
  scheme?: PaletteScheme | 'all';
  tags?: string[];
}

/** Case-insensitive match on id, name and tags, plus scheme/tag filters. */
export function searchPalettes(palettes: PaletteFile[], query: string, filter: PaletteFilter = {}): PaletteFile[] {
  const q = query.trim().toLowerCase();
  const tags = (filter.tags ?? []).map((t) => t.toLowerCase());
  return palettes.filter((p) => {
    if (filter.scheme && filter.scheme !== 'all' && p.scheme !== filter.scheme) return false;
    const paletteTags = p.tags.map((t) => t.toLowerCase());
    if (!tags.every((t) => paletteTags.includes(t))) return false;
    if (!q) return true;
    return p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || paletteTags.some((t) => t.includes(q));
  });
}

export const PROJECT_PALETTES_DIR = 'palettes';

interface DirEntryItem {
  name: string;
  is_dir: boolean;
}

/** Project-local user palettes. Missing folder or broken files yield [] (never throws). */
export async function listProjectPalettes(root: string): Promise<PaletteFile[]> {
  let entries: DirEntryItem[];
  try {
    entries = await invoke<DirEntryItem[]>('list_dir', {
      path: projectPath(root, PROJECT_PALETTES_DIR),
      workspaceRoot: root,
    });
  } catch {
    return [];
  }
  const out: PaletteFile[] = [];
  for (const e of entries) {
    if (e.is_dir || !e.name.endsWith('.json')) continue;
    try {
      const text = await invoke<string>('read_text_file', {
        path: projectPath(root, `${PROJECT_PALETTES_DIR}/${e.name}`),
        workspaceRoot: root,
      });
      const r = parsePaletteFile(text);
      if (r.ok) out.push(r.palette);
    } catch {
      // A single broken file must not hide the rest of the library.
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Save an editor result as a project-local user palette (overwrites the same id). */
export async function saveProjectPalette(root: string, palette: PaletteFile): Promise<void> {
  const parsed = parsePaletteFile({ ...palette, source: 'user' });
  if (!parsed.ok) throw new Error(parsed.error);
  await invoke('write_text_file', {
    path: projectPath(root, `${PROJECT_PALETTES_DIR}/${parsed.palette.id}.json`),
    contents: `${JSON.stringify(parsed.palette, null, 2)}\n`,
    workspaceRoot: root,
  });
}
