// Seeded randomness. Scenes in the clock contract may not call Math.random (check_scene), because a
// frame must be a pure function of t. Everything here is a pure function of (seed, index).
import { useMemo } from 'react';

/** Stateful PRNG (mulberry32). Use it inside `useMemo` or module scope, never in a render body. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a: turn a string seed into a 32-bit integer. Numbers pass through as integers. */
export function hashSeed(seed: number | string): number {
  if (typeof seed === 'number') return seed | 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

function mix(a: number): number {
  let t = (a + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export interface SeededRandom {
  readonly seed: number;
  /** Uniform value in [0, 1) for integer index `i`. Same seed and index always give the same value. */
  at(i: number): number;
  /** Uniform value in [min, max). */
  range(i: number, min: number, max: number): number;
  /** Integer in [min, max] (inclusive). */
  int(i: number, min: number, max: number): number;
  pick<T>(i: number, items: readonly T[]): T;
  /** First `n` values, `at(0)..at(n-1)`. */
  array(n: number): number[];
}

export function createSeededRandom(seed: number | string = 0): SeededRandom {
  const s = hashSeed(seed);
  const at = (i: number) => mix(s + Math.imul(i | 0, 0x9e3779b9));
  return {
    seed: s,
    at,
    range: (i, min, max) => min + at(i) * (max - min),
    int: (i, min, max) => min + Math.floor(at(i) * (max - min + 1)),
    pick: (i, items) => items[Math.floor(at(i) * items.length)],
    array: (n) => Array.from({ length: n }, (_, i) => at(i)),
  };
}

/** Stable per seed; safe to call in a render body because it holds no sequence state. */
export function useSeededRandom(seed: number | string = 0): SeededRandom {
  return useMemo(() => createSeededRandom(seed), [seed]);
}
