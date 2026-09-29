import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { BridgeProvider } from './BridgeContext';
import { useBridge } from './bridgeContextValue';
import { BRIDGE_VERSION } from './bridgeProtocol';

const ORIGIN = 'http://127.0.0.1:5173';

const readyPayload = {
  scenes: [{ id: 's1', duration: 5, params: {} }],
  duration: 5,
  format: '1920x1080',
  design: { hash: 'abc', roles: {} },
};

interface FakeFrame {
  posted: unknown[];
  postMessage: (msg: unknown) => void;
}

function makeFrame(): FakeFrame {
  const frame: FakeFrame = {
    posted: [],
    postMessage: (msg: unknown) => {
      frame.posted.push(msg);
    },
  };
  return frame;
}

function Harness({ frame }: { frame: FakeFrame }) {
  const bridge = useBridge();
  useEffect(() => {
    bridge.registerFrame(frame as unknown as Window);
    return () => bridge.registerFrame(null);
    // registerFrame is stable; bridge identity changes are harmless here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);
  return (
    <>
      <span data-testid="status">{bridge.status}</span>
      <span data-testid="ready-count">{bridge.readyCount}</span>
      <span data-testid="error">{bridge.error?.message ?? ''}</span>
    </>
  );
}

function post(origin: string, source: unknown, data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { origin, source: source as Window, data }));
  });
}

describe('BridgeProvider', () => {
  it('stays loading until a trusted ready arrives, then sends init', () => {
    const frame = makeFrame();
    render(
      <BridgeProvider previewOrigin={ORIGIN}>
        <Harness frame={frame} />
      </BridgeProvider>,
    );
    expect(screen.getByTestId('status').textContent).toBe('loading');

    post(ORIGIN, frame, { v: BRIDGE_VERSION, type: 'ready', payload: readyPayload });
    expect(screen.getByTestId('status').textContent).toBe('ready');
    expect(screen.getByTestId('ready-count').textContent).toBe('1');
    expect(frame.posted).toHaveLength(1);
    expect(frame.posted[0]).toMatchObject({ v: BRIDGE_VERSION, type: 'init', payload: { mode: 'preview' } });
  });

  it('ignores messages from other origins or windows', () => {
    const frame = makeFrame();
    render(
      <BridgeProvider previewOrigin={ORIGIN}>
        <Harness frame={frame} />
      </BridgeProvider>,
    );
    post('http://localhost:1430', frame, { v: BRIDGE_VERSION, type: 'ready', payload: readyPayload });
    post(ORIGIN, makeFrame(), { v: BRIDGE_VERSION, type: 'ready', payload: readyPayload });
    post(ORIGIN, frame, { v: BRIDGE_VERSION, type: 'ready', payload: { broken: true } });
    expect(screen.getByTestId('status').textContent).toBe('loading');
    expect(frame.posted).toHaveLength(0);
  });

  it('reports scene errors until the next ready clears them', () => {
    const frame = makeFrame();
    render(
      <BridgeProvider previewOrigin={ORIGIN}>
        <Harness frame={frame} />
      </BridgeProvider>,
    );
    post(ORIGIN, frame, { v: BRIDGE_VERSION, type: 'ready', payload: readyPayload });
    post(ORIGIN, frame, {
      v: BRIDGE_VERSION,
      type: 'error',
      payload: { message: 'boom', stack: '', sceneId: 's1' },
    });
    expect(screen.getByTestId('error').textContent).toBe('boom');
    post(ORIGIN, frame, { v: BRIDGE_VERSION, type: 'ready', payload: readyPayload });
    expect(screen.getByTestId('error').textContent).toBe('');
    expect(screen.getByTestId('ready-count').textContent).toBe('2');
  });
});
