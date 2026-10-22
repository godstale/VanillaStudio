import { describe, expect, it, vi } from 'vitest';
import { addNode, newSequence, type Sequence } from './schema';
import { createSequenceManager, SequenceError, type SceneEvent, type SceneHandle, type SceneHost, type Timers, type TransitionRunner } from './manager';
import type { SceneRef } from './validate';

// ---- 가짜 Bridge/호스트 ----------------------------------------------------------------------

class FakeScene implements SceneHandle {
  loaded = false;
  duration: number | undefined = 4;
  disposed = false;
  log: string[] = [];
  private listeners = new Set<(e: SceneEvent) => void>();
  loadError: string | null = null;
  constructor(readonly sceneId: string) {}
  load = vi.fn(async () => {
    if (this.loadError) throw new Error(this.loadError);
    this.loaded = true;
  });
  start() {
    this.log.push('start');
  }
  pause() {
    this.log.push('pause');
  }
  resume() {
    this.log.push('resume');
  }
  seek(t: number) {
    this.log.push(`seek:${t}`);
  }
  next() {
    this.log.push('next');
  }
  prev() {
    this.log.push('prev');
  }
  input(input: { kind: 'click' } | { kind: 'key'; key: string }) {
    this.log.push(input.kind === 'click' ? 'input:click' : `input:${input.key}`);
  }
  subscribe(l: (e: SceneEvent) => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }
  emit(e: SceneEvent) {
    [...this.listeners].forEach((l) => l(e));
  }
}

class FakeHost implements SceneHost {
  created: FakeScene[] = [];
  failing = new Set<string>();
  create(sceneId: string) {
    const s = new FakeScene(sceneId);
    if (this.failing.has(sceneId)) s.loadError = 'boom';
    this.created.push(s);
    return s;
  }
  last(id: string): FakeScene {
    return [...this.created].reverse().find((s) => s.sceneId === id && !s.disposed) as FakeScene;
  }
}

class FakeTimers implements Timers {
  time = 0;
  private jobs: { id: number; at: number; fn: () => void }[] = [];
  private seq = 0;
  set(fn: () => void, ms: number) {
    const id = ++this.seq;
    this.jobs.push({ id, at: this.time + ms, fn });
    return id;
  }
  clear(handle: unknown) {
    this.jobs = this.jobs.filter((j) => j.id !== handle);
  }
  now() {
    return this.time;
  }
  advance(ms: number) {
    this.time += ms;
    for (const j of this.jobs.filter((x) => x.at <= this.time).sort((a, b) => a.at - b.at)) {
      this.jobs = this.jobs.filter((x) => x.id !== j.id);
      j.fn();
    }
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const TR = { type: 'crossfade', durationMs: 600, easing: 'ease-in-out', params: {} };
const edge = (from: string, to: string, trigger: string) => ({ from, to, trigger, transition: { ...TR } });

const scenes = new Map<string, SceneRef>([
  ['scn_m', { type: 'motion', name: 'Intro' }],
  ['scn_s', { type: 'static', name: 'Page' }],
  ['scn_d', { type: '3d', name: 'Globe' }],
  ['scn_x', { type: 'motion', name: 'Alt' }],
]);

function build(edges: Sequence['edges'], opts: { mode?: Sequence['mode']; ids?: string[]; runTransition?: TransitionRunner } = {}) {
  let seq = newSequence('ws_1');
  for (const id of opts.ids ?? ['scn_m', 'scn_s', 'scn_d', 'scn_x']) seq = addNode(seq, id, { x: 0, y: 0 });
  seq = { ...seq, mode: opts.mode ?? 'interactive', edges };
  const host = new FakeHost();
  const timers = new FakeTimers();
  const manager = createSequenceManager({ sequence: seq, scenes, workspaceId: 'ws_1', host, timers, runTransition: opts.runTransition });
  return { manager, host, timers };
}

describe('start and end trigger', () => {
  it('loads and plays the start scene, preloading its neighbours', async () => {
    const { manager, host } = build([edge('scn_m', 'scn_d', 'end')]);
    await manager.start();
    expect(manager.getState()).toMatchObject({ status: 'playing', current: 'scn_m', history: ['scn_m'] });
    expect(host.last('scn_m').log).toEqual(['start']);
    expect(host.last('scn_d').load).toHaveBeenCalled(); // preloaded
    expect(host.last('scn_s')).toBeUndefined(); // not adjacent: not loaded
  });

  it('end: when a motion scene is done, transitions to the next and plays it', async () => {
    const run = vi.fn<TransitionRunner>(async () => undefined);
    const { manager, host } = build([edge('scn_m', 'scn_d', 'end')], { runTransition: run });
    await manager.start();
    const first = host.last('scn_m');
    first.emit({ type: 'done' });
    await flush();
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0].type).toBe('crossfade');
    expect(manager.getState()).toMatchObject({ status: 'playing', current: 'scn_d', history: ['scn_m', 'scn_d'] });
    expect(first.disposed).toBe(true);
    expect(host.last('scn_d').log).toContain('start');
  });

  it('the last scene ends the sequence', async () => {
    const { manager, host } = build([edge('scn_m', 'scn_d', 'end')]);
    await manager.start();
    host.last('scn_m').emit({ type: 'done' });
    await flush();
    host.last('scn_d').emit({ type: 'done' });
    expect(manager.getState().status).toBe('ended');
  });

  it('refuses to start an invalid sequence', async () => {
    const { manager } = build([edge('scn_s', 'scn_d', 'end')]); // static + auto trigger
    await expect(manager.start()).rejects.toBeInstanceOf(SequenceError);
    expect(manager.getState().status).toBe('idle');
  });
});

describe('timeout trigger', () => {
  it('moves on after N seconds', async () => {
    const { manager, host, timers } = build([edge('scn_m', 'scn_d', 'timeout:3s')]);
    await manager.start();
    timers.advance(2900);
    await flush();
    expect(manager.getState().current).toBe('scn_m');
    timers.advance(200);
    await flush();
    expect(manager.getState()).toMatchObject({ status: 'playing', current: 'scn_d' });
    expect(host.last('scn_d').log).toContain('start');
  });

  it('pause freezes the timer and resume continues with the remaining time', async () => {
    const { manager, timers } = build([edge('scn_m', 'scn_d', 'timeout:3s')]);
    await manager.start();
    timers.advance(1000);
    manager.pause();
    expect(manager.getState().status).toBe('paused');
    timers.advance(10_000);
    await flush();
    expect(manager.getState().current).toBe('scn_m'); // still waiting
    manager.resume();
    timers.advance(1900);
    await flush();
    expect(manager.getState().current).toBe('scn_m');
    timers.advance(200);
    await flush();
    expect(manager.getState().current).toBe('scn_d');
  });
});

describe('click and key triggers', () => {
  it('a motion scene waits for the matching input', async () => {
    const { manager } = build([edge('scn_m', 'scn_d', 'key:ArrowRight')]);
    await manager.start();
    manager.input({ kind: 'click' });
    manager.input({ kind: 'key', key: 'Enter' });
    await flush();
    expect(manager.getState().current).toBe('scn_m');
    manager.input({ kind: 'key', key: 'ArrowRight' });
    await flush();
    expect(manager.getState().current).toBe('scn_d');
  });

  it('a paused motion scene still advances on the matching key (e.g. after clicking the stage)', async () => {
    const { manager } = build([edge('scn_m', 'scn_d', 'key:ArrowRight')]);
    await manager.start();
    manager.pause();
    expect(manager.getState().status).toBe('paused');
    manager.input({ kind: 'key', key: 'ArrowRight' });
    await flush();
    expect(manager.getState()).toMatchObject({ status: 'playing', current: 'scn_d' });
  });

  it('a static scene gets the typed input first (step move); only the last step lets it leave', async () => {
    const { manager, host } = build([edge('scn_s', 'scn_d', 'click')], { ids: ['scn_s', 'scn_d'] });
    await manager.start();
    const page = host.last('scn_s');
    manager.input({ kind: 'click' });
    expect(page.log).toEqual(['start', 'input:click']); // typed delegation, not unconditional next
    page.emit({ type: 'step', index: 1, total: 3 }); // not the last step: stay
    await flush();
    expect(manager.getState()).toMatchObject({ current: 'scn_s', step: { index: 1, total: 3 } });
    manager.input({ kind: 'click' });
    page.emit({ type: 'done' }); // the last step received input
    await flush();
    expect(manager.getState().current).toBe('scn_d');
  });

  it('a static scene forwards keys typed (wrong keys stay for the page to ignore)', async () => {
    const { manager, host } = build([edge('scn_s', 'scn_d', 'key:ArrowRight')], { ids: ['scn_s', 'scn_d'] });
    await manager.start();
    const page = host.last('scn_s');
    manager.input({ kind: 'key', key: 'ArrowLeft' });
    manager.input({ kind: 'key', key: 'n' });
    expect(page.log).toEqual(['start', 'input:ArrowLeft', 'input:n']);
    expect(manager.getState().current).toBe('scn_s'); // no edge evaluated for static input
    manager.stepForward();
    expect(page.log).toEqual(['start', 'input:ArrowLeft', 'input:n', 'next']); // explicit step button
  });

  it('the static scene leaves by the edge that matches the input that finished it', async () => {
    const { manager, host } = build([edge('scn_s', 'scn_d', 'click'), edge('scn_s', 'scn_x', 'key:ArrowLeft')], { ids: ['scn_s', 'scn_d', 'scn_x'] });
    await manager.start();
    manager.input({ kind: 'key', key: 'ArrowLeft' });
    host.last('scn_s').emit({ type: 'done' });
    await flush();
    expect(manager.getState().current).toBe('scn_x');
  });

  it('a static done without any matching edge ends the sequence only when nothing leaves', async () => {
    const { manager, host } = build([], { ids: ['scn_s'] });
    await manager.start();
    manager.input({ kind: 'click' });
    host.last('scn_s').emit({ type: 'done' });
    expect(manager.getState().status).toBe('ended');
  });

  it('back moves a static scene to its previous step', async () => {
    const { manager, host } = build([edge('scn_s', 'scn_d', 'click')], { ids: ['scn_s', 'scn_d'] });
    await manager.start();
    manager.back();
    expect(host.last('scn_s').log).toContain('prev');
  });
});

describe('choice trigger', () => {
  it('lists the choices and follows the chosen label (from the scene UI or the host)', async () => {
    const { manager, host } = build([edge('scn_m', 'scn_d', 'choice:Globe'), edge('scn_m', 'scn_x', 'choice:Alt')]);
    await manager.start();
    expect(manager.getState().choices).toEqual(['Globe', 'Alt']);
    host.last('scn_m').emit({ type: 'choice', label: 'Alt' });
    await flush();
    expect(manager.getState()).toMatchObject({ current: 'scn_x', choices: [] });

    const b = build([edge('scn_m', 'scn_d', 'choice:Globe'), edge('scn_m', 'scn_x', 'choice:Alt')]);
    await b.manager.start();
    await b.manager.choose('Globe');
    expect(b.manager.getState().current).toBe('scn_d');
    await b.manager.choose('Nope'); // unknown label: ignored
    expect(b.manager.getState().current).toBe('scn_d');
  });
});

describe('transitions and errors', () => {
  it('ignores input and done while transitioning', async () => {
    let finish: () => void = () => undefined;
    const run: TransitionRunner = () => new Promise<void>((r) => (finish = r));
    const { manager, host } = build([edge('scn_m', 'scn_d', 'end'), edge('scn_d', 'scn_x', 'click')], { runTransition: run });
    await manager.start();
    host.last('scn_m').emit({ type: 'done' });
    await flush();
    expect(manager.getState()).toMatchObject({ status: 'transitioning', next: 'scn_d' });
    manager.input({ kind: 'click' });
    host.last('scn_m').emit({ type: 'done' });
    finish();
    await flush();
    expect(manager.getState()).toMatchObject({ status: 'playing', current: 'scn_d', history: ['scn_m', 'scn_d'] });
  });

  it('a failing transition effect does not block the sequence', async () => {
    const { manager, host } = build([edge('scn_m', 'scn_d', 'end')], { runTransition: () => Promise.reject(new Error('anim')) });
    await manager.start();
    host.last('scn_m').emit({ type: 'done' });
    await flush();
    expect(manager.getState().current).toBe('scn_d');
  });

  it('a scene that cannot load keeps the current scene and reports the error; retry works', async () => {
    const { manager, host } = build([edge('scn_m', 'scn_d', 'end')]);
    host.failing.add('scn_d');
    await manager.start();
    host.last('scn_m').emit({ type: 'done' });
    await flush();
    expect(manager.getState()).toMatchObject({ status: 'error', current: 'scn_m', next: null });
    expect(manager.getState().error).toMatch(/could not load Globe/);
    host.failing.clear();
    await manager.retry(); // restart the current scene
    expect(manager.getState()).toMatchObject({ status: 'playing', current: 'scn_m', error: null });
  });

  it('a scene error event shows the message', async () => {
    const { manager, host } = build([edge('scn_m', 'scn_d', 'end')]);
    await manager.start();
    host.last('scn_m').emit({ type: 'error', message: 'WebGL lost' });
    expect(manager.getState()).toMatchObject({ status: 'error', error: 'WebGL lost' });
  });

  it('the start scene failing to load is an error state', async () => {
    const host = new FakeHost();
    host.failing.add('scn_m');
    let seq = addNode(newSequence('ws_1'), 'scn_m', { x: 0, y: 0 });
    seq = { ...seq, mode: 'interactive' };
    const manager = createSequenceManager({ sequence: seq, scenes, workspaceId: 'ws_1', host });
    await manager.start();
    expect(manager.getState().status).toBe('error');
  });
});

describe('controls', () => {
  it('exposes the current scene duration (null for scenes without one)', async () => {
    const { manager, host } = build([edge('scn_m', 'scn_d', 'end')]);
    await manager.start();
    expect(manager.getState().duration).toBe(4);
    host.last('scn_m').emit({ type: 'ready', duration: 6 });
    expect(manager.getState().duration).toBe(6);
    host.last('scn_m').emit({ type: 'ready' });
    expect(manager.getState().duration).toBeNull();
  });

  it('seek and time events', async () => {
    const { manager, host } = build([edge('scn_m', 'scn_d', 'end')]);
    await manager.start();
    manager.seek(2.5);
    expect(host.last('scn_m').log).toContain('seek:2.5');
    host.last('scn_m').emit({ type: 'time', t: 3.2 });
    expect(manager.getState().t).toBe(3.2);
  });

  it('jump goes to any scene without a transition and resets history', async () => {
    const run = vi.fn<TransitionRunner>(async () => undefined);
    const { manager } = build([edge('scn_m', 'scn_d', 'end')], { runTransition: run });
    await manager.start();
    await manager.jump('scn_d');
    expect(run).not.toHaveBeenCalled();
    expect(manager.getState()).toMatchObject({ current: 'scn_d', history: ['scn_d'], status: 'playing' });
    await manager.jump('scn_nope'); // unknown: ignored
    expect(manager.getState().current).toBe('scn_d');
  });

  it('loops with an input edge repeat; subscribers are notified; dispose cleans up', async () => {
    const { manager, host } = build([edge('scn_m', 'scn_d', 'end'), edge('scn_d', 'scn_m', 'click')]);
    const seen: string[] = [];
    manager.subscribe(() => seen.push(manager.getState().status));
    await manager.start();
    host.last('scn_m').emit({ type: 'done' });
    await flush();
    manager.input({ kind: 'click' });
    await flush();
    expect(manager.getState()).toMatchObject({ current: 'scn_m', history: ['scn_m', 'scn_d', 'scn_m'] });
    expect(seen).toContain('transitioning');
    manager.dispose();
    expect(host.created.filter((s) => !s.disposed)).toEqual([]);
  });
});
