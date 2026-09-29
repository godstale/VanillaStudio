// Palette apply flow for the review DesignPanel (T4.15, F-PAL-02/F-PAL-04).
// Selecting a palette only previews it through Bridge `setDesign` (no file change).
// Applying rewrites the DESIGN.md `colors` block (prose hex updated, other bytes
// preserved) plus the vanilla.json palette ref, then records a checkpoint.
import { invoke } from '@tauri-apps/api/core';
import { projectPath } from '@/lib/pipeline/briefFiles';
import { DESIGN_PATH, readOptionalFile } from '@/lib/pipeline/planFiles';
import { parseDesign } from '@/lib/design/parse';
import { replaceColors } from '@/lib/design/rewrite';
import { deriveRoles, type Colors } from '@/lib/design/roles';
import { checkpointCommit } from '@/lib/project/checkpoint';
import { parseProjectManifest } from '@/lib/project/schema';

export type PaletteSource = 'builtin' | 'user' | 'extracted' | 'generated';

export interface PaletteOption {
  id: string;
  name: string;
  source: PaletteSource;
  colors: Colors;
}

export interface ApplyPaletteResult {
  bodyReplacements: number;
  manifestUpdated: boolean;
  checkpointId: string;
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** Full role set for preview: derived roles filled, invalid input falls back to raw. */
export function resolvePaletteColors(colors: Colors): Colors {
  try {
    return deriveRoles(colors);
  } catch {
    return { ...colors };
  }
}

export function loadDesignText(root: string): Promise<string | null> {
  return readOptionalFile(root, DESIGN_PATH);
}

export function currentDesignColors(text: string): Colors {
  return parseDesign(text).colors;
}

/** Best-effort vanilla.json palette ref update. Skipped when the manifest is absent,
// invalid, or the palette id is not a manifest slug. Never throws. */
export async function updateManifestPalette(root: string, ref: { id: string; source: PaletteSource }): Promise<boolean> {
  if (!SLUG.test(ref.id)) return false;
  const text = await readOptionalFile(root, 'vanilla.json');
  if (text === null) return false;
  const parsed = parseProjectManifest(text);
  if (!parsed.ok) return false;
  const next = { ...parsed.manifest, palette: { id: ref.id, source: ref.source } };
  await invoke('write_text_file', {
    path: projectPath(root, 'vanilla.json'),
    contents: `${JSON.stringify(next, null, 2)}\n`,
    workspaceRoot: root,
  });
  return true;
}

export async function applyPalette(root: string, palette: PaletteOption): Promise<ApplyPaletteResult> {
  const text = await loadDesignText(root);
  if (text === null) throw new Error('DESIGN.md not found');
  const { text: next, bodyReplacements } = replaceColors(text, palette.colors, { updateProse: true });
  await invoke('write_text_file', {
    path: projectPath(root, DESIGN_PATH),
    contents: next,
    workspaceRoot: root,
  });
  const manifestUpdated = await updateManifestPalette(root, { id: palette.id, source: palette.source });
  const commit = await checkpointCommit(root, `design: apply palette ${palette.id}`);
  return { bodyReplacements, manifestUpdated, checkpointId: commit.id };
}
