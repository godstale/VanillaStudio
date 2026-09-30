// Scene clock. Time is injected, never read by scene code from the wall clock (D-011).
//
//  preview: host (Bridge) drives play / pause / seek; the clock advances by its own frame loop while playing.
//  render:  HyperFrames dispatches `hf-seek` for every captured frame; nothing advances on its own.
//  live:    free-mode scenes (web / interactive). Real-time clock; seek is ignored, play / pause honoured.
import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

export type ClockMode = 'preview' | 'render' | 'live';

/** Synchronous draw hook for layers that are not driven by React (WebGL). Receives global seconds. */
export type Renderer = (t: number) => void;

export interface ClockOptions {
  mode: ClockMode;
  /** Total length in seconds when known; `seek` and playback clamp to it. */
  duration?: number;
  /** Start playing immediately (default: true for `live`, false otherwise). */
  autoplay?: boolean;
  /** Commit React updates synchronously on every time change (default: render mode only). */
  sync?: boolean;
  now?: () => number;
  requestFrame?: (cb: () => void) => number;
  cancelFrame?: (id: number) => void;
  onError?: (error: unknown) => void;
}

export interface Clock {
  readonly mode: ClockMode;
  getTime(): number;
  getDuration(): number | undefined;
  setDuration(duration: number | undefined): void;
  isPlaying(): boolean;
  /** Move to global time `t`. Ignored in `live` mode. */
  seek(t: number): void;
  play(): void;
  pause(): void;
  /** Re-run renderers for the current time (e.g. after a design override). */
  redraw(): void;
  subscribe(listener: () => void): () => void;
  subscribePlaying(listener: () => void): () => void;
  registerRenderer(renderer: Renderer): () => void;
  dispose(): void;
}

export function createClock(options: ClockOptions): Clock {
  const {
    mode,
    autoplay = mode === 'live',
    sync = mode === 'render',
    now = () => performance.now(),
    requestFrame = (cb) => requestAnimationFrame(cb),
    cancelFrame = (id) => cancelAnimationFrame(id),
    onError = (e) => console.error(e),
  } = options;
  let duration = options.duration;
  let time = 0;
  let playing = false;
  let frameId: number | null = null;
  let last = 0;
  const timeListeners = new Set<() => void>();
  const playingListeners = new Set<() => void>();
  const renderers = new Set<Renderer>();

  const clamp = (t: number) => Math.max(0, duration === undefined ? t : Math.min(duration, t));

  function draw() {
    for (const r of renderers) r(time);
  }

  function commit() {
    const emit = () => timeListeners.forEach((l) => l());
    // The DOM layer must be committed before a frame is captured.
    if (sync) flushSync(emit);
    else emit();
    draw();
  }

  function setTime(t: number) {
    time = clamp(t);
    commit();
  }

  function tick() {
    frameId = null;
    if (!playing) return;
    const t = now();
    const next = time + (t - last) / 1000;
    last = t;
    try {
      setTime(next);
    } catch (e) {
      onError(e);
    }
    if (duration !== undefined && time >= duration) {
      setPlaying(false);
      return;
    }
    frameId = requestFrame(tick);
  }

  function setPlaying(value: boolean) {
    if (playing === value) return;
    playing = value;
    if (value) {
      last = now();
      frameId = requestFrame(tick);
    } else if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
    playingListeners.forEach((l) => l());
  }

  const clock: Clock = {
    mode,
    getTime: () => time,
    getDuration: () => duration,
    setDuration(d) {
      duration = d;
      if (d !== undefined && time > d) setTime(d);
    },
    isPlaying: () => playing,
    seek(t) {
      if (mode === 'live') return;
      setTime(t);
    },
    play() {
      if (mode === 'render') return;
      // Restart from the beginning when the end was reached, like a media player.
      if (duration !== undefined && time >= duration) setTime(0);
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    redraw: draw,
    subscribe(l) {
      timeListeners.add(l);
      return () => timeListeners.delete(l);
    },
    subscribePlaying(l) {
      playingListeners.add(l);
      return () => playingListeners.delete(l);
    },
    registerRenderer(r) {
      renderers.add(r);
      return () => renderers.delete(r);
    },
    dispose() {
      setPlaying(false);
      timeListeners.clear();
      playingListeners.clear();
      renderers.clear();
    },
  };
  if (autoplay) clock.play();
  return clock;
}

interface HfSeekDetail {
  time: number;
  waitUntil: (p: Promise<unknown>) => void;
}

/**
 * Render mode: apply HyperFrames' `hf-seek` once the scene is ready. `waitUntil` must be called
 * synchronously inside the event; the capture waits until the frame is drawn (S1: applying the time
 * before the WebGL renderer exists made the worker's first frame differ).
 */
export function installHfSeek(clock: Clock, ready: () => Promise<unknown>, target: EventTarget = window): () => void {
  const handler = (e: Event) => {
    const { time, waitUntil } = (e as CustomEvent<HfSeekDetail>).detail;
    waitUntil(ready().then(() => clock.seek(time)));
  };
  target.addEventListener('hf-seek', handler);
  return () => target.removeEventListener('hf-seek', handler);
}

export function parseClockMode(search: string, fallback: ClockMode): ClockMode {
  const m = new URLSearchParams(search).get('mode');
  return m === 'preview' || m === 'render' || m === 'live' ? m : fallback;
}

/** `?t=3.2` for still capture and debugging; `null` when absent or invalid. */
export function parseInitialTime(search: string): number | null {
  const raw = new URLSearchParams(search).get('t');
  if (raw === null || raw.trim() === '') return null;
  const t = Number(raw);
  return Number.isFinite(t) && t >= 0 ? t : null;
}

// ---- Global <-> scene-local time -------------------------------------------------------------

export interface Segment {
  id: string;
  start: number;
  duration: number;
}

/**
 * Lay scenes out back to back. `overlap` (seconds, default 0) makes a scene start that early, so
 * both are active during the transition.
 */
export function layoutSegments(items: readonly { id: string; duration: number; overlap?: number }[]): Segment[] {
  const out: Segment[] = [];
  let end = 0;
  for (const it of items) {
    const overlap = out.length === 0 ? 0 : Math.min(Math.max(0, it.overlap ?? 0), end);
    const start = end - overlap;
    out.push({ id: it.id, start, duration: it.duration });
    end = start + it.duration;
  }
  return out;
}

export const totalDuration = (segments: readonly Segment[]): number =>
  segments.reduce((max, s) => Math.max(max, s.start + s.duration), 0);

export const toLocalTime = (globalTime: number, segmentStart: number): number => globalTime - segmentStart;
export const toGlobalTime = (localTime: number, segmentStart: number): number => localTime + segmentStart;

export interface ActiveSegment {
  segment: Segment;
  index: number;
  local: number;
}

/** Scenes active at `t`: `[start, end)`, except the final instant which belongs to the last scene. */
export function activeAt(segments: readonly Segment[], t: number): ActiveSegment[] {
  const total = totalDuration(segments);
  const out: ActiveSegment[] = [];
  segments.forEach((segment, index) => {
    const end = segment.start + segment.duration;
    const inside = t >= segment.start && (t < end || (t === total && end === total));
    if (inside) out.push({ segment, index, local: toLocalTime(t, segment.start) });
  });
  return out;
}

/** The scene on top at `t` (the latest-starting active one), or `null` outside the timeline. */
export function sceneAt(segments: readonly Segment[], t: number): ActiveSegment | null {
  const active = activeAt(segments, t);
  return active.length ? active[active.length - 1] : null;
}

/** Progress 0..1 through an overlap between two scenes, or `null` when no transition is running. */
export function transitionAt(segments: readonly Segment[], t: number): { from: ActiveSegment; to: ActiveSegment; progress: number } | null {
  const active = activeAt(segments, t);
  if (active.length < 2) return null;
  const from = active[active.length - 2];
  const to = active[active.length - 1];
  const overlap = from.segment.start + from.segment.duration - to.segment.start;
  return overlap > 0 ? { from, to, progress: Math.min(1, Math.max(0, (t - to.segment.start) / overlap)) } : null;
}

// ---- React bindings ---------------------------------------------------------------------------

export const defaultClock: Clock = createClock({ mode: 'preview' });

const ClockContext = createContext<Clock>(defaultClock);
const SceneStartContext = createContext(0);

export function ClockProvider({ clock, children }: { clock: Clock; children?: ReactNode }) {
  return createElement(ClockContext.Provider, { value: clock }, children);
}

/** Wrap a scene so `useTime()` reports time relative to the scene's start. */
export function SceneTimeProvider({ start, children }: { start: number; children?: ReactNode }) {
  return createElement(SceneStartContext.Provider, { value: start }, children);
}

export const useClock = (): Clock => useContext(ClockContext);

/** Global (composition) time in seconds. */
export function useGlobalTime(): number {
  const clock = useClock();
  return useSyncExternalStore(clock.subscribe, clock.getTime, clock.getTime);
}

/**
 * Current scene-local time in seconds. In clock-contract scenes (`video`, `image`, `slides`) animation
 * must be a pure function of this value; in free-mode scenes it is elapsed time.
 */
export function useTime(): number {
  return toLocalTime(useGlobalTime(), useContext(SceneStartContext));
}

export function usePlaying(): boolean {
  const clock = useClock();
  return useSyncExternalStore(clock.subscribePlaying, clock.isPlaying, clock.isPlaying);
}
