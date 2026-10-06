import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IframeScene, IframeSceneHost } from './iframeScene';
import type { SceneEvent } from '@/lib/sequence/manager';

const SERVER = 'http://127.0.0.1:5555';
const HOST = 'http://localhost:1430';
let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => container.remove());

const make = (over: Partial<ConstructorParameters<typeof IframeScene>[0]> = {}) =>
  new IframeScene({ sceneId: 'scn_a', slug: 'intro', type: 'motion', serverUrl: SERVER, hostOrigin: HOST, canvas: { width: 1920, height: 1080, fps: 30 }, container, ...over });

/** 신이 보낸 것처럼 호스트 창에 메시지를 흘려 넣는다. */
function fromScene(scene: IframeScene, type: string, payload: unknown, opts: { origin?: string; source?: unknown; v?: number } = {}) {
  window.dispatchEvent(new MessageEvent('message', { data: { v: opts.v ?? 2, type, payload }, origin: opts.origin ?? SERVER, source: (opts.source ?? scene.element.contentWindow) as MessageEventSource }));
}
const ready = (duration?: number) => ({ scenes: [], format: '16:9', design: { hash: 'h', roles: {} }, ...(duration === undefined ? {} : { duration }) });

function spyPost(scene: IframeScene) {
  const post = vi.fn();
  Object.defineProperty(scene.element, 'contentWindow', { value: { postMessage: post }, configurable: true });
  return post;
}

describe('IframeScene', () => {
  it('opens the scene entry on the preview server with the host origin and hidden by default', () => {
    const s = make();
    void s.load();
    expect(container.contains(s.element)).toBe(true);
    const url = new URL(s.element.src);
    expect(url.origin).toBe(SERVER);
    expect(url.pathname).toBe('/scenes/intro/src/index.html');
    expect(url.searchParams.get('mode')).toBe('preview');
    expect(url.searchParams.get('host')).toBe(HOST);
    expect(s.element.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(s.element.style.visibility).toBe('hidden');
    s.dispose();
  });

  it('load resolves on ready, injects the canvas, and exposes the duration', async () => {
    const s = make();
    const loading = s.load();
    const post = spyPost(s);
    fromScene(s, 'ready', ready(4.5));
    await loading;
    expect(s.duration).toBe(4.5);
    expect(post).toHaveBeenCalledWith({ v: 2, type: 'init', payload: { mode: 'preview', paramsValues: {}, canvas: { width: 1920, height: 1080, fps: 30 } } }, SERVER);
    // ready again (HMR remount): init is sent again
    fromScene(s, 'ready', ready(4.5));
    expect(post.mock.calls.filter((c) => c[0].type === 'init')).toHaveLength(2);
    s.dispose();
  });

  it('ignores messages from other origins, other windows and other protocol versions', () => {
    const s = make();
    const events: SceneEvent[] = [];
    s.subscribe((e) => events.push(e));
    void s.load();
    fromScene(s, 'time', { t: 1, sceneId: null }, { origin: 'http://evil.example' });
    fromScene(s, 'time', { t: 1, sceneId: null }, { source: window });
    fromScene(s, 'time', { t: 1, sceneId: null }, { v: 1 });
    expect(events).toEqual([]);
    fromScene(s, 'time', { t: 1, sceneId: null });
    expect(events).toEqual([{ type: 'time', t: 1 }]);
    s.dispose();
  });

  it('load rejects on a scene error and on timeout', async () => {
    const a = make();
    const loadingA = a.load();
    fromScene(a, 'error', { message: 'boom', stack: '', sceneId: null });
    await expect(loadingA).rejects.toThrow('boom');
    a.dispose();

    vi.useFakeTimers();
    const b = make({ loadTimeoutMs: 1000 });
    const loadingB = b.load();
    const assertion = expect(loadingB).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(1100);
    await assertion;
    vi.useRealTimers();
    b.dispose();
  });

  it('rejects an invalid preview server url', async () => {
    await expect(make({ serverUrl: 'http://example.com:1' }).load()).rejects.toThrow(/invalid preview server/);
  });

  it('motion scenes: done is inferred when the clock reaches the duration, once', async () => {
    const s = make();
    const events: SceneEvent[] = [];
    const loading = s.load();
    spyPost(s);
    fromScene(s, 'ready', ready(3));
    await loading;
    s.subscribe((e) => events.push(e));
    fromScene(s, 'time', { t: 2.9, sceneId: null });
    fromScene(s, 'time', { t: 3, sceneId: null });
    fromScene(s, 'time', { t: 3, sceneId: null });
    expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
    s.start(); // restart re-arms it
    fromScene(s, 'time', { t: 3, sceneId: null });
    expect(events.filter((e) => e.type === 'done')).toHaveLength(2);
    s.dispose();
  });

  it('static scenes: step, done and choice come from the page; time never ends it', async () => {
    const s = make({ type: 'static' });
    const loading = s.load();
    spyPost(s);
    fromScene(s, 'ready', ready());
    await loading;
    const events: SceneEvent[] = [];
    s.subscribe((e) => events.push(e));
    fromScene(s, 'time', { t: 99, sceneId: null });
    fromScene(s, 'step', { index: 1, total: 3 });
    fromScene(s, 'choice', { label: 'Yes' });
    fromScene(s, 'done', {});
    expect(events).toEqual([{ type: 'time', t: 99 }, { type: 'step', index: 1, total: 3 }, { type: 'choice', label: 'Yes' }, { type: 'done' }]);
    s.dispose();
  });

  it('a done message from a motion scene is ignored (the host decides the end)', async () => {
    const s = make();
    const loading = s.load();
    spyPost(s);
    fromScene(s, 'ready', ready(3));
    await loading;
    const events: SceneEvent[] = [];
    s.subscribe((e) => events.push(e));
    fromScene(s, 'done', {});
    expect(events).toEqual([]);
    s.dispose();
  });

  it('commands go to the scene with the protocol version and the fixed origin', async () => {
    const s = make();
    const loading = s.load();
    const post = spyPost(s);
    fromScene(s, 'ready', ready(3));
    await loading;
    post.mockClear();
    s.start();
    s.pause();
    s.resume();
    s.seek(1.5);
    s.next();
    s.prev();
    expect(post.mock.calls.map((c) => c[0])).toEqual([
      { v: 2, type: 'seek', payload: { t: 0 } },
      { v: 2, type: 'play' },
      { v: 2, type: 'pause' },
      { v: 2, type: 'play' },
      { v: 2, type: 'seek', payload: { t: 1.5 } },
      { v: 2, type: 'next' },
      { v: 2, type: 'prev' },
    ]);
    expect(post.mock.calls.every((c) => c[1] === SERVER)).toBe(true);
    s.dispose();
  });

  it('a static scene gets no play/pause/seek-at-start', async () => {
    const s = make({ type: 'static' });
    const loading = s.load();
    const post = spyPost(s);
    fromScene(s, 'ready', ready());
    await loading;
    post.mockClear();
    s.start();
    s.pause();
    s.resume();
    expect(post).not.toHaveBeenCalled();
    s.dispose();
  });

  it('dispose removes the iframe and stops listening', () => {
    const s = make();
    const events: SceneEvent[] = [];
    void s.load();
    s.subscribe((e) => events.push(e));
    s.dispose();
    expect(container.contains(s.element)).toBe(false);
    fromScene(s, 'time', { t: 1, sceneId: null });
    expect(events).toEqual([]);
  });

  it('layers: top is above, under is below, hidden is not visible, and none take pointer events', () => {
    const s = make();
    s.setLayer('top');
    expect([s.element.style.zIndex, s.element.style.visibility]).toEqual(['2', 'visible']);
    s.setLayer('under');
    expect([s.element.style.zIndex, s.element.style.visibility]).toEqual(['1', 'visible']);
    s.setLayer('hidden');
    expect(s.element.style.visibility).toBe('hidden');
    expect(s.element.style.pointerEvents).toBe('none');
  });
});

describe('IframeSceneHost', () => {
  it('creates handles from the scene table and lays them out for the manager state', () => {
    const host = new IframeSceneHost({
      container,
      serverUrl: SERVER,
      hostOrigin: HOST,
      scenes: new Map([
        ['scn_a', { slug: 'intro', type: 'motion' as const }],
        ['scn_b', { slug: 'page', type: 'static' as const, entry: 'src/custom.html' }],
        ['scn_c', { slug: 'globe', type: '3d' as const }],
      ]),
    });
    const a = host.create('scn_a');
    const b = host.create('scn_b');
    const c = host.create('scn_c');
    expect(() => host.create('scn_nope')).toThrow(/unknown scene/);
    void b.load();
    expect(new URL(b.element.src).pathname).toBe('/scenes/page/src/custom.html');
    host.layout({ current: 'scn_a', next: 'scn_b' });
    expect([a.element.style.zIndex, a.element.style.visibility]).toEqual(['2', 'visible']);
    expect([b.element.style.zIndex, b.element.style.visibility]).toEqual(['1', 'visible']);
    expect(c.element.style.visibility).toBe('hidden');
    host.layout({ current: 'scn_b', next: null });
    expect(b.element.style.zIndex).toBe('2');
    expect(a.element.style.visibility).toBe('hidden');
    expect(host.get('scn_c')).toBe(c);
  });
});
