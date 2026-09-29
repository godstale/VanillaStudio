// useInput(): pointer / keys / scroll / device tilt. In render mode the value is fixed, so exported
// frames never depend on whoever happened to move the mouse.
import { useSyncExternalStore } from 'react';
import { useClock } from '../clock';

export interface InputState {
  /** Normalised 0..1 across the viewport. */
  pointer: { x: number; y: number; down: boolean };
  /** `KeyboardEvent.code` of the keys currently held, sorted. */
  keys: readonly string[];
  scroll: { x: number; y: number };
  /** Device orientation in degrees. */
  tilt: { alpha: number; beta: number; gamma: number };
}

export const FIXED_INPUT: InputState = Object.freeze({
  pointer: Object.freeze({ x: 0.5, y: 0.5, down: false }),
  keys: Object.freeze([] as string[]),
  scroll: Object.freeze({ x: 0, y: 0 }),
  tilt: Object.freeze({ alpha: 0, beta: 0, gamma: 0 }),
}) as InputState;

export interface InputSource {
  getSnapshot(): InputState;
  subscribe(listener: () => void): () => void;
}

/** Listeners attach on the first subscriber and detach with the last. */
export function createInputSource(target: Window = window): InputSource {
  let state: InputState = FIXED_INPUT;
  const held = new Set<string>();
  const listeners = new Set<() => void>();
  const update = (patch: Partial<InputState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const norm = (v: number, size: number) => (size > 0 ? Math.min(1, Math.max(0, v / size)) : 0);
  const on: [string, (e: never) => void][] = [
    ['pointermove', (e: PointerEvent) => update({ pointer: { ...state.pointer, x: norm(e.clientX, target.innerWidth), y: norm(e.clientY, target.innerHeight) } })],
    ['pointerdown', () => update({ pointer: { ...state.pointer, down: true } })],
    ['pointerup', () => update({ pointer: { ...state.pointer, down: false } })],
    [
      'keydown',
      (e: KeyboardEvent) => {
        held.add(e.code);
        update({ keys: [...held].sort() });
      },
    ],
    [
      'keyup',
      (e: KeyboardEvent) => {
        held.delete(e.code);
        update({ keys: [...held].sort() });
      },
    ],
    ['scroll', () => update({ scroll: { x: target.scrollX, y: target.scrollY } })],
    [
      'deviceorientation',
      (e: DeviceOrientationEvent) => update({ tilt: { alpha: e.alpha ?? 0, beta: e.beta ?? 0, gamma: e.gamma ?? 0 } }),
    ],
  ];
  return {
    getSnapshot: () => state,
    subscribe(l) {
      if (listeners.size === 0) for (const [name, fn] of on) target.addEventListener(name, fn as EventListener, { passive: true });
      listeners.add(l);
      return () => {
        listeners.delete(l);
        if (listeners.size === 0) {
          for (const [name, fn] of on) target.removeEventListener(name, fn as EventListener);
          held.clear();
          state = FIXED_INPUT;
        }
      };
    },
  };
}

let shared: InputSource | null = null;
const noop = () => () => {};

export function useInput(): InputState {
  const { mode } = useClock();
  const fixed = mode === 'render';
  const source = fixed ? null : (shared ??= createInputSource());
  return useSyncExternalStore(
    source ? source.subscribe : noop,
    source ? source.getSnapshot : () => FIXED_INPUT,
    () => FIXED_INPUT,
  );
}
