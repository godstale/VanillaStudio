// Timeline math for the review scrubber (T4.13). Pure functions over the Bridge `ready` payload:
// scenes sit back to back (untimed slides/image scenes are one step each, like the runtime
// composition), so Scene boundaries, the total length and time labels all derive from here.
import type { SceneMeta } from './bridgeProtocol';

export interface TimelineSegment {
  id: string;
  start: number;
  end: number;
}

export interface Timeline {
  segments: TimelineSegment[];
  /** Seconds the clock clamps to (`ready.duration`, or the step count for untimed scenes). */
  length: number;
  /** True when scenes have no durations: the scrubber moves in whole steps. */
  stepped: boolean;
}

export function layoutTimeline(
  scenes: readonly Pick<SceneMeta, 'id' | 'duration'>[],
  totalDuration?: number,
): Timeline {
  const segments: TimelineSegment[] = [];
  let t = 0;
  for (const s of scenes) {
    const d = s.duration ?? 1;
    segments.push({ id: s.id, start: t, end: t + d });
    t += d;
  }
  return { segments, length: totalDuration ?? t, stepped: totalDuration === undefined };
}

/** Index of the segment playing at `t` (the last one whose start is at or before `t`). */
export function segmentIndexAt(segments: readonly TimelineSegment[], t: number): number {
  let at = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].start <= t) at = i;
    else break;
  }
  return at;
}

/** `m:ss:ff` at `fps` frames per second (frame wraps at `fps`, negatives clamp to zero). */
export function formatTime(t: number, fps: number): string {
  const frames = Math.max(0, Math.round(t * fps));
  const ff = frames % fps;
  const totalSec = Math.floor(frames / fps);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${m}:${pad(s)}:${pad(ff)}`;
}
