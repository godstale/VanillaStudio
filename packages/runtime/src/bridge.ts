// Vanilla Bridge, scene side (Technical-Design §5). The host page embeds the preview in an iframe and
// talks to it with window.postMessage. Every message is `{ v: 2, type, payload }` (v2: static-page steps and canvas injection).
// Security: the host origin is fixed when the bridge is created, never taken from a message; messages
// from any other origin or window are dropped; payloads are validated before they reach the runtime.
import { z } from 'zod';
import type { Clock, ClockMode } from './clock';
import type { SceneMeta } from './scene';
import type { Colors } from './design/types';

export const BRIDGE_VERSION = 2;

// ---- host -> scene ----------------------------------------------------------------------------

const RoleName = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/i);
// Hex or functional color notation only; the value ends up in a CSS custom property.
const ColorValue = z.string().max(96).regex(/^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([0-9a-z%.,/\s+-]*\))$/i);

const HostMessage = z.discriminatedUnion('type', [
  z.object({
    v: z.literal(BRIDGE_VERSION),
    type: z.literal('init'),
    payload: z.object({
      mode: z.literal('preview'),
      paramsValues: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
      /** workspace.json.canvas (D-030). Absent: keep the current frame. */
      canvas: z.object({ width: z.number().int().min(16).max(7680), height: z.number().int().min(16).max(7680), fps: z.number().int().min(1).max(120) }).optional(),
    }),
  }),
  z.object({ v: z.literal(BRIDGE_VERSION), type: z.literal('play') }),
  z.object({ v: z.literal(BRIDGE_VERSION), type: z.literal('pause') }),
  // v2: the playground host delegates user input to a static page (D-032).
  z.object({ v: z.literal(BRIDGE_VERSION), type: z.literal('next') }),
  z.object({ v: z.literal(BRIDGE_VERSION), type: z.literal('prev') }),
  z.object({ v: z.literal(BRIDGE_VERSION), type: z.literal('seek'), payload: z.object({ t: z.number().finite().min(0) }) }),
  z.object({ v: z.literal(BRIDGE_VERSION), type: z.literal('setParams'), payload: z.object({ sceneId: z.string().min(1), values: z.record(z.string(), z.unknown()) }) }),
  z.object({ v: z.literal(BRIDGE_VERSION), type: z.literal('goto'), payload: z.object({ sceneId: z.string().min(1) }) }),
  z.object({
    v: z.literal(BRIDGE_VERSION),
    type: z.literal('setDesign'),
    payload: z.object({ colors: z.record(RoleName, ColorValue).nullable() }),
  }),
  z.object({
    v: z.literal(BRIDGE_VERSION),
    type: z.literal('capture'),
    payload: z.object({ scale: z.number().finite().min(0.1).max(4).default(1), id: z.string().max(64).optional() }).default({ scale: 1 }),
  }),
  z.object({ v: z.literal(BRIDGE_VERSION), type: z.literal('reload') }),
]);

export type HostMessage = z.infer<typeof HostMessage>;

// ---- scene -> host ----------------------------------------------------------------------------

export interface ReadyPayload {
  scenes: SceneMeta[];
  duration: number | undefined;
  format: string;
  /** `roles` maps role name to the resolved color the scene is using. */
  design: { hash: string; roles: Colors };
}
export interface TimePayload {
  t: number;
  sceneId: string | null;
}
export interface ErrorPayload {
  message: string;
  stack: string;
  sceneId: string | null;
}
/** Static pages: the current step (0-based) and how many there are (scroll pages count as one). */
export interface StepPayload {
  index: number;
  total: number;
}
export interface ChoicePayload {
  label: string;
}
export interface CapturedPayload {
  dataUrl: string;
  scale: number;
  id?: string;
}

// ---- runtime side -----------------------------------------------------------------------------

export interface BridgeTarget {
  init(payload: { mode: 'preview'; paramsValues: Record<string, Record<string, unknown>>; canvas?: { width: number; height: number; fps: number } }): void;
  /** v2: step forward / back on behalf of the host (static pages). */
  next(): void;
  prev(): void;
  play(): void;
  pause(): void;
  seek(t: number): void;
  setParams(sceneId: string, values: Record<string, unknown>): void;
  goto(sceneId: string): void;
  /** `null` clears the preview override. */
  setDesign(colors: Colors | null): void;
  /** Resolve with a PNG data URL of the current frame. */
  capture(scale: number): Promise<string>;
  reload(): void;
}

/** play / pause / seek backed by a Clock (live-mode clocks ignore seek themselves, D-011). */
export const clockTarget = (clock: Clock): Pick<BridgeTarget, 'play' | 'pause' | 'seek'> => ({
  play: () => clock.play(),
  pause: () => clock.pause(),
  seek: (t) => clock.seek(t),
});

export interface BridgeOptions {
  target: BridgeTarget;
  /** Exact origin of the host page, e.g. `http://localhost:1430`. */
  hostOrigin: string;
  /** The preview window (default: `window`). */
  self?: Window;
  /** The host window (default: `window.parent`). */
  host?: Window;
  /** Clock mode. `render` never talks to a host: the bridge is inert there. */
  mode?: ClockMode;
  /** Minimum gap between `time` messages in ms (default 16). */
  timeThrottleMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  /** Forward window `error` / `unhandledrejection` events (default true). */
  captureErrors?: boolean;
  getSceneId?: () => string | null;
}

export interface Bridge {
  ready(payload: ReadyPayload): void;
  /** Throttled; the latest value is always delivered (trailing edge). */
  time(t: number, sceneId: string | null): void;
  /** Deliver a pending throttled `time` message now. */
  flushTime(): void;
  error(error: unknown, sceneId?: string | null): void;
  hmr(modules: readonly string[]): void;
  /** v2 (static pages): the page moved to step `index` of `total`. */
  step(index: number, total: number): void;
  /** v2: the last step received its input, so the sequence edge trigger can be evaluated. */
  done(): void;
  /** v2: the user picked a `choice:<label>` branch. */
  choice(label: string): void;
  dispose(): void;
}

/** Validate a host origin taken from configuration (e.g. `?host=`). `null` when it is not a plain origin. */
export function parseHostOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    // `tauri:` is not a special scheme, so URL#origin is "null" for it; build the origin by hand.
    if (u.protocol === 'tauri:') return u.host ? `tauri://${u.host}` : null;
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function createBridge(options: BridgeOptions): Bridge {
  const {
    target,
    hostOrigin,
    self = window,
    host = window.parent,
    mode = 'preview',
    timeThrottleMs = 16,
    now = () => performance.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    captureErrors = true,
    getSceneId = () => null,
  } = options;

  if (mode === 'render') {
    const noop = () => {};
    return { ready: noop, time: noop, flushTime: noop, error: noop, hmr: noop, step: noop, done: noop, choice: noop, dispose: noop };
  }
  if (parseHostOrigin(hostOrigin) !== hostOrigin) throw new Error(`createBridge: invalid hostOrigin "${hostOrigin}"`);

  const post = (type: string, payload?: unknown) => host.postMessage({ v: BRIDGE_VERSION, type, payload }, hostOrigin);

  const error: Bridge['error'] = (e, sceneId = getSceneId()) => {
    const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : 'Unknown error');
    post('error', { message: err.message, stack: err.stack ?? '', sceneId } satisfies ErrorPayload);
  };

  // time throttling with a trailing edge
  let lastSent = -Infinity;
  let pending: TimePayload | null = null;
  let timer: unknown = null;
  const sendPending = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (!pending) return;
    post('time', pending);
    pending = null;
    lastSent = now();
  };

  const guard = (fn: () => void): void => {
    try {
      fn();
    } catch (e) {
      error(e);
    }
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== hostOrigin || event.source !== host) return;
    const parsed = HostMessage.safeParse(event.data);
    if (!parsed.success) return;
    const msg = parsed.data;
    switch (msg.type) {
      case 'init':
        return guard(() => target.init(msg.payload));
      case 'play':
        return guard(() => target.play());
      case 'pause':
        return guard(() => target.pause());
      case 'next':
        return guard(() => target.next());
      case 'prev':
        return guard(() => target.prev());
      case 'seek':
        return guard(() => target.seek(msg.payload.t));
      case 'setParams':
        return guard(() => target.setParams(msg.payload.sceneId, msg.payload.values));
      case 'goto':
        return guard(() => target.goto(msg.payload.sceneId));
      case 'setDesign':
        return guard(() => target.setDesign(msg.payload.colors));
      case 'capture': {
        const { scale, id } = msg.payload;
        target.capture(scale).then(
          (dataUrl) => post('captured', { dataUrl, scale, id } satisfies CapturedPayload),
          (e: unknown) => error(e),
        );
        return;
      }
      case 'reload':
        return guard(() => target.reload());
    }
  };

  const onWindowError = (e: ErrorEvent) => error(e.error ?? e.message);
  const onRejection = (e: PromiseRejectionEvent) => error(e.reason);
  self.addEventListener('message', onMessage);
  if (captureErrors) {
    self.addEventListener('error', onWindowError);
    self.addEventListener('unhandledrejection', onRejection);
  }

  return {
    ready: (payload) => post('ready', payload),
    time(t, sceneId) {
      pending = { t, sceneId };
      const wait = lastSent + timeThrottleMs - now();
      if (wait <= 0) sendPending();
      else if (timer === null) timer = setTimer(sendPending, wait);
    },
    flushTime: sendPending,
    error,
    hmr: (modules) => post('hmr', { modules: [...modules], at: Date.now() }),
    step: (index, total) => post('step', { index, total } satisfies StepPayload),
    done: () => post('done', {}),
    choice: (label) => post('choice', { label } satisfies ChoicePayload),
    dispose() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      pending = null;
      self.removeEventListener('message', onMessage);
      self.removeEventListener('error', onWindowError);
      self.removeEventListener('unhandledrejection', onRejection);
    },
  };
}

/** Report clock changes to the host: throttled `time` while running, an immediate one on pause/seek end. */
export function reportClock(bridge: Bridge, clock: Clock, getSceneId: () => string | null = () => null): () => void {
  const offTime = clock.subscribe(() => bridge.time(clock.getTime(), getSceneId()));
  const offPlaying = clock.subscribePlaying(() => bridge.flushTime());
  return () => {
    offTime();
    offPlaying();
  };
}

interface HotLike {
  on(event: 'vite:afterUpdate', cb: (payload: { updates: { path: string }[] }) => void): void;
}

/** Report which modules Vite has applied, so the host can detect a dropped update (S4). */
export function reportHmr(bridge: Bridge, hot: HotLike | undefined = import.meta.hot): void {
  hot?.on('vite:afterUpdate', (payload) => bridge.hmr(payload.updates.map((u) => u.path)));
}
