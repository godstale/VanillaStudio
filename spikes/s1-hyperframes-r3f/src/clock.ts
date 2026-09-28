// Minimal stand-in for @vanilla/runtime's clock: time is injected, never read from the wall clock.
import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { advance } from '@react-three/fiber';

type Listener = () => void;

let current = 0;
const listeners = new Set<Listener>();

// R3F creates its renderer asynchronously (after measuring the canvas), so the first
// hf-seek of a fresh capture worker can arrive before there is anything to draw.
let resolveScene!: () => void;
const sceneMounted = new Promise<void>((r) => (resolveScene = r));
const sceneReady = Promise.all([sceneMounted, document.fonts.ready]);

export function markSceneReady() {
  resolveScene();
}

function emit() {
  listeners.forEach((l) => l());
}

export function getTime() {
  return current;
}

export function setTime(t: number) {
  current = t;
  // DOM layer must be committed before HyperFrames screenshots the frame.
  flushSync(emit);
  // R3F uses frameloop="never": render the WebGL layer synchronously for this t.
  advance(t * 1000);
}

export function useTime() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getTime,
  );
}

interface HfSeekDetail {
  time: number;
  waitUntil: (p: Promise<unknown>) => void;
}

export function installClock() {
  // Render mode: HyperFrames dispatches hf-seek for every captured frame.
  window.addEventListener('hf-seek', (e) => {
    const { time, waitUntil } = (e as CustomEvent<HfSeekDetail>).detail;
    // waitUntil must be called synchronously; the capture waits until the frame is drawn.
    waitUntil(sceneReady.then(() => setTime(time)));
  });

  const params = new URLSearchParams(location.search);
  const fixed = params.get('t');
  if (fixed !== null) {
    // Still capture / debugging: ?t=3.2
    requestAnimationFrame(() => setTime(Number(fixed)));
  } else if (params.has('play')) {
    // Manual preview only; never used in render mode.
    const start = performance.now();
    const loop = () => {
      setTime(((performance.now() - start) / 1000) % 15);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else {
    requestAnimationFrame(() => setTime(0));
  }
}
