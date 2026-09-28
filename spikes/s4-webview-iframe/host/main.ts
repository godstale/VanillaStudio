// S4 host: drives the preview iframe over the Vanilla Bridge and reports measurements to Rust.
import { invoke } from '@tauri-apps/api/core';

type Msg = { v: 1; type: string; payload?: Record<string, unknown> };

const PREVIEW_ORIGIN = 'http://127.0.0.1:5199';
const frame = document.getElementById('preview') as HTMLIFrameElement;
const logEl = document.getElementById('log')!;
const log = (s: string) => (logEl.textContent += s + '\n');

const waiters = new Map<string, (m: Msg) => void>();
const inbox: Msg[] = [];
const diagnostics: Record<string, unknown>[] = [];
document.addEventListener('securitypolicyviolation', (e) =>
  diagnostics.push({ csp: e.violatedDirective, blocked: e.blockedURI, policy: e.originalPolicy }),
);
frame.addEventListener('load', () => diagnostics.push({ iframeLoad: performance.now() }));
frame.addEventListener('error', () => diagnostics.push({ iframeError: performance.now() }));
window.addEventListener('message', (e) => diagnostics.push({ anyMessageFrom: e.origin, type: (e.data as Msg)?.type }));

window.addEventListener('message', (e) => {
  // Only trust messages from the preview origin.
  if (e.origin !== PREVIEW_ORIGIN || e.source !== frame.contentWindow) return;
  const m = e.data as Msg;
  if (m?.v !== 1) return;
  inbox.push(m);
  const key = `${m.type}:${(m.payload?.id as string | undefined) ?? ''}`;
  waiters.get(key)?.(m);
  waiters.get(`${m.type}:`)?.(m);
});

function waitFor(type: string, id = '', timeoutMs = 10000): Promise<Msg> {
  return new Promise((resolve, reject) => {
    const key = `${type}:${id}`;
    const timer = setTimeout(() => {
      waiters.delete(key);
      reject(new Error(`timeout waiting ${key}`));
    }, timeoutMs);
    waiters.set(key, (m) => {
      clearTimeout(timer);
      waiters.delete(key);
      resolve(m);
    });
  });
}

function send(type: string, payload: Record<string, unknown> = {}) {
  frame.contentWindow!.postMessage({ v: 1, type, payload } satisfies Msg, PREVIEW_ORIGIN);
}

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, min: +s[0].toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2) };
};

async function roundTrips(type: string, make: (i: number) => Record<string, unknown>, n = 60) {
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const id = `${type}-${i}`;
    const started = performance.now();
    const done = waitFor('applied', id);
    send(type, { id, ...make(i) });
    await done;
    times.push(performance.now() - started);
  }
  return stats(times);
}

async function run() {
  const result: Record<string, unknown> = { hostOrigin: location.origin, userAgent: navigator.userAgent };
  const loadStarted = performance.now();
  const ready = await waitFor('ready', '', 30000);
  result.readyMs = +(performance.now() - loadStarted).toFixed(1);
  result.ready = ready.payload;
  log(`ready ${JSON.stringify(ready.payload)}`);

  send('init', { mode: 'preview', paramsValues: { color: '#f2c230' } });
  result.setParams = await roundTrips('setParams', (i) => ({ sceneId: 's1', values: { color: i % 2 ? '#ff4d6d' : '#4dd0ff', speed: 1 + (i % 5) * 0.2 } }));
  log(`setParams ${JSON.stringify(result.setParams)}`);
  result.seek = await roundTrips('seek', (i) => ({ t: (i * 0.37) % 15 }));
  log(`seek ${JSON.stringify(result.seek)}`);

  // HMR: Rust rewrites preview-app/src/label.ts; the preview reports when the new module renders.
  const hmr: number[] = [];
  for (let i = 1; i <= 5; i++) {
    // Agents write files seconds apart; back-to-back writes can be coalesced by the watcher.
    await new Promise((r) => setTimeout(r, 1000));
    const label = `hmr-${i}-${Date.now()}`;
    const started = performance.now();
    const done = waitFor('label', label, 20000);
    await invoke('touch_preview', { label });
    await done;
    hmr.push(performance.now() - started);
    log(`hmr ${i}: ${hmr.at(-1)!.toFixed(0)}ms`);
  }
  result.hmr = stats(hmr);

  // Rapid consecutive writes (agents often save several times in a row): does the last one land?
  const rapid: Record<string, string> = {};
  for (const gap of [0, 30, 100, 300]) {
    await new Promise((r) => setTimeout(r, 1500));
    const a = `rapid-a-${gap}-${Date.now()}`;
    const b = `rapid-b-${gap}-${Date.now()}`;
    const done = waitFor('label', b, 5000);
    await invoke('touch_preview', { label: a });
    await new Promise((r) => setTimeout(r, gap));
    await invoke('touch_preview', { label: b });
    rapid[`gap${gap}ms`] = await done.then(() => 'final version shown').catch(() => 'STALE: final write not reflected');
  }
  result.rapidWrites = rapid;

  // State survives HMR (React Fast Refresh): the last color sent must still be applied.
  const probeId = 'probe';
  const probe = waitFor('state', probeId);
  send('getState', { id: probeId });
  result.stateAfterHmr = (await probe).payload;

  send('isolationCheck', {});
  result.isolation = (await waitFor('isolation')).payload;

  // The host itself must still have IPC.
  result.hostHasIpc = typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ === 'object';
  log(JSON.stringify(result, null, 2));
  await invoke('report', { json: JSON.stringify(result, null, 2) });
}

run().catch(async (e) => {
  log(`FAILED: ${e}`);
  await invoke('report', { json: JSON.stringify({ error: String(e), inbox, diagnostics, csp: document.querySelector('meta[http-equiv]')?.getAttribute('content') ?? null }, null, 2) });
});
