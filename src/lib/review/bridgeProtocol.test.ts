import { describe, expect, it } from 'vitest';
import {
  BRIDGE_VERSION,
  isTrustedSource,
  parseSceneMessage,
  previewFrameUrl,
  previewOriginOf,
} from './bridgeProtocol';

const readyPayload = {
  scenes: [{ id: 's1', duration: 5, params: {} }],
  duration: 5,
  format: '1920x1080',
  design: { hash: 'abc', roles: { bg: '#ffffff' } },
};

describe('parseSceneMessage', () => {
  it('accepts a well-formed ready message', () => {
    const msg = parseSceneMessage({ v: BRIDGE_VERSION, type: 'ready', payload: readyPayload });
    expect(msg?.type).toBe('ready');
    if (msg?.type === 'ready') expect(msg.payload.scenes).toHaveLength(1);
  });

  it('accepts time, error, hmr and captured messages', () => {
    expect(parseSceneMessage({ v: 1, type: 'time', payload: { t: 1.5, sceneId: 's1' } })?.type).toBe('time');
    expect(
      parseSceneMessage({ v: 1, type: 'error', payload: { message: 'boom', stack: '', sceneId: null } })?.type,
    ).toBe('error');
    expect(parseSceneMessage({ v: 1, type: 'hmr', payload: { modules: ['a.tsx'], at: 3 } })?.type).toBe('hmr');
    expect(
      parseSceneMessage({
        v: 1,
        type: 'captured',
        payload: { dataUrl: 'data:image/png;base64,AAA', scale: 1, id: 'cap-1' },
      })?.type,
    ).toBe('captured');
  });

  it('rejects wrong versions, unknown types and bad payloads', () => {
    expect(parseSceneMessage({ v: 999, type: 'time', payload: { t: 0, sceneId: null } })).toBeNull();
    expect(parseSceneMessage({ v: 1, type: 'nope', payload: {} })).toBeNull();
    expect(parseSceneMessage({ v: 1, type: 'time', payload: { t: 'now', sceneId: null } })).toBeNull();
    expect(parseSceneMessage({ v: 1, type: 'captured', payload: { dataUrl: 'http://x/y.png', scale: 1 } })).toBeNull();
    expect(parseSceneMessage(null)).toBeNull();
    expect(parseSceneMessage('ready')).toBeNull();
  });
});

describe('isTrustedSource', () => {
  const frame = {};
  it('accepts only the registered frame at the preview origin', () => {
    const origin = 'http://127.0.0.1:5173';
    expect(isTrustedSource({ origin, source: frame }, origin, frame)).toBe(true);
    expect(isTrustedSource({ origin: 'http://localhost:1430', source: frame }, origin, frame)).toBe(false);
    expect(isTrustedSource({ origin, source: {} }, origin, frame)).toBe(false);
    expect(isTrustedSource({ origin, source: frame }, null, frame)).toBe(false);
    expect(isTrustedSource({ origin, source: frame }, origin, null)).toBe(false);
  });
});

describe('previewOriginOf', () => {
  it('accepts only loopback http with an explicit port', () => {
    expect(previewOriginOf('http://127.0.0.1:5173/')).toBe('http://127.0.0.1:5173');
    expect(previewOriginOf('http://localhost:5173/')).toBeNull();
    expect(previewOriginOf('https://127.0.0.1:5173/')).toBeNull();
    expect(previewOriginOf('http://127.0.0.1/')).toBeNull();
    expect(previewOriginOf(null)).toBeNull();
    expect(previewOriginOf('not a url')).toBeNull();
  });
});

describe('previewFrameUrl', () => {
  it('pins the host origin the runtime talks back to', () => {
    const url = previewFrameUrl('http://127.0.0.1:5173/some/path?a=b', 'http://localhost:1430');
    const u = new URL(url);
    expect(u.origin).toBe('http://127.0.0.1:5173');
    expect(u.pathname).toBe('/');
    expect(u.searchParams.get('host')).toBe('http://localhost:1430');
  });
});
