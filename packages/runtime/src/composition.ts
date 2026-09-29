// Composition (Technical-Design §4.2): which scenes make up the deliverable and how they sit on the
// clock. `src/composition.tsx` in a project default-exports `defineComposition(...)`; the app-owned
// bootstrap (`@vanilla/runtime/app`) mounts it.
//
//   layout "timeline" (video, slides, image): scenes are laid back to back on one global timeline;
//     `overlap` makes a scene start early so two are active during a transition (incoming scene fades in).
//     Scenes without `duration` (slides/image) become one step each, so `goto` and `seek` still line up.
//   layout "sections" (web, interactive): every scene is rendered in a column, each with its own local time.
import { layoutSegments, totalDuration, type Segment } from './clock';
import type { SceneDefinition } from './scene';

export interface CompositionEntry {
  scene: SceneDefinition;
  /** Seconds this scene starts before the previous one ends (timeline layout only). */
  overlap?: number;
}

export interface CompositionFormat {
  width: number;
  height: number;
}

export interface CompositionInput {
  scenes: readonly (SceneDefinition | CompositionEntry)[];
  /** `clock`: animation is a pure function of the time (video, image, slides). `free`: web / interactive. */
  time?: 'clock' | 'free';
  layout?: 'timeline' | 'sections';
  format?: CompositionFormat;
}

export interface Composition {
  scenes: readonly SceneDefinition[];
  segments: readonly Segment[];
  time: 'clock' | 'free';
  layout: 'timeline' | 'sections';
  format: CompositionFormat | undefined;
  /** Seconds; `undefined` when a scene has no duration or the layout is not a timeline. */
  duration: number | undefined;
  /** Length the clock clamps to: `duration`, or the number of steps for untimed timeline scenes. */
  clockDuration: number | undefined;
}

const isEntry = (s: SceneDefinition | CompositionEntry): s is CompositionEntry => 'scene' in s;

export function defineComposition(input: CompositionInput): Composition {
  const entries = input.scenes.map((s) => (isEntry(s) ? s : { scene: s }));
  if (entries.length === 0) throw new Error('defineComposition: at least one scene is required');
  const ids = new Set<string>();
  for (const { scene } of entries) {
    if (ids.has(scene.id)) throw new Error(`defineComposition: duplicate scene id "${scene.id}"`);
    ids.add(scene.id);
  }
  const layout = input.layout ?? 'timeline';
  const timed = entries.every((e) => e.scene.duration !== undefined);
  const segments = layoutSegments(entries.map((e) => ({ id: e.scene.id, duration: e.scene.duration ?? 1, overlap: e.overlap })));
  const total = totalDuration(segments);
  return {
    scenes: entries.map((e) => e.scene),
    segments,
    time: input.time ?? 'clock',
    layout,
    format: input.format,
    duration: layout === 'timeline' && timed ? total : undefined,
    clockDuration: layout === 'timeline' ? total : undefined,
  };
}

/** Segment start for `goto`; `null` when the composition has no such scene. */
export const sceneStart = (c: Composition, sceneId: string): number | null => c.segments.find((s) => s.id === sceneId)?.start ?? null;

export type ParamsBySceneId = Readonly<Record<string, Readonly<Record<string, unknown>>>>;
