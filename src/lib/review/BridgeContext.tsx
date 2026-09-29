// Provider half of the Vanilla Bridge host: origin-pinned message receiver plus typed senders
// (Technical-Design section 5, D-021). `ready` may arrive again after every HMR remount or reload;
// each one restores the state the host owns (params, design override, playhead, play state) in the
// preview. Only the provider component lives here so react-refresh sees a component-only module;
// the value and hooks are in bridgeContextValue.ts.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BridgeContext,
  type BridgeContextValue,
  type BridgeEvent,
  type ParamsValues,
  type TimeStore,
} from './bridgeContextValue';
import {
  isTrustedSource,
  parseSceneMessage,
  withVersion,
  type CapturedInfo,
  type HostMessage,
  type ReadyInfo,
  type SceneError,
  type TimeInfo,
} from './bridgeProtocol';

const CAPTURE_TIMEOUT_MS = 10_000;

export interface BridgeProviderProps {
  /** Origin of the preview server, e.g. `http://127.0.0.1:5173`; `null` while no server runs. */
  previewOrigin: string | null;
  initialParamsValues?: ParamsValues;
  children: ReactNode;
}

interface PendingCapture {
  resolve: (c: CapturedInfo) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function BridgeInner({ previewOrigin, initialParamsValues, children }: BridgeProviderProps) {
  const frameRef = useRef<Window | null>(null);
  const originRef = useRef(previewOrigin);
  useEffect(() => {
    originRef.current = previewOrigin;
  }, [previewOrigin]);
  const paramsRef = useRef<ParamsValues>(initialParamsValues ?? {});
  const designRef = useRef<Record<string, string> | null>(null);
  const timeRef = useRef<TimeInfo>({ t: 0, sceneId: null });
  const timeListeners = useRef(new Set<() => void>());
  const listeners = useRef(new Set<(e: BridgeEvent) => void>());
  const pending = useRef(new Map<string, PendingCapture>());
  const captureSeq = useRef(0);
  const playingRef = useRef(false);

  const [ready, setReady] = useState<ReadyInfo | null>(null);
  const [readyCount, setReadyCount] = useState(0);
  const [error, setError] = useState<SceneError | null>(null);
  const [playing, setPlaying] = useState(false);

  const send = useCallback((msg: HostMessage) => {
    const origin = originRef.current;
    const frame = frameRef.current;
    if (!origin || !frame) return;
    frame.postMessage(withVersion(msg), origin);
  }, []);

  const setPlayingBoth = useCallback((p: boolean) => {
    playingRef.current = p;
    setPlaying(p);
  }, []);

  const timeStore = useMemo<TimeStore>(
    () => ({
      get: () => timeRef.current,
      subscribe: (l) => {
        timeListeners.current.add(l);
        return () => {
          timeListeners.current.delete(l);
        };
      },
    }),
    [],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedSource(event, originRef.current, frameRef.current)) return;
      const msg = parseSceneMessage(event.data);
      if (!msg) return;
      switch (msg.type) {
        case 'ready':
          // Restore what the host owns: params, design override, playhead, play state.
          send({ type: 'init', payload: { mode: 'preview', paramsValues: paramsRef.current } });
          if (designRef.current) send({ type: 'setDesign', payload: { colors: designRef.current } });
          if (timeRef.current.t > 0) send({ type: 'seek', payload: { t: timeRef.current.t } });
          if (playingRef.current) send({ type: 'play' });
          setReady(msg.payload);
          setReadyCount((n) => n + 1);
          setError(null);
          break;
        case 'time':
          timeRef.current = msg.payload;
          timeListeners.current.forEach((l) => l());
          break;
        case 'error':
          setError(msg.payload);
          if (msg.payload.message.startsWith('capture:')) {
            for (const [id, p] of pending.current) {
              clearTimeout(p.timer);
              p.reject(new Error(msg.payload.message));
              pending.current.delete(id);
            }
          }
          break;
        case 'captured': {
          const id = msg.payload.id;
          const p = id ? pending.current.get(id) : undefined;
          if (p && id) {
            clearTimeout(p.timer);
            pending.current.delete(id);
            p.resolve(msg.payload);
          }
          break;
        }
        case 'hmr':
          break;
      }
      listeners.current.forEach((l) => l(msg));
    };
    window.addEventListener('message', onMessage);
    const pendingCaptures = pending.current;
    return () => {
      window.removeEventListener('message', onMessage);
      for (const p of pendingCaptures.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('bridge closed'));
      }
      pendingCaptures.clear();
    };
  }, [send]);

  const value = useMemo<BridgeContextValue>(
    () => ({
      status: previewOrigin === null ? 'idle' : ready ? 'ready' : 'loading',
      ready,
      readyCount,
      error,
      registerFrame: (win) => {
        frameRef.current = win;
      },
      send,
      play: () => {
        setPlayingBoth(true);
        send({ type: 'play' });
      },
      pause: () => {
        setPlayingBoth(false);
        send({ type: 'pause' });
      },
      seek: (t) => {
        const at = Math.max(0, t);
        timeRef.current = { ...timeRef.current, t: at };
        timeListeners.current.forEach((l) => l());
        send({ type: 'seek', payload: { t: at } });
      },
      setParams: (sceneId, values) => send({ type: 'setParams', payload: { sceneId, values } }),
      goto: (sceneId) => send({ type: 'goto', payload: { sceneId } }),
      setDesign: (colors) => {
        designRef.current = colors;
        send({ type: 'setDesign', payload: { colors } });
      },
      reload: () => send({ type: 'reload' }),
      capture: (scale = 1) =>
        new Promise<CapturedInfo>((resolve, reject) => {
          const id = `cap-${++captureSeq.current}`;
          const timer = setTimeout(() => {
            pending.current.delete(id);
            reject(new Error('capture timeout'));
          }, CAPTURE_TIMEOUT_MS);
          pending.current.set(id, { resolve, reject, timer });
          send({ type: 'capture', payload: { scale, id } });
        }),
      setParamsValues: (values) => {
        paramsRef.current = values;
      },
      playing,
      subscribe: (l) => {
        listeners.current.add(l);
        return () => {
          listeners.current.delete(l);
        };
      },
      timeStore,
    }),
    [previewOrigin, ready, readyCount, error, send, playing, setPlayingBoth, timeStore],
  );

  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}

export function BridgeProvider({ previewOrigin, initialParamsValues, children }: BridgeProviderProps) {
  // A new server (new origin) starts from scratch: remounting clears ready/error/playhead.
  return (
    <BridgeInner
      key={previewOrigin ?? 'idle'}
      previewOrigin={previewOrigin}
      initialParamsValues={initialParamsValues}
    >
      {children}
    </BridgeInner>
  );
}
