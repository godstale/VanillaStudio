import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRIDGE_VERSION, clockTarget, createBridge, parseHostOrigin, reportClock, reportHmr, type BridgeTarget } from './bridge';
import { createClock } from './clock';

const ORIGIN = 'http://localhost:1430';

function setup(overrides: Partial<Parameters<typeof createBridge>[0]> = {}) {
  const self = new EventTarget() as unknown as Window;
  const host = { postMessage: vi.fn() } as unknown as Window & { postMessage: ReturnType<typeof vi.fn> };
  const target: { [K in keyof BridgeTarget]: ReturnType<typeof vi.fn> } = {
    init: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    input: vi.fn(),
    seek: vi.fn(),
    setParams: vi.fn(),
    goto: vi.fn(),
    setDesign: vi.fn(),
    capture: vi.fn(() => Promise.resolve('data:image/png;base64,AAAA')),
    reload: vi.fn(),
  };
  const bridge = createBridge({ target: target as unknown as BridgeTarget, hostOrigin: ORIGIN, self, host, captureErrors: false, ...overrides });
  const send = (data: unknown, origin = ORIGIN, source: unknown = host) => {
    self.dispatchEvent(Object.assign(new Event('message'), { data, origin, source }));
  };
  const msg = (type: string, payload?: unknown) => ({ v: BRIDGE_VERSION, type, payload });
  const posted = () => host.postMessage.mock.calls.map((c) => c[0] as { v: number; type: string; payload: unknown });
  return { self, host, target, bridge, send, msg, posted };
}

describe('host -> scene', () => {
  it('routes each message type to the target', () => {
    const { send, msg, target } = setup();
    send(msg('init', { mode: 'preview', paramsValues: { s1: { speed: 2 } } }));
    send(msg('play'));
    send(msg('pause'));
    send(msg('seek', { t: 3.5 }));
    send(msg('setParams', { sceneId: 's1', values: { speed: 1.5 } }));
    send(msg('goto', { sceneId: 's2' }));
    send(msg('setDesign', { colors: { primary: '#FF0000', 'on-primary': 'rgb(0 0 0)' } }));
    send(msg('setDesign', { colors: null }));
    send(msg('next'));
    send(msg('prev'));
    send(msg('input', { kind: 'click' }));
    send(msg('input', { kind: 'key', key: 'ArrowRight' }));
    send(msg('reload'));
    expect(target.init).toHaveBeenCalledWith({ mode: 'preview', paramsValues: { s1: { speed: 2 } } });
    expect(target.play).toHaveBeenCalledOnce();
    expect(target.pause).toHaveBeenCalledOnce();
    expect(target.seek).toHaveBeenCalledWith(3.5);
    expect(target.setParams).toHaveBeenCalledWith('s1', { speed: 1.5 });
    expect(target.goto).toHaveBeenCalledWith('s2');
    expect(target.setDesign.mock.calls).toEqual([[{ primary: '#FF0000', 'on-primary': 'rgb(0 0 0)' }], [null]]);
    expect(target.reload).toHaveBeenCalledOnce();
    expect(target.next).toHaveBeenCalledOnce();
    expect(target.prev).toHaveBeenCalledOnce();
    expect(target.input.mock.calls).toEqual([[{ kind: 'click' }], [{ kind: 'key', key: 'ArrowRight' }]]);
  });

  it('routes typed input only when the payload is well-formed', () => {
    const { send, msg, target } = setup();
    send(msg('input', { kind: 'key', key: '' }));
    send(msg('input', { kind: 'key', key: 'x'.repeat(51) }));
    send(msg('input', { kind: 'key' }));
    send(msg('input', { kind: 'tap' }));
    send(msg('input'));
    expect(target.input).not.toHaveBeenCalled();
    send(msg('input', { kind: 'click' }));
    expect(target.input).toHaveBeenCalledOnce();
  });

  it('speaks protocol version 2', () => {
    expect(BRIDGE_VERSION).toBe(2);
  });

  it('init may carry the workspace canvas, validated', () => {
    const { send, msg, target } = setup();
    send(msg('init', { mode: 'preview', paramsValues: {}, canvas: { width: 1080, height: 1920, fps: 30 } }));
    expect(target.init).toHaveBeenCalledWith({ mode: 'preview', paramsValues: {}, canvas: { width: 1080, height: 1920, fps: 30 } });
    for (const bad of [
      { width: 0, height: 10, fps: 30 },
      { width: 1920, height: 1080, fps: 0 },
      { width: 1920.5, height: 1080, fps: 30 },
      { width: 99999, height: 1080, fps: 30 },
    ]) {
      send(msg('init', { mode: 'preview', paramsValues: {}, canvas: bad }));
    }
    expect(target.init).toHaveBeenCalledOnce();
  });

  it('drops messages from another origin or window, and malformed ones', () => {
    const { send, msg, target, posted } = setup();
    send(msg('play'), 'http://evil.example');
    send(msg('play'), ORIGIN, { other: 'window' });
    send({ v: 1, type: 'play' }); // older protocol version
    send({ v: 3, type: 'play' }); // newer protocol version
    send({ type: 'play' });
    send('play');
    send(null);
    send(msg('nope'));
    send(msg('seek', { t: -1 }));
    send(msg('seek', { t: Number.NaN }));
    send(msg('seek'));
    send(msg('setParams', { sceneId: '', values: {} }));
    for (const fn of Object.values(target)) expect(fn).not.toHaveBeenCalled();
    expect(posted()).toEqual([]);
  });

  it('accepts only color notation in setDesign (the value reaches a CSS variable)', () => {
    const { send, msg, target } = setup();
    for (const bad of ['red; background:url(//x)', 'url(x)', '#GGG', 'javascript:1', '', 'x'.repeat(200)]) send(msg('setDesign', { colors: { primary: bad } }));
    send(msg('setDesign', { colors: { 'bad name!': '#fff' } }));
    expect(target.setDesign).not.toHaveBeenCalled();
    send(msg('setDesign', { colors: { primary: 'oklch(0.7 0.1 200)' } }));
    expect(target.setDesign).toHaveBeenCalledOnce();
  });

  it('stops listening after dispose', () => {
    const { send, msg, target, bridge } = setup();
    bridge.dispose();
    send(msg('play'));
    expect(target.play).not.toHaveBeenCalled();
  });
});

describe('scene -> host', () => {
  it('posts envelopes to the fixed host origin only', () => {
    const { bridge, host, posted } = setup();
    bridge.ready({ scenes: [], duration: 4, format: 'video', design: { hash: 'h', roles: { canvas: '#000000' } } });
    bridge.hmr(['/src/scenes/a.tsx']);
    expect(host.postMessage.mock.calls.every((c) => c[1] === ORIGIN)).toBe(true);
    expect(posted()[0]).toEqual({ v: 2, type: 'ready', payload: { scenes: [], duration: 4, format: 'video', design: { hash: 'h', roles: { canvas: '#000000' } } } });
    expect(posted()[1]).toMatchObject({ v: 2, type: 'hmr', payload: { modules: ['/src/scenes/a.tsx'] } });
  });

  it('capture replies with `captured` (echoing the request id) or reports the failure', async () => {
    const { send, msg, target, posted } = setup();
    send(msg('capture', { scale: 2, id: 'r1' }));
    send(msg('capture'));
    await Promise.resolve();
    await Promise.resolve();
    expect(target.capture.mock.calls).toEqual([[2], [1]]);
    expect(posted()).toEqual([
      { v: 2, type: 'captured', payload: { dataUrl: 'data:image/png;base64,AAAA', scale: 2, id: 'r1' } },
      { v: 2, type: 'captured', payload: { dataUrl: 'data:image/png;base64,AAAA', scale: 1, id: undefined } },
    ]);
    target.capture.mockRejectedValueOnce(new Error('tainted canvas'));
    send(msg('capture', { scale: 1 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(posted().at(-1)).toMatchObject({ type: 'error', payload: { message: 'tainted canvas' } });
    send(msg('capture', { scale: 99 }));
    expect(target.capture).toHaveBeenCalledTimes(3);
  });

  it('turns a throwing target into an error message instead of crashing', () => {
    const { send, msg, target, posted } = setup({ getSceneId: () => 's1' });
    target.seek.mockImplementation(() => {
      throw new Error('boom');
    });
    send(msg('seek', { t: 1 }));
    expect(posted()[0]).toMatchObject({ type: 'error', payload: { message: 'boom', sceneId: 's1' } });
    expect(typeof (posted()[0].payload as { stack: string }).stack).toBe('string');
  });

  it('forwards window errors and unhandled rejections when enabled', () => {
    const { self, posted } = setup({ captureErrors: true });
    self.dispatchEvent(Object.assign(new Event('error'), { error: new Error('render failed'), message: 'x' }));
    self.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'plain string' }));
    expect(posted().map((m) => [m.type, (m.payload as { message: string }).message])).toEqual([
      ['error', 'render failed'],
      ['error', 'plain string'],
    ]);
  });
});

describe('time throttling', () => {
  let t = 0;
  const timers: { fn: () => void; at: number }[] = [];
  const opts = {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      timers.push({ fn, at: t + ms });
      return timers.length - 1;
    },
    clearTimer: (id: unknown) => {
      timers[id as number] = { fn: () => {}, at: Infinity };
    },
  };
  beforeEach(() => {
    t = 1000;
    timers.length = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it('sends the first immediately and the latest value on the trailing edge', () => {
    const { bridge, posted } = setup(opts);
    bridge.time(0, 's1');
    t += 5;
    bridge.time(0.1, 's1');
    t += 5;
    bridge.time(0.2, 's1');
    expect(posted().map((m) => (m.payload as { t: number }).t)).toEqual([0]);
    t += 6;
    timers.find((x) => x.at !== Infinity)!.fn();
    expect(posted().map((m) => (m.payload as { t: number }).t)).toEqual([0, 0.2]);
  });

  it('flushTime delivers a pending value at once', () => {
    const { bridge, posted } = setup(opts);
    bridge.time(1, null);
    bridge.time(2, null);
    bridge.flushTime();
    expect(posted().map((m) => (m.payload as { t: number }).t)).toEqual([1, 2]);
  });

  it('reportClock streams clock time and flushes when playback stops', () => {
    const { bridge, posted } = setup(opts);
    const clock = createClock({ mode: 'preview', duration: 10 });
    const off = reportClock(bridge, clock, () => 's1');
    clock.seek(1);
    t += 1;
    clock.seek(2);
    clock.play();
    clock.pause(); // flushes the pending 2
    expect(posted().map((m) => (m.payload as { t: number }).t)).toEqual([1, 2]);
    off();
    clock.seek(3);
    clock.pause();
    expect(posted()).toHaveLength(2);
  });
});

describe('setup edge cases', () => {
  it('is inert in render mode', () => {
    const { bridge, send, msg, target, posted } = setup({ mode: 'render' });
    send(msg('setDesign', { colors: { primary: '#fff' } }));
    bridge.ready({ scenes: [], duration: undefined, format: 'video', design: { hash: 'h', roles: {} } });
    expect(target.setDesign).not.toHaveBeenCalled();
    expect(posted()).toEqual([]);
  });

  it('refuses a bad host origin, including wildcards', () => {
    for (const bad of ['*', 'null', 'localhost:1430', 'http://localhost:1430/path', 'javascript:alert(1)']) {
      expect(() => setup({ hostOrigin: bad })).toThrow(/hostOrigin/);
    }
  });

  it('parseHostOrigin normalises valid origins only', () => {
    expect(parseHostOrigin('http://localhost:1430')).toBe('http://localhost:1430');
    expect(parseHostOrigin('http://tauri.localhost/x?y')).toBe('http://tauri.localhost');
    expect(parseHostOrigin('tauri://localhost')).toBe('tauri://localhost');
    expect(parseHostOrigin('file:///c:/x')).toBeNull();
    expect(parseHostOrigin('nonsense')).toBeNull();
    expect(parseHostOrigin(null)).toBeNull();
  });

  it('clockTarget maps play / pause / seek onto a clock', () => {
    const clock = createClock({ mode: 'preview', duration: 5 });
    const tgt = clockTarget(clock);
    tgt.seek(2);
    expect(clock.getTime()).toBe(2);
    tgt.play();
    expect(clock.isPlaying()).toBe(true);
    tgt.pause();
    expect(clock.isPlaying()).toBe(false);
  });

  it('reportHmr forwards the applied module paths', () => {
    const { bridge, posted } = setup();
    let cb: ((p: { updates: { path: string }[] }) => void) | null = null;
    reportHmr(bridge, { on: (_e, f) => (cb = f) });
    cb!({ updates: [{ path: '/src/a.tsx' }, { path: '/src/b.tsx' }] });
    expect(posted()[0]).toMatchObject({ type: 'hmr', payload: { modules: ['/src/a.tsx', '/src/b.tsx'] } });
    expect(() => reportHmr(bridge, undefined)).not.toThrow();
  });
});

describe('scene -> host (v2 static pages)', () => {
  it('posts step, done and choice with the protocol version', () => {
    const { bridge, posted } = setup();
    bridge.step(1, 3);
    bridge.choice('Yes');
    bridge.done();
    expect(posted()).toEqual([
      { v: 2, type: 'step', payload: { index: 1, total: 3 } },
      { v: 2, type: 'choice', payload: { label: 'Yes' } },
      { v: 2, type: 'done', payload: {} },
    ]);
  });

  it('is inert in render mode', () => {
    const { bridge, posted } = setup({ mode: 'render' });
    bridge.step(0, 1);
    bridge.done();
    bridge.choice('x');
    expect(posted()).toEqual([]);
  });
});
