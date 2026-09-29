import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { BridgeContext, type BridgeContextValue, type TimeStore } from '@/lib/review/bridgeContextValue';
import type { ReadyInfo } from '@/lib/review/bridgeProtocol';
import { Scrubber, type ScrubberProps } from './Scrubber';

const ready: ReadyInfo = {
  scenes: [
    { id: 'a', duration: 4, params: {} },
    { id: 'b', duration: 3, params: {} },
  ],
  duration: 7,
  format: 'video',
  design: { hash: 'h', roles: {} },
};

function makeTime(initial: number) {
  // getSnapshot must return a cached reference or useSyncExternalStore loops.
  let snap = { t: initial, sceneId: null as string | null };
  const listeners = new Set<() => void>();
  const store: TimeStore = {
    get: () => snap,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
  return {
    store,
    set: (v: number) =>
      act(() => {
        snap = { t: v, sceneId: null };
        listeners.forEach((l) => l());
      }),
  };
}

function stubBridge(overrides: Partial<BridgeContextValue> = {}): BridgeContextValue {
  return {
    status: 'ready',
    ready,
    readyCount: 1,
    error: null,
    registerFrame: () => undefined,
    send: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setParams: vi.fn(),
    goto: vi.fn(),
    setDesign: vi.fn(),
    reload: vi.fn(),
    capture: vi.fn(),
    setParamsValues: () => undefined,
    playing: false,
    subscribe: () => () => undefined,
    timeStore: makeTime(0).store,
    ...overrides,
  };
}

function renderScrubber(props: ScrubberProps, bridge: BridgeContextValue) {
  return render(
    <LanguageProvider>
      <BridgeContext.Provider value={bridge}>
        <Scrubber {...props} />
      </BridgeContext.Provider>
    </LanguageProvider>,
  );
}

describe('Scrubber (clock)', () => {
  it('seeks through the slider and steps frames with the keyboard', () => {
    const bridge = stubBridge();
    renderScrubber({ fps: 30, timeKind: 'clock' }, bridge);
    const slider = screen.getByTestId('scrubber-slider') as HTMLInputElement;
    expect(Number(slider.max)).toBe(7);
    fireEvent.change(slider, { target: { value: '3' } });
    expect(bridge.seek).toHaveBeenCalledWith(3);

    fireEvent.keyDown(screen.getByTestId('scrubber'), { key: 'ArrowRight' });
    expect(bridge.seek).toHaveBeenCalledWith(1 / 30);
    fireEvent.keyDown(screen.getByTestId('scrubber'), { key: 'ArrowLeft', shiftKey: true });
    expect(bridge.seek).toHaveBeenCalledWith(-1);
  });

  it('toggles play with Space and jumps between Scene boundaries', () => {
    const clock = makeTime(5);
    const bridge = stubBridge({ playing: true, timeStore: clock.store });
    renderScrubber({ fps: 30, timeKind: 'clock' }, bridge);
    expect(screen.getByTestId('scrubber-scene').textContent).toContain('b');

    fireEvent.keyDown(screen.getByTestId('scrubber'), { key: ' ' });
    expect(bridge.pause).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '이전 Scene' }));
    expect(bridge.seek).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: '다음 Scene' }));
    expect(bridge.seek).toHaveBeenCalledWith(7);
  });

  it('wraps to the loop start after playing past the loop end', () => {
    const clock = makeTime(0);
    const bridge = stubBridge({ playing: true, timeStore: clock.store });
    renderScrubber({ fps: 30, timeKind: 'clock' }, bridge);
    clock.set(2);
    fireEvent.click(screen.getByRole('button', { name: '반복 시작점' }));
    clock.set(4);
    fireEvent.click(screen.getByRole('button', { name: '반복 끝점' }));
    expect(screen.getByTestId('scrubber-loop').textContent).toContain('반복');
    vi.mocked(bridge.seek).mockClear();
    clock.set(5);
    expect(bridge.seek).toHaveBeenCalledWith(2);
  });

  it('disables scrubbing before ready', () => {
    const bridge = stubBridge({ status: 'loading', ready: null });
    renderScrubber({ fps: 30, timeKind: 'clock' }, bridge);
    expect((screen.getByTestId('scrubber-slider') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('Scrubber (free)', () => {
  it('offers play/pause only, without a slider', () => {
    const bridge = stubBridge();
    renderScrubber({ fps: 30, timeKind: 'free' }, bridge);
    expect(screen.queryByTestId('scrubber-slider')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '재생' }));
    expect(bridge.play).toHaveBeenCalledTimes(1);
    expect(screen.getByText('실시간')).toBeTruthy();
  });
});
