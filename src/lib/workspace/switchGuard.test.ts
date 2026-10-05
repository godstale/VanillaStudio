import { describe, expect, it, vi } from 'vitest';
import { listBusy, registerBusy, stopAllBusy } from './switchGuard';

describe('switchGuard', () => {
  it('lists registered work and forgets it after unregister', () => {
    const off = registerBusy({ label: 'Terminal A', onStop: () => undefined });
    expect(listBusy()).toEqual(['Terminal A']);
    off();
    expect(listBusy()).toEqual([]);
  });

  it('stops everything, keeps going after a failure and clears the list', async () => {
    const ok = vi.fn();
    registerBusy({ label: 'bad', onStop: () => Promise.reject(new Error('x')) });
    registerBusy({ label: 'good', onStop: ok });
    expect(await stopAllBusy()).toBe(1);
    expect(ok).toHaveBeenCalledOnce();
    expect(listBusy()).toEqual([]);
  });
});
