import { act } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComposition } from './composition';
import { DesignContextProvider } from './design/provider';
import { mountVanilla } from './mount';
import { param, useParams } from './params';
import { clearScenes, defineScene } from './scene';
import type { Design } from './design/types';
import type { ReactNode } from 'react';
import type { Colors } from './design/types';

const design: Design = { colors: { canvas: '#111111', accent: '#FF5500' }, typography: {}, spacing: {}, rounded: {}, hash: 'h1' };
const DesignProvider = ({ override, children }: { override?: Colors | null; children?: ReactNode }) =>
  createElement(DesignContextProvider, { file: design, override }, children);

const HOST = 'http://127.0.0.1:1430';
const params = { label: param.text('hi') };
function Label() {
  return createElement('output', null, useParams<typeof params>().label);
}

let root: HTMLElement;
let posted: { type: string; payload?: unknown }[];
let unmount: () => void;

beforeEach(() => {
  clearScenes();
  root = document.body.appendChild(document.createElement('div'));
  posted = [];
  vi.spyOn(window, 'postMessage').mockImplementation(((msg: { type: string; payload?: unknown }) => {
    posted.push(msg);
  }) as typeof window.postMessage);
});
afterEach(() => {
  unmount?.();
  root.remove();
  vi.restoreAllMocks();
});

const send = (data: unknown) =>
  act(async () => {
    window.dispatchEvent(new MessageEvent('message', { data, origin: HOST, source: window }));
  });

const composition = () =>
  defineComposition({
    scenes: [
      defineScene({ id: 'a', duration: 2, params, Component: Label }),
      defineScene({ id: 'b', duration: 3, params, Component: Label }),
    ],
    format: { width: 1920, height: 1080 },
  });

describe('mountVanilla', () => {
  it('reports ready to the host with scenes, duration, format and design', async () => {
    unmount = mountVanilla(composition(), { DesignProvider, root, search: `?host=${encodeURIComponent(HOST)}` });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    const ready = posted.find((m) => m.type === 'ready')?.payload as { scenes: { id: string }[]; duration: number; format: string; design: { hash: string; roles: Colors } };
    expect(ready.scenes.map((s) => s.id)).toEqual(['a', 'b']);
    expect(ready.duration).toBe(5);
    expect(ready.format).toBe('1920x1080');
    expect(ready.design.hash).toBe('h1');
    expect(ready.design.roles.accent).toBe('#FF5500');
  });

  it('applies host setParams, goto and setDesign', async () => {
    unmount = mountVanilla(composition(), { DesignProvider, root, search: `?host=${encodeURIComponent(HOST)}` });
    expect(root.textContent).toBe('hi');
    await send({ v: 2, type: 'setParams', payload: { sceneId: 'a', values: { label: 'changed' } } });
    expect(root.textContent).toBe('changed');
    await send({ v: 2, type: 'goto', payload: { sceneId: 'b' } });
    expect(root.querySelector('[data-scene]')?.getAttribute('data-scene')).toBe('b');
    await send({ v: 2, type: 'setDesign', payload: { colors: { accent: '#00FF00' } } });
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#00FF00');
    await send({ v: 2, type: 'setDesign', payload: { colors: null } });
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#FF5500');
  });

  it('ignores messages from other origins', async () => {
    unmount = mountVanilla(composition(), { DesignProvider, root, search: `?host=${encodeURIComponent(HOST)}` });
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { v: 2, type: 'setParams', payload: { sceneId: 'a', values: { label: 'evil' } } }, origin: 'http://evil.test', source: window }),
      );
    });
    expect(root.textContent).toBe('hi');
  });

  it('starts from user param files and does not talk to a host in render mode', () => {
    unmount = mountVanilla(composition(), { DesignProvider, root, search: '?mode=render&t=1', paramsFiles: { a: { label: 'from file' } } });
    expect(root.textContent).toBe('from file');
    expect(posted).toEqual([]);
  });

  it('plays on its own when opened without a host', async () => {
    unmount = mountVanilla(composition(), { DesignProvider, root, search: '' });
    expect(root.textContent).toBe('hi');
  });

  it('typed input advances a static page only on matching advance (unrelated keys do nothing)', async () => {
    const { useSteps } = await import('./steps');
    const STEPS = [
      { id: 'a', advance: 'click' },
      { id: 'b', advance: 'key:ArrowRight' },
    ] as const;
    function Page() {
      useSteps(STEPS, null);
      return createElement('main', null, 'page');
    }
    clearScenes();
    const comp = defineComposition({ scenes: [defineScene({ id: 's', Component: Page })] });
    unmount = mountVanilla(comp, { DesignProvider, root, search: `?host=${encodeURIComponent(HOST)}` });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const types = () => posted.map((m) => m.type);
    // Unrelated keys (scene shortcuts, wrong arrows) must not move the page.
    await send({ v: 2, type: 'input', payload: { kind: 'key', key: 'n' } });
    await send({ v: 2, type: 'input', payload: { kind: 'key', key: 'ArrowLeft' } });
    expect(types()).not.toContain('step');
    // A custom scene shortcut handler still sees the key (dispatched in the scene tree).
    const seen: string[] = [];
    window.addEventListener('keydown', (e) => seen.push(e.key));
    await send({ v: 2, type: 'input', payload: { kind: 'key', key: 'f' } });
    expect(seen).toContain('f');
    expect(types()).not.toContain('step');
    // Matching inputs advance; a wrong-kind input on the last step does not finish it.
    await send({ v: 2, type: 'input', payload: { kind: 'click' } });
    expect(posted.find((m) => m.type === 'step')?.payload).toEqual({ index: 1, total: 2 });
    await send({ v: 2, type: 'input', payload: { kind: 'click' } });
    expect(types()).not.toContain('done');
    await send({ v: 2, type: 'input', payload: { kind: 'key', key: 'ArrowRight' } });
    expect(types()).toContain('done');
  });
});
