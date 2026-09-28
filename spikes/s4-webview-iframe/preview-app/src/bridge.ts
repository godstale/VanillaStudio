// Preview side of the Vanilla Bridge (spike): origin-checked postMessage with the host window.
export type Msg = { v: 1; type: string; payload?: Record<string, unknown> };

// Dev host (Vite) and packaged host (tauri.localhost) origins.
const HOST_ORIGINS = new Set(['http://localhost:1430', 'http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost']);
let hostOrigin: string | null = null;

export function onHostMessage(handler: (m: Msg) => void) {
  const listener = (e: MessageEvent) => {
    if (!HOST_ORIGINS.has(e.origin) || e.source !== window.parent) return;
    const m = e.data as Msg;
    if (m?.v !== 1) return;
    hostOrigin = e.origin;
    handler(m);
  };
  window.addEventListener('message', listener);
  // Fast Refresh re-runs effects; without cleanup every refresh would add a listener.
  return () => window.removeEventListener('message', listener);
}

export function toHost(type: string, payload: Record<string, unknown> = {}) {
  // Before the first host message we do not know which host origin we are embedded in.
  window.parent.postMessage({ v: 1, type, payload } satisfies Msg, hostOrigin ?? '*');
}

export const afterPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
