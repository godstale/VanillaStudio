import type { SceneType } from '@/lib/scene/schema';
import type { Sequence } from './schema';
import type { TransitionSpec } from '@/lib/playground/transitions';
import { hasErrors, validateSequence, type SceneRef, type SequenceIssue } from './validate';

// 시퀀스 매니저(T6.5, D-025·D-032): `sequence.json`을 해석해 신을 순서대로 로드·재생하고 trigger로 다음 신으로 넘기는 상태 머신.
// iframe·Bridge·전환 합성은 모른다: 신은 `SceneHandle`, 전환 재생은 `TransitionRunner`로 주입받는다(Playground UI가 구현, 테스트는 가짜).
//
// trigger 규칙
//  - end            : motion·3d 신이 끝 시각에 도달(`done`)하면.
//  - timeout:Ns     : 신이 재생을 시작한 지 N초 뒤(일시정지하면 타이머도 멈추고 재개하면 남은 시간으로 이어간다).
//  - click · key:K  : 사용자 입력. 현재 신이 static이고 아직 마지막 step이 아니면 입력은 신(step 이동)에게 위임한다. 마지막 step이거나 motion·3d면 엣지를 평가한다.
//  - choice:<label> : 신의 UI가 `choice` 이벤트로 보고하거나 호스트가 직접 고르게 한 라벨.

export type SceneEvent =
  | { type: 'done' }
  | { type: 'step'; index: number; total: number }
  | { type: 'choice'; label: string }
  | { type: 'ready'; duration?: number }
  | { type: 'time'; t: number }
  | { type: 'error'; message: string };

/** 로드된(또는 로드 중인) 신 하나. 구현은 iframe + Bridge다. */
export interface SceneHandle {
  readonly sceneId: string;
  /** 로드 뒤에 아는 길이(초). static은 없다. */
  readonly duration?: number;
  /** 신이 `ready`가 될 때까지. 실패하면 거부한다. 여러 번 불러도 한 번만 로드한다. */
  load(): Promise<void>;
  /** 처음부터 재생(motion·3d) 또는 step 0으로(static). */
  start(): void;
  pause(): void;
  resume(): void;
  seek(t: number): void;
  /** static 신에게 사용자 입력 위임(다음 step). */
  next(): void;
  prev(): void;
  subscribe(listener: (e: SceneEvent) => void): () => void;
  dispose(): void;
}

export interface SceneHost {
  create(sceneId: string): SceneHandle;
}

/** 전환을 재생한다. 끝나면 resolve. cut이면 바로 resolve. 실패해도 매니저는 다음 신으로 넘어간다. */
export type TransitionRunner = (spec: TransitionSpec, from: SceneHandle, to: SceneHandle) => Promise<void>;

export type UserInput = { kind: 'click' } | { kind: 'key'; key: string };

export type ManagerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'transitioning' | 'ended' | 'error';

export interface ManagerState {
  status: ManagerStatus;
  current: string | null;
  /** 전환 중이면 들어오는 신. */
  next: string | null;
  /** 현재 신이 static일 때의 step 진행. */
  step: { index: number; total: number } | null;
  /** 현재 신이 재생 중인 시각(초). */
  t: number;
  /** 현재 신의 길이(초). static이거나 아직 모르면 null. */
  duration: number | null;
  error: string | null;
  /** 지금 고를 수 있는 분기 라벨(현재 신에서 나가는 choice 엣지). */
  choices: string[];
  /** 지나온 신(최근 순서대로 끝에 추가). */
  history: string[];
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
  now(): number;
}

const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>), now: () => Date.now() };

export interface ManagerOptions {
  sequence: Sequence;
  scenes: ReadonlyMap<string, SceneRef>;
  workspaceId: string;
  customTransitions?: ReadonlySet<string>;
  host: SceneHost;
  runTransition?: TransitionRunner;
  timers?: Timers;
}

const parseTimeout = (trigger: string): number | null => {
  const m = /^timeout:(\d+(?:\.\d+)?)s$/.exec(trigger);
  return m ? Number(m[1]) * 1000 : null;
};

export class SequenceError extends Error {
  constructor(
    message: string,
    readonly issues: SequenceIssue[] = [],
  ) {
    super(message);
  }
}

export function createSequenceManager(options: ManagerOptions) {
  const { sequence, scenes, host } = options;
  const timers = options.timers ?? realTimers;
  const runTransition: TransitionRunner = options.runTransition ?? (() => Promise.resolve());

  const issues = validateSequence(sequence, { workspaceId: options.workspaceId, scenes, customTransitions: options.customTransitions });
  const blocking = hasErrors(issues);

  let state: ManagerState = { status: 'idle', current: null, next: null, step: null, t: 0, duration: null, error: null, choices: [], history: [] };
  const listeners = new Set<() => void>();
  const handles = new Map<string, SceneHandle>();
  let unsubscribeCurrent: (() => void) | null = null;
  let timeoutHandles: { handle: unknown; trigger: string; edge: number; remainingMs: number; startedAt: number }[] = [];
  /** 마지막 사용자 입력: 위임한 입력이 `done`을 만들었을 때 어떤 엣지를 탈지 정한다. */
  let lastInput: UserInput | null = null;
  let generation = 0; // 비동기 작업(로드·전환)이 오래된 것인지 가린다

  const set = (patch: Partial<ManagerState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  const outEdges = (id: string) => sequence.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.from === id);
  const typeOf = (id: string): SceneType => scenes.get(id)?.type ?? 'motion';
  const choicesOf = (id: string) => outEdges(id).flatMap(({ e }) => (e.trigger.startsWith('choice:') ? [e.trigger.slice('choice:'.length)] : []));

  function handleFor(id: string): SceneHandle {
    let h = handles.get(id);
    if (!h) {
      h = host.create(id);
      handles.set(id, h);
    }
    return h;
  }

  function disposeHandle(id: string) {
    handles.get(id)?.dispose();
    handles.delete(id);
  }

  function clearTimeouts() {
    for (const t of timeoutHandles) timers.clear(t.handle);
    timeoutHandles = [];
  }

  /** 다음에 갈 수 있는 신을 미리 로드한다(전환 지연을 줄이는 프리로드). 실패는 전환 시점에 다시 드러난다. */
  function preloadNeighbours(id: string) {
    const targets = new Set(outEdges(id).map(({ e }) => e.to));
    for (const other of [...handles.keys()]) if (other !== id && !targets.has(other)) disposeHandle(other);
    for (const to of targets) if (to !== id) void handleFor(to).load().catch(() => undefined);
  }

  function armTimeouts(id: string, fromMs?: number) {
    clearTimeouts();
    for (const { e, i } of outEdges(id)) {
      const ms = parseTimeout(e.trigger);
      if (ms === null) continue;
      const remaining = fromMs === undefined ? ms : Math.max(0, ms - fromMs);
      const entry = { handle: undefined as unknown, trigger: e.trigger, edge: i, remainingMs: remaining, startedAt: timers.now() };
      entry.handle = timers.set(() => void follow(i), remaining);
      timeoutHandles.push(entry);
    }
  }

  function bind(id: string) {
    unsubscribeCurrent?.();
    const h = handleFor(id);
    set({ duration: h.duration ?? null });
    unsubscribeCurrent = h.subscribe((ev) => {
      if (state.current !== id || state.status === 'transitioning') return;
      if (ev.type === 'time') set({ t: ev.t });
      else if (ev.type === 'ready') set({ duration: ev.duration ?? null });
      else if (ev.type === 'step') set({ step: { index: ev.index, total: ev.total } });
      else if (ev.type === 'error') fail(ev.message);
      else if (ev.type === 'choice') void chooseLabel(ev.label);
      else if (ev.type === 'done') onDone(id);
    });
  }

  function fail(message: string) {
    clearTimeouts();
    set({ status: 'error', error: message });
  }

  function onDone(id: string) {
    const auto = outEdges(id).find(({ e }) => e.trigger === 'end');
    if (typeOf(id) === 'static') {
      // static의 done = 마지막 step에서 입력이 들어옴. 그 입력에 맞는 엣지를 탄다.
      const input = lastInput;
      lastInput = null;
      const edge = input ? outEdges(id).find(({ e }) => matchesInput(e.trigger, input)) : undefined;
      if (edge) void follow(edge.i);
      else if (outEdges(id).length === 0) set({ status: 'ended' });
      return;
    }
    if (auto) void follow(auto.i);
    else if (outEdges(id).length === 0) set({ status: 'ended' });
    // 끝났지만 입력·분기를 기다리는 엣지만 있으면 마지막 프레임에서 멈춰 기다린다.
  }

  const matchesInput = (trigger: string, input: UserInput): boolean => (input.kind === 'click' ? trigger === 'click' : trigger === `key:${input.key}`);

  /** 엣지를 따라 다음 신으로 간다: 로드(프리로드 재사용) → 전환 → 교체 → 재생. */
  async function follow(edgeIndex: number): Promise<void> {
    const edge = sequence.edges[edgeIndex];
    const from = state.current;
    if (!edge || from === null || edge.from !== from || state.status === 'transitioning' || state.status === 'loading') return;
    const mine = ++generation;
    clearTimeouts();
    const incoming = handleFor(edge.to);
    set({ status: 'transitioning', next: edge.to, error: null });
    try {
      await incoming.load();
    } catch (err) {
      if (mine !== generation) return;
      disposeHandle(edge.to);
      set({ status: 'error', next: null, error: `could not load ${scenes.get(edge.to)?.name ?? edge.to}: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }
    if (mine !== generation) return;
    incoming.start();
    try {
      await runTransition(edge.transition, handleFor(from), incoming);
    } catch {
      // 전환 연출이 실패해도 시퀀스는 계속된다(컷으로 대체).
    }
    if (mine !== generation) return;
    unsubscribeCurrent?.();
    disposeHandle(from);
    lastInput = null;
    set({ status: 'playing', current: edge.to, next: null, step: null, t: 0, duration: null, choices: choicesOf(edge.to), history: [...state.history, edge.to] });
    bind(edge.to);
    armTimeouts(edge.to);
    preloadNeighbours(edge.to);
  }

  async function chooseLabel(label: string): Promise<void> {
    const cur = state.current;
    if (cur === null || state.status === 'transitioning') return;
    const edge = outEdges(cur).find(({ e }) => e.trigger === `choice:${label}`);
    if (edge) await follow(edge.i);
  }

  async function begin(startId: string): Promise<void> {
    const mine = ++generation;
    clearTimeouts();
    unsubscribeCurrent?.();
    for (const id of [...handles.keys()]) disposeHandle(id);
    set({ status: 'loading', current: startId, next: null, step: null, t: 0, duration: null, error: null, choices: choicesOf(startId), history: [startId] });
    const h = handleFor(startId);
    try {
      await h.load();
    } catch (err) {
      if (mine !== generation) return;
      set({ status: 'error', error: `could not load ${scenes.get(startId)?.name ?? startId}: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }
    if (mine !== generation) return;
    bind(startId);
    h.start();
    set({ status: 'playing' });
    armTimeouts(startId);
    preloadNeighbours(startId);
  }

  return {
    /** 검증 결과(오류가 있으면 재생할 수 없다). */
    issues,
    getState: (): ManagerState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** 시작 신부터 재생한다. 검증 오류가 있으면 던진다. */
    async start(): Promise<void> {
      if (blocking) throw new SequenceError('the sequence has errors', issues.filter((i) => i.severity === 'error'));
      if (sequence.start === null) throw new SequenceError('the sequence has no start scene');
      await begin(sequence.start);
    },

    /** 오류 상태에서 현재 신을 다시 시도한다(없으면 처음부터). */
    async retry(): Promise<void> {
      const id = state.current ?? sequence.start;
      if (id === null || blocking) return;
      if (handles.has(id) && state.next !== null) disposeHandle(state.next);
      await begin(id);
    },

    /** 전환 없이 그 신으로 건너뛴다(진행 바·신 목록). */
    async jump(sceneId: string): Promise<void> {
      if (blocking || !scenes.has(sceneId) || !sequence.nodes.some((n) => n.sceneId === sceneId)) return;
      await begin(sceneId);
    },

    pause(): void {
      if (state.status !== 'playing' || state.current === null) return;
      handles.get(state.current)?.pause();
      const now = timers.now();
      // 일시정지하면 타이머를 멈추고, 재개할 때 남은 시간으로 이어간다.
      timeoutHandles = timeoutHandles.map((t) => {
        timers.clear(t.handle);
        return { ...t, remainingMs: Math.max(0, t.remainingMs - (now - t.startedAt)) };
      });
      set({ status: 'paused' });
    },

    resume(): void {
      if (state.status !== 'paused' || state.current === null) return;
      handles.get(state.current)?.resume();
      const now = timers.now();
      timeoutHandles = timeoutHandles.map((t) => ({ ...t, startedAt: now, handle: timers.set(() => void follow(t.edge), t.remainingMs) }));
      set({ status: 'playing' });
    },

    seek(t: number): void {
      if (state.current === null || state.status === 'transitioning' || state.status === 'loading') return;
      handles.get(state.current)?.seek(t);
      set({ t });
    },

    /** 사용자 입력(클릭·키). static 신은 마지막 step 전까지 step 이동에 쓰이고, 그 뒤부터 엣지를 평가한다. */
    input(input: UserInput): void {
      const cur = state.current;
      if (cur === null || (state.status !== 'playing' && state.status !== 'paused')) return;
      if (state.status === 'paused') return;
      const h = handles.get(cur);
      if (typeOf(cur) === 'static') {
        lastInput = input;
        h?.next(); // 신이 step을 옮기거나, 마지막 step이면 `done`을 보고한다(그때 lastInput으로 엣지를 고른다)
        return;
      }
      const edge = outEdges(cur).find(({ e }) => matchesInput(e.trigger, input));
      if (edge) void follow(edge.i);
    },

    /** static 신의 이전 step. */
    back(): void {
      const cur = state.current;
      if (cur !== null && typeOf(cur) === 'static' && state.status === 'playing') handles.get(cur)?.prev();
    },

    /** 분기 라벨을 고른다(`choice` 오버레이 클릭). */
    choose: (label: string): Promise<void> => chooseLabel(label),

    /** 모든 신과 타이머를 정리한다. */
    dispose(): void {
      generation += 1;
      clearTimeouts();
      unsubscribeCurrent?.();
      for (const id of [...handles.keys()]) disposeHandle(id);
      listeners.clear();
    },
  };
}

export type SequenceManager = ReturnType<typeof createSequenceManager>;
