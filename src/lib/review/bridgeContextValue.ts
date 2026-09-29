// Value half of the Vanilla Bridge host (Technical-Design section 5, D-021). Kept in a component-free
// module so react-refresh treats it as hooks-only; the provider lives in BridgeContext.tsx.
import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type {
  CapturedInfo,
  HostMessage,
  ReadyInfo,
  SceneError,
  SceneMessage,
  TimeInfo,
} from './bridgeProtocol';

export type BridgeEvent = SceneMessage;
export type ParamsValues = Record<string, Record<string, unknown>>;

export interface TimeStore {
  get: () => TimeInfo;
  subscribe: (l: () => void) => () => void;
}

export interface BridgeContextValue {
  /** `loading` until the first `ready`; `ready` afterwards (also across remounts). */
  status: 'idle' | 'loading' | 'ready';
  ready: ReadyInfo | null;
  /** Number of `ready` messages received; changes on every remount. */
  readyCount: number;
  /** Latest scene error (cleared by the next `ready`). */
  error: SceneError | null;
  /** The preview iframe window; the Preview component registers it. */
  registerFrame: (win: Window | null) => void;
  send: (msg: HostMessage) => void;
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  setParams: (sceneId: string, values: Record<string, unknown>) => void;
  goto: (sceneId: string) => void;
  /** `null` clears the preview-only override. */
  setDesign: (colors: Record<string, string> | null) => void;
  reload: () => void;
  capture: (scale?: number) => Promise<CapturedInfo>;
  /** Param values the host holds; sent with `init` after every `ready`. */
  setParamsValues: (values: ParamsValues) => void;
  playing: boolean;
  subscribe: (listener: (e: BridgeEvent) => void) => () => void;
  /** Latest `time` message; changes ~60 times a second, so read it through `useBridgeTime`. */
  timeStore: TimeStore;
}

export const BridgeContext = createContext<BridgeContextValue | null>(null);

export function useBridge(): BridgeContextValue {
  const v = useContext(BridgeContext);
  if (!v) throw new Error('useBridge must be used inside BridgeProvider');
  return v;
}

/** Playhead position; re-renders on every `time` message. */
export function useBridgeTime(): TimeInfo {
  const { timeStore } = useBridge();
  return useSyncExternalStore(timeStore.subscribe, timeStore.get);
}

/** Call `listener` for every trusted scene message. */
export function useBridgeEvents(listener: (e: BridgeEvent) => void): void {
  const { subscribe } = useBridge();
  const ref = useRef(listener);
  useEffect(() => {
    ref.current = listener;
  }, [listener]);
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}
