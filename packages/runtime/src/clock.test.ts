import { act, createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ClockProvider,
  SceneTimeProvider,
  activeAt,
  createClock,
  installHfSeek,
  layoutSegments,
  parseClockMode,
  parseInitialTime,
  sceneAt,
  toGlobalTime,
  toLocalTime,
  totalDuration,
  transitionAt,
  useGlobalTime,
  useTime,
  type ClockOptions,
} from './clock';

/** Manual frame loop so playback is driven by test-controlled time. */
function manual() {
  let now = 0;
  let cb: (() => void) | null = null;
  return {
    opts: {
      now: () => now,
      requestFrame: (f: () => void) => {
        cb = f;
        return 1;
      },
      cancelFrame: () => {
        cb = null;
      },
    } satisfies Partial<ClockOptions>,
    step(ms: number) {
      now += ms;
      const f = cb;
      cb = null;
      f?.();
    },
    pending: () => cb !== null,
  };
}

describe('time conversion', () => {
  const segs = layoutSegments([
    { id: 'a', duration: 4 },
    { id: 'b', duration: 3, overlap: 1 },
    { id: 'c', duration: 2 },
  ]);

  it('lays scenes out back to back with optional overlap', () => {
    expect(segs.map((s) => [s.id, s.start])).toEqual([['a', 0], ['b', 3], ['c', 6]]);
    expect(totalDuration(segs)).toBe(8);
  });

  it('converts between global and local time', () => {
    expect(toLocalTime(5, 3)).toBe(2);
    expect(toGlobalTime(2, 3)).toBe(5);
  });

  it('finds the active scene, including boundaries and the final instant', () => {
    expect(sceneAt(segs, 0)).toMatchObject({ index: 0, local: 0 });
    expect(sceneAt(segs, 2.9)?.segment.id).toBe('a');
    expect(sceneAt(segs, 6)).toMatchObject({ index: 2, local: 0 });
    expect(sceneAt(segs, 8)).toMatchObject({ index: 2, local: 2 });
    expect(sceneAt(segs, 8.01)).toBeNull();
    expect(sceneAt(segs, -0.01)).toBeNull();
  });

  it('reports overlapping scenes and transition progress', () => {
    expect(activeAt(segs, 3.5).map((a) => a.segment.id)).toEqual(['a', 'b']);
    expect(transitionAt(segs, 3.5)?.progress).toBeCloseTo(0.5);
    expect(transitionAt(segs, 2)).toBeNull();
  });
});

describe('createClock', () => {
  it('preview: seek clamps to the duration and notifies subscribers and renderers', () => {
    const clock = createClock({ mode: 'preview', duration: 10 });
    const listener = vi.fn();
    const renderer = vi.fn();
    clock.subscribe(listener);
    clock.registerRenderer(renderer);
    clock.seek(4);
    clock.seek(99);
    clock.seek(-3);
    expect(renderer.mock.calls.map((c) => c[0])).toEqual([4, 10, 0]);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('preview: plays with the injected time source and stops at the end', () => {
    const m = manual();
    const clock = createClock({ mode: 'preview', duration: 1, ...m.opts });
    const playing = vi.fn();
    clock.subscribePlaying(playing);
    clock.play();
    m.step(400);
    expect(clock.getTime()).toBeCloseTo(0.4);
    m.step(400);
    expect(clock.getTime()).toBeCloseTo(0.8);
    m.step(400);
    expect(clock.getTime()).toBe(1);
    expect(clock.isPlaying()).toBe(false);
    expect(m.pending()).toBe(false);
    expect(playing).toHaveBeenCalledTimes(2);
    // Playing again after the end restarts from 0.
    clock.play();
    expect(clock.getTime()).toBe(0);
  });

  it('pause stops the frame loop', () => {
    const m = manual();
    const clock = createClock({ mode: 'preview', ...m.opts });
    clock.play();
    m.step(100);
    clock.pause();
    expect(m.pending()).toBe(false);
    expect(clock.getTime()).toBeCloseTo(0.1);
  });

  it('live: autoplays, ignores seek, honours pause', () => {
    const m = manual();
    const clock = createClock({ mode: 'live', ...m.opts });
    expect(clock.isPlaying()).toBe(true);
    clock.seek(50);
    expect(clock.getTime()).toBe(0);
    m.step(250);
    expect(clock.getTime()).toBeCloseTo(0.25);
    clock.pause();
    expect(clock.isPlaying()).toBe(false);
  });

  it('render: never advances by itself', () => {
    const m = manual();
    const clock = createClock({ mode: 'render', ...m.opts });
    clock.play();
    expect(clock.isPlaying()).toBe(false);
    expect(m.pending()).toBe(false);
    clock.seek(2);
    expect(clock.getTime()).toBe(2);
  });

  it('reports a renderer error to onError without stopping playback', () => {
    const m = manual();
    const onError = vi.fn();
    const clock = createClock({ mode: 'preview', onError, ...m.opts });
    clock.registerRenderer(() => {
      throw new Error('boom');
    });
    clock.play();
    m.step(16);
    expect(onError).toHaveBeenCalledOnce();
    expect(m.pending()).toBe(true);
  });
});

describe('hf-seek (render mode)', () => {
  function dispatchSeek(target: EventTarget, time: number) {
    let waited: Promise<unknown> | null = null;
    target.dispatchEvent(new CustomEvent('hf-seek', { detail: { time, waitUntil: (p: Promise<unknown>) => (waited = p) } }));
    return waited as Promise<unknown> | null;
  }

  it('calls waitUntil synchronously and applies the time only after the scene is ready', async () => {
    const target = new EventTarget();
    const clock = createClock({ mode: 'render' });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    installHfSeek(clock, () => gate, target);
    const waited = dispatchSeek(target, 1.5);
    expect(waited).not.toBeNull();
    expect(clock.getTime()).toBe(0);
    release();
    await waited;
    expect(clock.getTime()).toBe(1.5);
  });

  it('same t gives the same clock state regardless of the seek order', async () => {
    const ts = [0, 0.4, 2.2, 0.4, 3];
    const results: number[][] = [];
    for (const order of [ts, [...ts].reverse()]) {
      const target = new EventTarget();
      const clock = createClock({ mode: 'render' });
      installHfSeek(clock, () => Promise.resolve(), target);
      const seen = new Map<number, number>();
      for (const t of order) {
        await dispatchSeek(target, t);
        seen.set(t, clock.getTime());
      }
      results.push([...seen.keys()].sort((a, b) => a - b).map((k) => seen.get(k)!));
    }
    expect(results[0]).toEqual(results[1]);
  });

  it('commits the DOM synchronously when the seek promise settles', async () => {
    const target = new EventTarget();
    const clock = createClock({ mode: 'render' });
    installHfSeek(clock, () => Promise.resolve(), target);
    function Probe() {
      return createElement('output', null, `t=${useTime().toFixed(2)}`);
    }
    render(createElement(ClockProvider, { clock }, createElement(SceneTimeProvider, { start: 3 }, createElement(Probe))));
    expect(screen.getByRole('status').textContent).toBe('t=-3.00');
    const waited = dispatchSeek(target, 5);
    await act(async () => {
      await waited;
    });
    expect(screen.getByRole('status').textContent).toBe('t=2.00');
  });
});

describe('hooks', () => {
  it('useGlobalTime follows the clock', () => {
    const clock = createClock({ mode: 'preview' });
    function Probe() {
      return createElement('output', null, String(useGlobalTime()));
    }
    render(createElement(ClockProvider, { clock }, createElement(Probe)));
    act(() => clock.seek(1.25));
    expect(screen.getByRole('status').textContent).toBe('1.25');
  });
});

describe('url helpers', () => {
  it('parses mode and initial time defensively', () => {
    expect(parseClockMode('?mode=render', 'preview')).toBe('render');
    expect(parseClockMode('?mode=x', 'live')).toBe('live');
    expect(parseInitialTime('?t=3.2')).toBe(3.2);
    expect(parseInitialTime('?t=abc')).toBeNull();
    expect(parseInitialTime('?t=-1')).toBeNull();
    expect(parseInitialTime('')).toBeNull();
  });
});
