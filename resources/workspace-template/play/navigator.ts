// Compact sequence navigator for standalone play (DOM-free).
// Semantics mirror src/lib/sequence/manager.ts: trigger rules for
// end / timeout:Ns / click / key:K / choice:<label>, static scenes delegate
// typed input (advance rules decide), motion/3d end is detected host-side
// from time vs duration. Transitions are a quick fade handled by the UI;
// branching follows choice edges like the Studio player.

import type { Manifest, PlayEdge } from './manifest';
import type { SceneDriver, SceneEvent, UserInput } from './host';

export type PlayStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface NavigatorState {
  status: PlayStatus;
  /** Current sceneId. */
  current: string | null;
  /** 0-based index into manifest.order (-1 when none). */
  index: number;
  total: number;
  /** Static-scene step progress. */
  step: { index: number; total: number } | null;
  /** Current scene time (seconds, timed scenes). */
  t: number;
  /** Current scene duration (seconds, timed scenes). */
  duration: number | null;
  /** Choice labels available from the current scene. */
  choices: string[];
  error: string | null;
}

export type DriverFactory = (sceneId: string) => SceneDriver;

export interface NavigatorTimers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
  now(): number;
}

const realTimers: NavigatorTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

/** Done detection slack: time messages arrive throttled (~16ms). */
const DONE_EPSILON = 0.05;

const parseTimeout = (trigger: string): number | null => {
  const m = /^timeout:(\d+(?:\.\d+)?)s$/.exec(trigger);
  return m ? Number(m[1]) * 1000 : null;
};

const matchesInput = (trigger: string, input: UserInput): boolean =>
  input.kind === 'click' ? trigger === 'click' : trigger === `key:${input.key}`;

export interface NavigatorOptions {
  manifest: Manifest;
  createDriver: DriverFactory;
  timers?: NavigatorTimers;
}

export function createNavigator(options: NavigatorOptions) {
  const { manifest, createDriver } = options;
  const timers = options.timers ?? realTimers;
  const { sequence, scenes, order } = manifest;

  let state: NavigatorState = {
    status: 'idle',
    current: null,
    index: -1,
    total: order.length,
    step: null,
    t: 0,
    duration: null,
    choices: [],
    error: null,
  };
  const listeners = new Set<() => void>();
  let driver: SceneDriver | null = null;
  let unsubscribe: (() => void) | null = null;
  let timeouts: { handle: unknown; edge: number; remainingMs: number; startedAt: number }[] = [];
  /** Last typed input, used to pick the edge when a static scene reports done. */
  let lastInput: UserInput | null = null;
  let generation = 0;

  const set = (patch: Partial<NavigatorState>) => {
    state = { ...state, ...patch };
    for (const l of [...listeners]) l();
  };

  const outEdges = (id: string): { e: PlayEdge; i: number }[] =>
    sequence.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.from === id);

  const typeOf = (id: string): string => scenes.get(id)?.type ?? 'motion';

  const choicesOf = (id: string): string[] =>
    outEdges(id).flatMap(({ e }) => (e.trigger.startsWith('choice:') ? [e.trigger.slice('choice:'.length)] : []));

  const clearTimeouts = () => {
    for (const t of timeouts) timers.clear(t.handle);
    timeouts = [];
  };

  const disposeDriver = () => {
    unsubscribe?.();
    unsubscribe = null;
    driver?.dispose();
    driver = null;
  };

  function armTimeouts(id: string) {
    clearTimeouts();
    for (const { e, i } of outEdges(id)) {
      const ms = parseTimeout(e.trigger);
      if (ms === null) continue;
      const entry = { handle: undefined as unknown, edge: i, remainingMs: ms, startedAt: timers.now() };
      entry.handle = timers.set(() => void follow(i), ms);
      timeouts.push(entry);
    }
  }

  function bind(id: string, handle: SceneDriver) {
    set({ duration: null });
    unsubscribe = handle.subscribe((ev: SceneEvent) => {
      if (state.current !== id) return;
      if (ev.type === 'time') {
        set({ t: ev.t });
        if (typeOf(id) !== 'static' && state.duration !== null && ev.t >= state.duration - DONE_EPSILON) {
          onDone(id);
        }
      } else if (ev.type === 'ready') {
        set({ duration: ev.duration ?? null });
      } else if (ev.type === 'step') {
        set({ step: { index: ev.index, total: ev.total } });
      } else if (ev.type === 'error') {
        clearTimeouts();
        set({ status: 'error', error: ev.message });
      } else if (ev.type === 'choice') {
        void chooseLabel(ev.label);
      } else if (ev.type === 'done') {
        onDone(id);
      }
    });
  }

  function onDone(id: string) {
    if (typeOf(id) === 'static') {
      const input = lastInput;
      lastInput = null;
      const edge = input ? outEdges(id).find(({ e }) => matchesInput(e.trigger, input)) : undefined;
      if (edge) void follow(edge.i);
      else if (outEdges(id).length === 0) set({ status: 'ended' });
      return;
    }
    const auto = outEdges(id).find(({ e }) => e.trigger === 'end');
    if (auto) void follow(auto.i);
    else if (outEdges(id).length === 0) set({ status: 'ended' });
  }

  async function follow(edgeIndex: number): Promise<void> {
    const edge = sequence.edges[edgeIndex];
    const from = state.current;
    if (!edge || from === null || edge.from !== from || state.status === 'loading') return;
    const mine = ++generation;
    clearTimeouts();
    const incoming = createDriver(edge.to);
    set({ status: 'loading', error: null });
    try {
      await incoming.load();
    } catch (err) {
      if (mine !== generation) return;
      incoming.dispose();
      set({ status: 'error', error: `could not load ${scenes.get(edge.to)?.name ?? edge.to}: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }
    if (mine !== generation) {
      incoming.dispose();
      return;
    }
    disposeDriver();
    driver = incoming;
    lastInput = null;
    const index = order.indexOf(edge.to);
    set({ status: 'playing', current: edge.to, index, step: null, t: 0, duration: null, choices: choicesOf(edge.to) });
    bind(edge.to, incoming);
    if (typeOf(edge.to) !== 'static') incoming.start();
    armTimeouts(edge.to);
  }

  async function begin(sceneId: string): Promise<void> {
    const mine = ++generation;
    clearTimeouts();
    disposeDriver();
    const index = order.indexOf(sceneId);
    set({ status: 'loading', current: sceneId, index, step: null, t: 0, duration: null, error: null, choices: choicesOf(sceneId) });
    const handle = createDriver(sceneId);
    try {
      await handle.load();
    } catch (err) {
      if (mine !== generation) return;
      handle.dispose();
      set({ status: 'error', error: `could not load ${scenes.get(sceneId)?.name ?? sceneId}: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }
    if (mine !== generation) {
      handle.dispose();
      return;
    }
    driver = handle;
    bind(sceneId, handle);
    if (typeOf(sceneId) !== 'static') handle.start();
    set({ status: 'playing' });
    armTimeouts(sceneId);
  }

  async function chooseLabel(label: string): Promise<void> {
    const cur = state.current;
    if (cur === null) return;
    const edge = outEdges(cur).find(({ e }) => e.trigger === `choice:${label}`);
    if (edge) await follow(edge.i);
  }

  return {
    getState: (): NavigatorState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async start(): Promise<void> {
      if (order.length === 0) {
        set({ status: 'error', error: 'no playable scenes (empty sequence)' });
        return;
      }
      const first = sequence.start && order.includes(sequence.start) ? sequence.start : order[0];
      await begin(first);
    },

    async retry(): Promise<void> {
      const id = state.current ?? (sequence.start && order.includes(sequence.start) ? sequence.start : order[0]);
      if (id === undefined || id === null) return;
      await begin(id);
    },

    /** Jump without transition (scene list, prev/next scene buttons). */
    async jump(sceneId: string): Promise<void> {
      if (!order.includes(sceneId)) return;
      await begin(sceneId);
    },

    async prevScene(): Promise<void> {
      if (state.index > 0) await begin(order[state.index - 1]);
    },

    async nextScene(): Promise<void> {
      if (state.index >= 0 && state.index < order.length - 1) await begin(order[state.index + 1]);
    },

    pause(): void {
      if (state.status !== 'playing' || state.current === null) return;
      driver?.pause();
      const now = timers.now();
      timeouts = timeouts.map((t) => {
        timers.clear(t.handle);
        return { ...t, remainingMs: Math.max(0, t.remainingMs - (now - t.startedAt)) };
      });
      set({ status: 'paused' });
    },

    resume(): void {
      if (state.status !== 'paused' || state.current === null) return;
      driver?.resume();
      const now = timers.now();
      timeouts = timeouts.map((t) => ({ ...t, startedAt: now, handle: timers.set(() => void follow(t.edge), t.remainingMs) }));
      set({ status: 'playing' });
    },

    seek(t: number): void {
      if (state.current === null) return;
      driver?.seek(t);
      set({ t });
    },

    /** Typed user input: static scenes match it against advance rules, timed scenes match edges. */
    input(input: UserInput): void {
      const cur = state.current;
      if (cur === null || state.status !== 'playing') return;
      if (typeOf(cur) === 'static') {
        lastInput = input;
        driver?.input(input);
        return;
      }
      const edge = outEdges(cur).find(({ e }) => matchesInput(e.trigger, input));
      if (edge) void follow(edge.i);
    },

    /** Explicit step move (player step buttons; works on old runtimes too). */
    stepForward(): void {
      if (state.current !== null && typeOf(state.current) === 'static' && state.status === 'playing') driver?.next();
    },

    back(): void {
      if (state.current !== null && typeOf(state.current) === 'static' && state.status === 'playing') driver?.prev();
    },

    choose: (label: string): Promise<void> => chooseLabel(label),

    dispose(): void {
      generation += 1;
      clearTimeouts();
      disposeDriver();
      listeners.clear();
    },
  };
}

export type PlayNavigator = ReturnType<typeof createNavigator>;
