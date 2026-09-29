import { createElement } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClockProvider, createClock } from '../clock';
import { clamp01, ease, remap, smoothstep, type EaseName } from './ease';
import { FIXED_INPUT, createInputSource, useInput } from './input';
import { noise2D, noise3D } from './noise';
import { createSeededRandom, hashSeed, mulberry32, useSeededRandom } from './random';
import { timeline } from './timeline';

describe('seeded random', () => {
  it('same seed gives the same values; different seeds differ', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    expect(a.array(50)).toEqual(b.array(50));
    expect(createSeededRandom(43).array(50)).not.toEqual(a.array(50));
  });

  it('is independent of call order', () => {
    const r = createSeededRandom('scene-1');
    const forward = [0, 1, 2, 3].map((i) => r.at(i));
    const backward = [3, 2, 1, 0].map((i) => r.at(i)).reverse();
    expect(backward).toEqual(forward);
  });

  it('stays in range and roughly uniform', () => {
    const r = createSeededRandom(7);
    const v = r.array(10000);
    expect(v.every((x) => x >= 0 && x < 1)).toBe(true);
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
    for (let i = 0; i < 200; i++) {
      expect(r.range(i, -2, 3)).toBeGreaterThanOrEqual(-2);
      expect(r.range(i, -2, 3)).toBeLessThan(3);
      const n = r.int(i, 1, 6);
      expect(Number.isInteger(n) && n >= 1 && n <= 6).toBe(true);
    }
    expect(['a', 'b', 'c']).toContain(r.pick(5, ['a', 'b', 'c']));
  });

  it('hashes string seeds stably and mulberry32 replays', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
    const a = mulberry32(1);
    const b = mulberry32(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('useSeededRandom returns the same values on every render of the same seed', () => {
    const seen: number[][] = [];
    function Probe() {
      seen.push(useSeededRandom(9).array(3));
      return null;
    }
    const { rerender } = render(createElement(Probe));
    rerender(createElement(Probe));
    expect(seen[0]).toEqual(seen[1]);
  });
});

describe('noise', () => {
  it('is deterministic per seed and bounded', () => {
    for (let i = 0; i < 300; i++) {
      const x = i * 0.137;
      const y = i * 0.291;
      expect(noise2D(x, y, 5)).toBe(noise2D(x, y, 5));
      expect(noise3D(x, y, i * 0.05, 5)).toBe(noise3D(x, y, i * 0.05, 5));
      expect(Math.abs(noise3D(x, y, i * 0.05, 5))).toBeLessThanOrEqual(1);
    }
    expect(noise2D(3.3, 1.7, 1)).not.toBe(noise2D(3.3, 1.7, 2));
  });

  it('is zero at lattice points and continuous', () => {
    expect(noise2D(2, 3, 0)).toBeCloseTo(0, 10);
    let maxStep = 0;
    for (let i = 0; i < 1000; i++) maxStep = Math.max(maxStep, Math.abs(noise2D(i * 0.01 + 0.5, 0.5, 3) - noise2D((i + 1) * 0.01 + 0.5, 0.5, 3)));
    expect(maxStep).toBeLessThan(0.1);
  });

  it('varies (not constant)', () => {
    const values = Array.from({ length: 200 }, (_, i) => noise2D(i * 0.37 + 0.11, i * 0.23 + 0.07, 0));
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5);
  });
});

describe('ease and helpers', () => {
  it('every easing starts at 0, ends at 1 and clamps outside', () => {
    for (const name of Object.keys(ease) as EaseName[]) {
      expect(ease[name](0)).toBeCloseTo(0, 6);
      expect(ease[name](1)).toBeCloseTo(1, 6);
      expect(ease[name](-1)).toBe(0);
      expect(ease[name](2)).toBe(1);
    }
  });

  it('matches known midpoints', () => {
    expect(ease.linear(0.25)).toBe(0.25);
    expect(ease.quadInOut(0.5)).toBeCloseTo(0.5);
    expect(ease.expoOut(0.5)).toBeCloseTo(1 - 2 ** -5);
    expect(ease.cubicOut(0.5)).toBeCloseTo(0.875);
  });

  it('clamp01, remap, smoothstep', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(3)).toBe(1);
    expect(remap(5, 0, 10, 100, 200)).toBe(150);
    expect(remap(1, 2, 2, 7, 9)).toBe(7);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });
});

describe('timeline', () => {
  const f = timeline([
    { t: 2, v: 10, ease: 'quadIn' },
    { t: 0, v: 0 },
    { t: 4, v: 20 },
  ]);

  it('interpolates between keys, sorted by time', () => {
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(5);
    expect(f(2)).toBe(10);
    expect(f(3)).toBeCloseTo(10 + 10 * 0.25);
    expect(f(4)).toBe(20);
  });

  it('holds the first and last value outside the range', () => {
    expect(f(-5)).toBe(0);
    expect(f(99)).toBe(20);
  });

  it('is a pure function of t and accepts custom easing', () => {
    const g = timeline([{ t: 0, v: 0, ease: (x) => x * x }, { t: 1, v: 1 }]);
    expect([g(0.5), g(0.5)]).toEqual([0.25, 0.25]);
    expect(() => timeline([])).toThrow();
  });
});

describe('input', () => {
  it('tracks pointer, keys and scroll while subscribed, then resets', () => {
    const src = createInputSource(window);
    const un = src.subscribe(() => {});
    Object.defineProperty(window, 'innerWidth', { value: 200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 100, configurable: true });
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 50 }));
    window.dispatchEvent(new MouseEvent('pointerdown'));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    const s = src.getSnapshot();
    expect(s.pointer).toEqual({ x: 0.25, y: 0.5, down: true });
    expect(s.keys).toEqual(['KeyA', 'KeyB']);
    un();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 10 }));
    expect(src.getSnapshot()).toBe(FIXED_INPUT);
  });

  it('is fixed in render mode regardless of events', () => {
    const clock = createClock({ mode: 'render' });
    function Probe() {
      return createElement('output', null, String(useInput().pointer.x));
    }
    render(createElement(ClockProvider, { clock }, createElement(Probe)));
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }));
    });
    expect(screen.getByRole('status').textContent).toBe('0.5');
  });

  it('follows real events outside render mode', () => {
    const clock = createClock({ mode: 'preview' });
    function Probe() {
      return createElement('output', null, String(useInput().pointer.down));
    }
    render(createElement(ClockProvider, { clock }, createElement(Probe)));
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerdown'));
    });
    expect(screen.getByRole('status').textContent).toBe('true');
  });
});
