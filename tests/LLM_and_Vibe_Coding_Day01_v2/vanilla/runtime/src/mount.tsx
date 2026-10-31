// Runtime bootstrap: clock, readiness, Bridge and the React root for a Composition. Independent of the
// Vite virtual modules (the caller passes the DesignProvider and the user param files), so it is testable.
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { clockTarget, createBridge, parseHostOrigin, reportClock, reportHmr, type Bridge, type BridgeTarget } from './bridge';
import { createClock, installHfSeek, parseClockMode, parseInitialTime, sceneAt, type Clock } from './clock';
import { App, type DesignProviderComponent } from './AppView';
import { createAppState } from './appState';
import { sceneStart, type Composition, type ParamsBySceneId } from './composition';
import { applyAndSettle, readiness } from './ready';
import { frameFromSearch, parseFrame, setFrame } from './frame';
import { captureDom } from './domCapture';
import { hostedSteps } from './steps';
import { hostedBridge, setHostedBridge } from './hostedBridge';

export interface MountOptions {
  /** File-backed provider (`DesignProvider` from `@vanilla/runtime/design`). */
  DesignProvider: DesignProviderComponent;
  /** Contents of `params/<sceneId>.values.json`, keyed by scene id. */
  paramsFiles?: ParamsBySceneId;
  root?: HTMLElement;
  /** Default `location.search`: `?mode=render|preview|live`, `?t=<sec>`, `?host=<origin>`. */
  search?: string;
  hmr?: Parameters<typeof reportHmr>[1];
}

/** A WebGL canvas is the frame itself; 2D canvases are usually decorative layers (grain, particles) inside a DOM scene. */
function isWebGl(canvas: HTMLCanvasElement): boolean {
  return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
}

/** PNG of the WebGL canvas at the current time; every other scene is rasterized from the page itself. */
function captureCanvas(clock: Clock, scale: number): Promise<string> {
  const canvas = Array.from(document.querySelectorAll('canvas')).find(isWebGl);
  if (!canvas) return captureDom(scale);
  // Draw and read in the same task: without preserveDrawingBuffer the buffer is cleared after compositing.
  clock.redraw();
  if (scale === 1) return Promise.resolve(canvas.toDataURL('image/png'));
  const out = document.createElement('canvas');
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext('2d');
  if (!ctx) return Promise.reject(new Error('capture: 2d context unavailable'));
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return Promise.resolve(out.toDataURL('image/png'));
}

// Remounting after a hot update (main.tsx accepts `./composition`) keeps the playhead where it was.
let carriedTime: number | null = null;

/** Mount the composition. Returns a function that tears everything down. */
export function mountVanilla(composition: Composition, options: MountOptions): () => void {
  const search = options.search ?? window.location.search;
  const container = options.root ?? document.getElementById('root');
  if (!container) throw new Error('mountVanilla: #root not found');

  const hostOrigin = parseHostOrigin(new URLSearchParams(search).get('host'));
  const mode = parseClockMode(search, composition.time === 'free' ? 'live' : 'preview');
  const initialTime = parseInitialTime(search);
  // Opened straight in a browser (no host, not a capture): just play it.
  const autoplay = mode === 'live' || (mode === 'preview' && hostOrigin === null && initialTime === null);
  const clock = createClock({ mode, duration: composition.clockDuration, autoplay });
  if (carriedTime !== null && mode !== 'render' && initialTime === null) clock.seek(carriedTime);
  carriedTime = null;
  // 화면 규격: 직접 열 때는 ?w=&h=&fps=, 호스트가 있으면 Bridge init의 canvas가 덮는다(D-030).
  const searchFrame = frameFromSearch(search);
  if (searchFrame) setFrame(searchFrame);
  const state = createAppState(options.paramsFiles ?? {});
  const sceneIdAt = () => (composition.layout === 'timeline' ? (sceneAt(composition.segments, clock.getTime())?.segment.id ?? null) : null);

  let alive = true;
  const cleanups: (() => void)[] = [
    () => {
      alive = false;
      if (mode !== 'render') carriedTime = clock.getTime();
    },
  ];
  let bridge: Bridge | null = null;
  if (mode === 'render') {
    cleanups.push(installHfSeek(clock, () => readiness.ready()));
  } else if (hostOrigin) {
    const target: BridgeTarget = {
      ...clockTarget(clock),
      init: (payload) => {
        state.mergeAll(payload.paramsValues);
        const frame = payload.canvas && parseFrame(payload.canvas);
        if (frame) setFrame(frame);
      },
      next: () => hostedSteps()?.next(),
      prev: () => hostedSteps()?.prev(),
      // v2.1 typed input delegation: re-dispatch inside the scene tree so both the
      // step controller (advance-respecting, via its window listeners) and the
      // scene's own shortcut handlers (e.g. notes, fullscreen keys) see the input.
      // Unrelated keys never advance the page (issue: every key acted as next).
      input: (raw) => {
        const peer: { kind: 'click' } | { kind: 'key'; key: string } = raw.kind === 'click' ? { kind: 'click' } : { kind: 'key', key: raw.key };
        if (peer.kind === 'click') {
          container.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        } else {
          container.dispatchEvent(new KeyboardEvent('keydown', { key: peer.key, bubbles: true, cancelable: true }));
        }
      },
      setParams: (id, values) => state.mergeParams(id, values),
      goto(sceneId) {
        const start = sceneStart(composition, sceneId);
        if (start !== null) clock.seek(start);
        else document.querySelector(`[data-scene="${CSS.escape(sceneId)}"]`)?.scrollIntoView();
      },
      setDesign: (colors) => state.setOverride(colors),
      capture: (scale) => captureCanvas(clock, scale),
      reload: () => window.location.reload(),
    };
    const b = createBridge({ target, hostOrigin, mode, getSceneId: sceneIdAt });
    bridge = b;
    setHostedBridge(b);
    cleanups.push(reportClock(b, clock, sceneIdAt), () => {
      if (hostedBridge() === b) setHostedBridge(null);
      b.dispose();
    });
    // Vite listeners cannot be removed, so a torn-down mount must stay quiet.
    reportHmr({ ...b, hmr: (modules) => alive && b.hmr(modules) }, options.hmr);
  }

  const root = createRoot(container);
  cleanups.push(() => root.unmount(), () => clock.dispose());
  flushSync(() =>
    root.render(
      <StrictMode>
        <App composition={composition} clock={clock} state={state} DesignProvider={options.DesignProvider} bridge={bridge} />
      </StrictMode>,
    ),
  );
  // Stills and video: settle at the requested time so `__vanillaReady` is raised (S2).
  if (mode === 'render' || initialTime !== null) void applyAndSettle(clock, readiness, initialTime ?? 0);

  return () => cleanups.reverse().forEach((c) => c());
}
