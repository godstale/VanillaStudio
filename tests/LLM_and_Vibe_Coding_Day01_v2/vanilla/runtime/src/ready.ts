// Readiness signal (S1, S2). A frame may only be captured after everything it depends on exists:
//   1. every <VanillaCanvas> has created its renderer, registered assets (textures, HDRI, models)
//      have loaded, and the fonts DESIGN.md typography asks for have loaded
//   2. the requested time has been applied and two frames have been painted
//   3. `window.__vanillaReady = true` (stills) / the `hf-seek` waitUntil resolves (video)
// `document.fonts.ready` alone is not enough: fonts are fetched lazily, so it can resolve before a
// late-requested web font has even started downloading (S2 control experiment).
import { createContext, createElement, useContext, type ReactNode } from 'react';
import type { Clock } from './clock';

declare global {
  interface Window {
    __vanillaReady?: boolean;
    __vanillaError?: string;
  }
}

interface FontSetLike {
  load(font: string, text?: string): Promise<unknown>;
  ready: Promise<unknown>;
}

export interface ReadinessOptions {
  fonts?: FontSetLike;
  /** Resolves after the next painted frame. */
  nextFrame?: () => Promise<void>;
  /** Object that receives `__vanillaReady` / `__vanillaError` (default: `window`). */
  flags?: { __vanillaReady?: boolean; __vanillaError?: string };
}

export interface Readiness {
  /** Track a texture / HDRI / model load. Rejecting fails the capture instead of hiding the problem. */
  registerAsset(promise: Promise<unknown>): void;
  /** Call when a canvas mounts; the returned function marks its renderer as created. Idempotent. */
  registerCanvas(): () => void;
  /** Load fonts (CSS `font` shorthand specs) and track them as assets. */
  loadFonts(specs: readonly string[], sampleText?: string): void;
  /** Everything registered so far (including things registered while waiting) is loaded. */
  ready(): Promise<void>;
  /**
   * `ready()`, then paint two frames and set `window.__vanillaReady`. `beforeSignal` runs right before
   * the flag is raised (redraw WebGL layers that React changed after the time was applied).
   */
  settle(beforeSignal?: () => void): Promise<void>;
  /** Clear the stills flag before applying a new time. */
  reset(): void;
}

const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export function createReadiness(options: ReadinessOptions = {}): Readiness {
  const fonts = options.fonts ?? (typeof document !== 'undefined' ? document.fonts : undefined);
  const nextFrame = options.nextFrame ?? nextPaint;
  const flags = options.flags ?? (typeof window !== 'undefined' ? window : {});
  const pending = new Set<Promise<unknown>>();
  // Bumped on every registration so ready() knows whether the scene has settled since.
  let registrations = 0;
  let stableAt = -1;

  const track = (p: Promise<unknown>) => {
    pending.add(p);
    registrations++;
    // The rejection is surfaced by ready(); avoid an unhandled-rejection duplicate here.
    p.then(undefined, () => {});
  };

  async function drain(): Promise<void> {
    // Loop: an asset may register more assets (a model that references textures).
    const waited = new Set<Promise<unknown>>();
    for (;;) {
      const batch = [...pending].filter((p) => !waited.has(p));
      if (batch.length === 0) break;
      batch.forEach((p) => waited.add(p));
      await Promise.all(batch);
    }
    if (fonts) await fonts.ready;
  }

  async function ready(): Promise<void> {
    await drain();
    // Loaded is not applied: React commits state derived from an asset promise (a texture set on a
    // material) a moment later. Give that one frame, once per batch of registrations, so the first
    // seek draws the finished scene. Later calls return immediately (no per-frame cost in video renders).
    while (stableAt !== registrations) {
      stableAt = registrations;
      await nextFrame();
      await drain();
    }
  }

  return {
    registerAsset: track,
    registerCanvas() {
      let done!: () => void;
      track(new Promise<void>((resolve) => (done = resolve)));
      return () => done();
    },
    loadFonts(specs, sampleText) {
      if (!fonts) return;
      for (const spec of specs) track(fonts.load(spec, sampleText));
    },
    ready,
    async settle(beforeSignal) {
      try {
        await ready();
        // Layout after the first paint requests any font the text actually uses; wait for those too.
        await nextFrame();
        if (fonts) await fonts.ready;
        await nextFrame();
        beforeSignal?.();
        flags.__vanillaReady = true;
      } catch (e) {
        flags.__vanillaError = e instanceof Error ? e.message : String(e);
        throw e;
      }
    },
    reset() {
      flags.__vanillaReady = false;
      delete flags.__vanillaError;
    },
  };
}

const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong', 'inherit', 'initial']);

type TypographyStyle = Record<string, string | number>;

/** CSS `font` specs for the web fonts a DESIGN.md `typography` block uses (generic families skipped). */
export function fontSpecs(typography: Readonly<Record<string, TypographyStyle>> | undefined): string[] {
  const specs = new Set<string>();
  for (const style of Object.values(typography ?? {})) {
    const first = String(style.fontFamily ?? '').split(',')[0]?.trim().replace(/^["']|["']$/g, '');
    if (!first || GENERIC_FAMILIES.has(first.toLowerCase())) continue;
    const weight = style.fontWeight ?? 400;
    const size = style.fontSize ?? '16px';
    specs.add(`${weight} ${size} "${first}"`);
  }
  return [...specs];
}

export const readiness: Readiness = createReadiness();
export const registerAsset = (promise: Promise<unknown>): void => readiness.registerAsset(promise);

const ReadinessContext = createContext<Readiness>(readiness);

export function ReadinessProvider({ value, children }: { value: Readiness; children?: ReactNode }) {
  return createElement(ReadinessContext.Provider, { value }, children);
}

export const useReadiness = (): Readiness => useContext(ReadinessContext);

/** Still capture: wait for readiness, apply `t`, wait for paint, raise `__vanillaReady`. */
export async function applyAndSettle(clock: Clock, r: Readiness, t: number): Promise<void> {
  r.reset();
  await r.ready();
  clock.seek(t);
  await r.settle(() => clock.redraw());
}
