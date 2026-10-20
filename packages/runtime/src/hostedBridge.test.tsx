import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Bridge } from './bridge';
import { hostedBridge, setHostedBridge } from './hostedBridge';
import { useSteps } from './steps';

const fakeBridge = (): Bridge => ({ ready: vi.fn(), time: vi.fn(), flushTime: vi.fn(), error: vi.fn(), hmr: vi.fn(), step: vi.fn(), done: vi.fn(), choice: vi.fn(), dispose: vi.fn() });

afterEach(() => setHostedBridge(null));

describe('hosted bridge', () => {
  it('is empty until a mount registers one', () => {
    expect(hostedBridge()).toBeNull();
    const b = fakeBridge();
    setHostedBridge(b);
    expect(hostedBridge()).toBe(b);
  });
});

describe('useSteps without an explicit bridge', () => {
  it('reports step and done to the bridge the mount registered', () => {
    const b = fakeBridge();
    setHostedBridge(b);
    const { result } = renderHook(() => useSteps([{ id: 'a', advance: 'click' }, { id: 'b', advance: 'click' }]));
    act(() => result.current.next());
    expect(b.step).toHaveBeenCalledWith(1, 2);
    act(() => result.current.next());
    expect(b.done).toHaveBeenCalledOnce();
  });

  it('reports a choice the page made', () => {
    const b = fakeBridge();
    setHostedBridge(b);
    const { result } = renderHook(() => useSteps([{ id: 'a', advance: 'choice:Go' }]));
    act(() => {
      result.current.input({ kind: 'choice', label: 'Go' });
    });
    expect(b.choice).toHaveBeenCalledWith('Go');
    expect(b.done).toHaveBeenCalledOnce();
  });

  it('an explicit bridge wins over the hosted one', () => {
    const hosted = fakeBridge();
    const explicit = fakeBridge();
    setHostedBridge(hosted);
    const { result } = renderHook(() => useSteps([{ id: 'a', advance: 'click' }, { id: 'b', advance: 'click' }], explicit));
    act(() => result.current.next());
    expect(explicit.step).toHaveBeenCalledWith(1, 2);
    expect(hosted.step).not.toHaveBeenCalled();
  });

  it('with no bridge anywhere (opened directly in a browser) nothing is reported and nothing throws', () => {
    const { result } = renderHook(() => useSteps([{ id: 'a', advance: 'click' }]));
    expect(() => act(() => result.current.next())).not.toThrow();
  });
});
