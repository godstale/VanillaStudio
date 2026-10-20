import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  findMissingModules,
  HMR_QUIET_MS,
  isHmrRelevant,
  toHmrModuleId,
  useHmrGuard,
  type HmrGuardBridge,
} from './hmrGuard';
import type { BridgeEvent } from './bridgeContextValue';
import type { WatchApi } from './watchClient';

describe('isHmrRelevant', () => {
  it('covers Vite hot-updated sources only', () => {
    expect(isHmrRelevant('src/app.tsx')).toBe(true);
    expect(isHmrRelevant('src/style.css')).toBe(true);
    expect(isHmrRelevant('src/lib/x.mjs')).toBe(true);
    expect(isHmrRelevant('DESIGN.md')).toBe(false);
    expect(isHmrRelevant('vanilla.json')).toBe(false);
    expect(isHmrRelevant('src/data.json')).toBe(false);
    expect(isHmrRelevant('public/logo.png')).toBe(false);
  });
});

describe('toHmrModuleId', () => {
  it('normalizes watcher paths to Vite module ids', () => {
    expect(toHmrModuleId('src/app.tsx')).toBe('/src/app.tsx');
    expect(toHmrModuleId('src\\app.tsx')).toBe('/src/app.tsx');
  });
});

describe('findMissingModules', () => {
  it('reports changes with no report at or after their time', () => {
    const changed = [
      { module: '/src/a.tsx', at: 100 },
      { module: '/src/b.tsx', at: 100 },
      { module: '/src/c.tsx', at: 200 },
    ];
    const sightings = [
      { module: '/src/a.tsx', at: 150 },
      { module: '/src/b.tsx', at: 50 },
    ];
    expect(findMissingModules(changed, sightings)).toEqual(['/src/b.tsx', '/src/c.tsx']);
  });
});

describe('useHmrGuard', () => {
  async function setup() {
    vi.useFakeTimers();
    let listener: ((e: BridgeEvent) => void) | null = null;
    const onEventRef: { current: ((e: { kind: 'changed'; paths: string[] }) => void) | null } = { current: null };
    const bridge: HmrGuardBridge = {
      subscribe: (l) => {
        listener = l;
        return () => {
          listener = null;
        };
      },
      reload: vi.fn(),
    };
    const api: WatchApi = {
      start: vi.fn(((_dir: string, onEvent: (e: { kind: 'changed'; paths: string[] }) => void) => {
        onEventRef.current = onEvent;
        return Promise.resolve();
      }) as WatchApi['start']),
      stop: vi.fn(() => Promise.resolve()),
    };
    renderHook(() => useHmrGuard('C:/proj', bridge, { api }));
    // The watcher starts through a per-project promise queue; flush it before emitting.
    await act(async () => {});
    return {
      bridge,
      emit: (paths: string[]) => act(() => onEventRef.current?.({ kind: 'changed', paths })),
      hmr: (modules: string[], at: number) =>
        act(() => listener?.({ v: 2, type: 'hmr', payload: { modules, at } }) as void),
      quiet: () => act(() => vi.advanceTimersByTime(HMR_QUIET_MS + 1)),
      cleanup: () => vi.useRealTimers(),
    };
  }

  it('reloads when a change settles with no hmr report', async () => {
    const h = await setup();
    try {
      h.emit(['src/app.tsx']);
      h.quiet();
      expect(h.bridge.reload).toHaveBeenCalledTimes(1);
    } finally {
      h.cleanup();
    }
  });

  it('stays quiet when the preview reported the module', async () => {
    const h = await setup();
    try {
      h.emit(['src/app.tsx']);
      h.hmr(['/src/app.tsx'], Date.now());
      h.quiet();
      expect(h.bridge.reload).not.toHaveBeenCalled();
    } finally {
      h.cleanup();
    }
  });

  it('ignores files outside HMR sources', async () => {
    const h = await setup();
    try {
      h.emit(['DESIGN.md', 'vanilla.json']);
      h.quiet();
      expect(h.bridge.reload).not.toHaveBeenCalled();
    } finally {
      h.cleanup();
    }
  });

  it('S4 pattern: rapid rewrites settle once and recover with a single reload', async () => {
    const h = await setup();
    try {
      for (let i = 0; i < 5; i++) {
        h.emit(['src/app.tsx']);
        act(() => vi.advanceTimersByTime(30));
      }
      h.quiet();
      expect(h.bridge.reload).toHaveBeenCalledTimes(1);
    } finally {
      h.cleanup();
    }
  });
});
