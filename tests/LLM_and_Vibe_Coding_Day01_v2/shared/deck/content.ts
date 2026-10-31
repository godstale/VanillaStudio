// Typed access to storyboard/data (the single source of copy). Scene code never hard-codes copy.
import contentJson from '../../storyboard/data/content.json';
import itemsJson from '../../storyboard/data/items.json';
import sceneIds from './scene-ids.json';

/** Text with `**amber**` highlights and `\n` line breaks. */
export type Rich = string;

export type Tone = 'primary' | 'accent' | 'muted' | 'danger';

export interface Figure {
  src: string;
  caption?: string;
  /** White-background diagrams sit on a light paper frame. */
  paper?: boolean;
}

export interface Item {
  no?: string;
  date?: string;
  title?: Rich;
  text?: Rich;
  value?: number | string;
  values?: number[];
  unit?: string;
  label?: Rich;
  display?: string;
  tone?: Tone;
  /** Timeline: shown beside the list while this is the latest revealed item that carries figures. */
  figures?: Figure[];
}

export interface Side {
  tag?: string;
  title: string;
  tone?: Tone;
  bullets?: Rich[];
  logo?: string;
  logoPaper?: boolean;
  diagram?: string;
  /** Large board picture shown above the bullets (compare screens that set two boards side by side). */
  figure?: Figure;
}

export type Layout = 'cover' | 'divider' | 'statement' | 'split' | 'cards' | 'compare' | 'timeline' | 'stats' | 'bars' | 'figure' | 'quote' | 'hero' | 'photo' | 'table';

export interface Screen {
  id: string;
  layout: Layout;
  title?: string;
  sub?: string;
  /** Era marker override: `1958` or a range `2006-2011`. */
  year?: string;
  /** Items (or diagram rows) reveal one per click. */
  build?: boolean;
  kicker?: Rich;
  heading?: Rich;
  lead?: Rich;
  text?: Rich;
  value?: string;
  classic?: string;
  quote?: string;
  source?: string;
  note?: Rich;
  foot?: string;
  answer?: string;
  bullets?: Rich[];
  lines?: Rich[];
  items?: Item[];
  cols?: number | string[];
  rows?: string[][];
  numbered?: boolean;
  flow?: boolean;
  left?: Side;
  right?: Side;
  link?: string;
  figure?: Figure;
  figures?: Figure[];
  diagram?: string;
  badge?: string;
  unit?: string;
  max?: number;
  scale?: 'linear' | 'log';
  dims?: string[];
  tokens?: string[];
  heads?: { label: string; weights: number[] }[];
}

export interface DeckScene {
  key: string;
  title: string;
  chapter: string;
  year?: string;
  screens: Screen[];
}

export interface Chapter {
  id: string;
  no: string;
  label: string;
}

export interface BumperItem {
  /** Chapter id the bumper opens (`ch03`); scene-ids.json holds it as `bumper-<key>`. */
  key: string;
  /** The scene it leads into. */
  next: string;
  /** Shape motif from shared/reel/motifs.tsx and the color field behind it. */
  motif: 'ball' | 'morph' | 'cube' | 'halftone' | 'ribbon' | 'toggle' | 'sun' | 'orbit';
  field: 'black' | 'cream' | 'red' | 'blue' | 'yellow';
  /** Mono HUD tag and the italic serif line under the title. */
  tag: string;
  en: string;
}

export interface Bumpers {
  label: string;
  kicker: string;
  hud: string;
  items: BumperItem[];
}

export interface Intro {
  hud: string;
  /** HUD tag of each of the nine shots. */
  shots: string[];
  make: string[];
  title: string[];
  serif: string;
  footer: string[];
}

interface DeckContent {
  deck: { title: string; course: string; day: number; eraFrom: number; eraTo: number };
  bumpers: Bumpers;
  intro: Intro;
  chapters: Chapter[];
  scenes: DeckScene[];
}

export type DeckItem = { id: string; kind: string } & Record<string, unknown>;

const content = contentJson as unknown as DeckContent;
const items = (itemsJson as unknown as { items: DeckItem[] }).items;

export const deckInfo = content.deck;
export const allScenes: readonly DeckScene[] = content.scenes;

export function deckScene(key: string): DeckScene {
  const scene = allScenes.find((s) => s.key === key);
  if (!scene) throw new Error(`content.json has no scene ${key}`);
  return scene;
}

export const bumpers = content.bumpers;
export const introInfo = content.intro;
export const chapters: readonly Chapter[] = content.chapters;

export function bumperItem(key: string): BumperItem {
  const item = content.bumpers.items.find((b) => b.key === key);
  if (!item) throw new Error(`content.json has no bumper ${key}`);
  return item;
}

/** The scene a bumper leads into. */
export function bumperNext(key: string): DeckScene {
  return deckScene(bumperItem(key).next);
}

export function chapterOf(scene: DeckScene): Chapter {
  const ch = content.chapters.find((c) => c.id === scene.chapter);
  if (!ch) throw new Error(`content.json has no chapter ${scene.chapter}`);
  return ch;
}

/** scene.json id for a content key (`s01`), so defineScene matches the file. */
export function sceneJsonId(key: string): string {
  const id = (sceneIds as Record<string, string>)[key];
  if (!id) throw new Error(`scene-ids.json has no ${key}`);
  return id;
}

export function deckItem<T extends DeckItem = DeckItem>(id: string): T {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`items.json has no ${id}`);
  return item as T;
}

/** Clicks a screen takes: one, or one per item when it builds. */
export const buildCount = (screen: Screen): number => (screen.build ? Math.max(screen.items?.length ?? 1, 1) : 1);

/** Figures on stage at a build step: the latest revealed item's own, else the screen's. */
export function figuresAt(screen: Screen, shown: number): Figure[] {
  const items = screen.items ?? [];
  if (!screen.build) {
    // Everything is on stage at once, so no item's figures may be lost; screen-level figures stay as the fallback.
    const all = items.flatMap((it) => it.figures ?? []).filter((f, i, a) => a.findIndex((g) => g.src === f.src) === i);
    if (all.length) return all;
  }
  for (let i = Math.min(shown, items.length) - 1; i >= 0; i--) {
    const own = items[i].figures;
    if (own?.length) return own;
  }
  return screen.figures ?? (screen.figure ? [screen.figure] : []);
}

/** Same rule as the sequence edges, so the Vanilla Studio player's typed → input both steps and leaves a scene. */
export const ADVANCE = 'key:ArrowRight' as const;

export interface DeckStep {
  id: string;
  advance: typeof ADVANCE;
  screen: number;
  /** Items visible on this step (Infinity when the screen does not build). */
  shown: number;
}

export function stepsOf(scene: DeckScene): DeckStep[] {
  return scene.screens.flatMap((screen, i) => {
    const n = buildCount(screen);
    if (!screen.build) return [{ id: screen.id, advance: ADVANCE, screen: i, shown: Infinity }];
    return Array.from({ length: n }, (_, k) => ({ id: `${screen.id}-${k + 1}`, advance: ADVANCE, screen: i, shown: k + 1 }));
  });
}

/** Era range of a screen, falling back to the scene's. */
export function eraOf(scene: DeckScene, screen: Screen): [number, number] | null {
  const raw = screen.year ?? scene.year;
  if (!raw) return null;
  const [a, b] = raw.split('-').map(Number);
  return [a, b ?? a];
}

const IMAGES = import.meta.glob('../../assets/img/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function imageUrl(name: string): string {
  const url = IMAGES[`../../assets/img/${name}`];
  if (!url) throw new Error(`assets/img has no ${name}`);
  return url;
}
