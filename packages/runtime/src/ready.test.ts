import { describe, expect, it, vi } from 'vitest';
import { createClock } from './clock';
import { applyAndSettle, createReadiness, fontSpecs } from './ready';

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const fontsReady = deferred();
  const loads: string[] = [];
  const flags: { __vanillaReady?: boolean; __vanillaError?: string } = {};
  let frames = 0;
  const r = createReadiness({
    fonts: {
      ready: fontsReady.promise,
      load: (spec) => {
        loads.push(spec);
        return Promise.resolve();
      },
    },
    nextFrame: async () => {
      frames++;
    },
    flags,
  });
  return { r, flags, loads, fontsReady, frames: () => frames };
}

describe('readiness', () => {
  it('ready() waits for canvases, assets and fonts', async () => {
    const { r, fontsReady } = setup();
    const created = r.registerCanvas();
    const asset = deferred();
    r.registerAsset(asset.promise);
    const done = vi.fn();
    const p = r.ready().then(done);
    await tick();
    expect(done).not.toHaveBeenCalled();
    created();
    await tick();
    expect(done).not.toHaveBeenCalled();
    asset.resolve();
    await tick();
    expect(done).not.toHaveBeenCalled(); // fonts.ready still pending
    fontsReady.resolve();
    await p;
    expect(done).toHaveBeenCalled();
  });

  it('also waits for assets registered while it is waiting', async () => {
    const { r, fontsReady } = setup();
    fontsReady.resolve();
    const first = deferred();
    const second = deferred();
    r.registerAsset(first.promise);
    const done = vi.fn();
    const p = r.ready().then(done);
    await tick();
    r.registerAsset(second.promise);
    first.resolve();
    await tick();
    expect(done).not.toHaveBeenCalled();
    second.resolve();
    await p;
    expect(done).toHaveBeenCalled();
  });

  it('a canvas that unmounts without being created can be released (idempotent)', async () => {
    const { r, fontsReady } = setup();
    fontsReady.resolve();
    const release = r.registerCanvas();
    release();
    release();
    await r.ready();
  });

  it('settle() raises __vanillaReady only after readiness and two painted frames', async () => {
    const { r, flags, fontsReady, frames } = setup();
    const asset = deferred();
    r.registerAsset(asset.promise);
    const p = r.settle();
    await tick();
    expect(flags.__vanillaReady).toBeUndefined();
    asset.resolve();
    fontsReady.resolve();
    await p;
    expect(flags.__vanillaReady).toBe(true);
    // one stabilization frame in ready() + two painted frames
    expect(frames()).toBe(3);
  });

  it('a failing asset fails the capture and records the reason', async () => {
    const { r, flags, fontsReady } = setup();
    fontsReady.resolve();
    r.registerAsset(Promise.reject(new Error('texture 404')));
    await expect(r.settle()).rejects.toThrow('texture 404');
    expect(flags.__vanillaReady).toBeUndefined();
    expect(flags.__vanillaError).toBe('texture 404');
    r.reset();
    expect(flags).toEqual({ __vanillaReady: false });
  });

  it('loadFonts tracks font loads as assets', async () => {
    const { r, loads, fontsReady } = setup();
    fontsReady.resolve();
    r.loadFonts(['400 16px "Inter"', '700 32px "Inter"']);
    await r.ready();
    expect(loads).toEqual(['400 16px "Inter"', '700 32px "Inter"']);
  });
});

describe('stabilization', () => {
  it('waits one frame per batch of registrations, not per call', async () => {
    const { r, fontsReady, frames } = setup();
    fontsReady.resolve();
    r.registerAsset(Promise.resolve());
    await r.ready();
    expect(frames()).toBe(1);
    await r.ready();
    await r.ready();
    expect(frames()).toBe(1);
    r.registerAsset(Promise.resolve());
    await r.ready();
    expect(frames()).toBe(2);
  });

  it('settle() runs beforeSignal before raising the flag', async () => {
    const { r, flags, fontsReady } = setup();
    fontsReady.resolve();
    const seen: (boolean | undefined)[] = [];
    await r.settle(() => seen.push(flags.__vanillaReady));
    expect(seen).toEqual([undefined]);
    expect(flags.__vanillaReady).toBe(true);
  });
});

describe('applyAndSettle', () => {
  it('applies the time only after readiness, and signals afterwards', async () => {
    const { r, flags, fontsReady } = setup();
    const created = r.registerCanvas();
    const clock = createClock({ mode: 'render' });
    const p = applyAndSettle(clock, r, 4);
    await tick();
    expect(clock.getTime()).toBe(0);
    fontsReady.resolve();
    created();
    await p;
    expect(clock.getTime()).toBe(4);
    expect(flags.__vanillaReady).toBe(true);
  });
});

describe('fontSpecs', () => {
  it('builds specs from typography, skipping generic families and duplicates', () => {
    expect(
      fontSpecs({
        display: { fontFamily: '"Instrument Serif", Georgia, serif', fontSize: '96px', fontWeight: 400 },
        body: { fontFamily: 'Inter, sans-serif', fontSize: '24px' },
        body2: { fontFamily: 'Inter', fontSize: '24px' },
        mono: { fontFamily: 'monospace' },
        none: { fontSize: '10px' },
      }),
    ).toEqual(['400 96px "Instrument Serif"', '400 24px "Inter"']);
    expect(fontSpecs(undefined)).toEqual([]);
  });
});
