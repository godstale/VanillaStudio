// Keyframe timeline: a pure function of t, so the same t always yields the same value.
import { ease, lerp, type EaseName } from './ease';

export interface Keyframe {
  /** Seconds. */
  t: number;
  v: number;
  /** Easing applied from this key to the next one (CSS-style; default linear). */
  ease?: EaseName | ((x: number) => number);
}

export function timeline(keys: readonly Keyframe[]): (t: number) => number {
  if (keys.length === 0) throw new Error('timeline: at least one keyframe is required');
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return (t) => {
    if (t <= first.t) return first.v;
    if (t >= last.t) return last.v;
    let i = 0;
    while (sorted[i + 1].t <= t) i++;
    const a = sorted[i];
    const b = sorted[i + 1];
    const fn = typeof a.ease === 'function' ? a.ease : ease[a.ease ?? 'linear'];
    return lerp(a.v, b.v, fn((t - a.t) / (b.t - a.t)));
  };
}
