import { act, render } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ClockProvider, createClock, useTime } from './clock';
import { CompositionView } from './CompositionView';
import { defineComposition, sceneStart } from './composition';
import { DesignContextProvider } from './design/provider';
import { param, token, useParams } from './params';
import { clearScenes, defineScene } from './scene';
import type { Design } from './design/types';

beforeEach(() => clearScenes());

const design: Design = { colors: { canvas: '#111111', accent: '#FF5500' }, typography: {}, spacing: {}, rounded: {}, hash: 'h' };

const params = { tint: param.color(token('accent'), { fallback: '#000000' }) };

function Probe({ id }: { id: string }) {
  const t = useTime();
  const { tint } = useParams<typeof params>();
  return createElement('output', { 'data-probe': id }, `${id}:${t.toFixed(1)}:${tint}`);
}

const scene = (id: string, duration?: number) => defineScene({ id, duration, params, Component: () => createElement(Probe, { id }) });

describe('defineComposition', () => {
  it('lays timed scenes out back to back and reports the total', () => {
    const c = defineComposition({ scenes: [scene('a', 2), { scene: scene('b', 3), overlap: 0.5 }] });
    expect(c.segments).toEqual([
      { id: 'a', start: 0, duration: 2 },
      { id: 'b', start: 1.5, duration: 3 },
    ]);
    expect(c.duration).toBe(4.5);
    expect(sceneStart(c, 'b')).toBe(1.5);
    expect(sceneStart(c, 'zzz')).toBeNull();
  });

  it('gives untimed (slide) scenes one step each and no duration', () => {
    const c = defineComposition({ scenes: [scene('s1'), scene('s2'), scene('s3')] });
    expect(c.duration).toBeUndefined();
    expect(c.clockDuration).toBe(3);
    expect(sceneStart(c, 's3')).toBe(2);
  });

  it('sections layout has no timeline', () => {
    const c = defineComposition({ scenes: [scene('a', 2)], layout: 'sections', time: 'free' });
    expect(c.duration).toBeUndefined();
    expect(c.clockDuration).toBeUndefined();
  });

  it('rejects empty and duplicate compositions', () => {
    expect(() => defineComposition({ scenes: [] })).toThrow(/at least one/);
    expect(() => defineComposition({ scenes: [scene('a', 1), scene('a', 1)] })).toThrow(/duplicate/);
  });
});

function view(c: ReturnType<typeof defineComposition>, user = {}) {
  const clock = createClock({ mode: 'preview' });
  const r = render(
    createElement(
      ClockProvider,
      { clock },
      createElement(DesignContextProvider, { file: design }, createElement(CompositionView, { composition: c, params: user })),
    ),
  );
  return { clock, ...r };
}

describe('CompositionView', () => {
  it('shows the scene at the playhead with scene-local time and token-resolved params', () => {
    const c = defineComposition({ scenes: [scene('a', 2), scene('b', 2)] });
    const { clock, container } = view(c);
    expect(container.textContent).toBe('a:0.0:#FF5500');
    act(() => clock.seek(2.5));
    expect(container.textContent).toBe('b:0.5:#FF5500');
  });

  it('user values beat the token', () => {
    const c = defineComposition({ scenes: [scene('a', 2)] });
    const { container } = view(c, { a: { tint: '#00FF00' } });
    expect(container.textContent).toBe('a:0.0:#00FF00');
  });

  it('crossfades during an overlap', () => {
    const c = defineComposition({ scenes: [scene('a', 2), { scene: scene('b', 2), overlap: 1 }] });
    const { clock, container } = view(c);
    act(() => clock.seek(1.5));
    const layers = [...container.querySelectorAll<HTMLElement>('[data-scene]')];
    expect(layers.map((l) => l.dataset.scene)).toEqual(['a', 'b']);
    expect(layers[0].style.opacity).toBe('1');
    expect(layers[1].style.opacity).toBe('0.5');
  });

  it('sections layout renders every scene at local time 0', () => {
    const c = defineComposition({ scenes: [scene('a', 2), scene('b', 2)], layout: 'sections', time: 'free' });
    const { container } = view(c);
    expect([...container.querySelectorAll('output')].map((o) => o.textContent)).toEqual(['a:0.0:#FF5500', 'b:0.0:#FF5500']);
  });
});
