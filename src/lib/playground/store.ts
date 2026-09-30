// Pure playground helpers (T6.8): search/filter and entry picking.
// No Tauri calls here, so every branch is unit-testable.
import { isPlaygroundKind, type PlaygroundItem, type PlaygroundKind } from './types';

export type PlayablePlayer = 'video' | 'pdf' | 'slideshow' | 'image' | 'web' | 'none';

export interface PlayableSource {
  player: PlayablePlayer;
  /** File names (not paths) backing the player, in play order. */
  entries: string[];
}

const VIDEO_EXT = new Set(['mp4', 'webm', 'mov']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const PDF_EXT = new Set(['pdf']);
const WEB_EXT = new Set(['html', 'htm']);

function extOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot < 0 ? '' : base.slice(dot + 1).toLowerCase();
}

function baseOf(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/**
 * Pick what the player can actually render from a flat export file list.
 * Precedence: video > pdf > image set (2+ = slideshow) > html > none.
 * (Slides PPTX and web zips are artifacts, not playable: they fall to `none`
 * and the UI offers folder-open/download instead.)
 */
export function resolvePlayable(files: string[]): PlayableSource {
  const names = files.map(baseOf).filter((n) => n.length > 0);
  const videos = names.filter((n) => VIDEO_EXT.has(extOf(n))).sort();
  if (videos.length > 0) return { player: 'video', entries: [videos[0]] };
  const pdfs = names.filter((n) => PDF_EXT.has(extOf(n))).sort();
  if (pdfs.length > 0) return { player: 'pdf', entries: [pdfs[0]] };
  const images = names.filter((n) => IMAGE_EXT.has(extOf(n))).sort();
  if (images.length > 1) return { player: 'slideshow', entries: images };
  if (images.length === 1) return { player: 'image', entries: images };
  const webs = names.filter((n) => WEB_EXT.has(extOf(n))).sort();
  // Prefer an entry called index.* when several html files exist.
  webs.sort((a, b) => Number(/^index\./i.test(b)) - Number(/^index\./i.test(a)));
  if (webs.length > 0) return { player: 'web', entries: [webs[0]] };
  return { player: 'none', entries: [] };
}

export interface PlaygroundFilter {
  kind?: PlaygroundKind | 'all';
  tag?: string | null;
}

/** Title + tag substring match (case-insensitive), plus kind/tag filters. */
export function searchItems(items: PlaygroundItem[], query: string, filter: PlaygroundFilter = {}): PlaygroundItem[] {
  const q = query.trim().toLowerCase();
  const tag = (filter.tag ?? '').trim().toLowerCase();
  return items.filter((item) => {
    if (filter.kind && filter.kind !== 'all' && item.kind !== filter.kind) return false;
    if (tag && !item.tags.some((t) => t.toLowerCase() === tag)) return false;
    if (!q) return true;
    if (item.title.toLowerCase().includes(q)) return true;
    return item.tags.some((t) => t.toLowerCase().includes(q));
  });
}

/** All tags in use, most frequent first (for the tag filter). */
export function collectTags(items: PlaygroundItem[]): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const item of items) {
    for (const tag of item.tags) {
      const key = tag.toLowerCase();
      const slot = counts.get(key);
      if (slot) slot.n++;
      else counts.set(key, { label: tag, n: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).map((s) => s.label);
}

/** Basin name for the "add from export" title default. */
export function titleFromDir(dirPath: string): string {
  return baseOf(dirPath);
}

export function kindFromExportFormat(format: string): PlaygroundKind | null {
  return isPlaygroundKind(format) ? format : null;
}
