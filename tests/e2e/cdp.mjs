// Minimal CDP client for the review E2E harness (T4.21). Node 22 globals only (fetch, WebSocket):
// no extra dependencies. Pattern follows spikes/s4-webview-iframe/cdp-probe.mjs.

/** Targets served by the browser's remote-debugging endpoint. */
export async function listTargets(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!res.ok) throw new Error(`cdp list failed: HTTP ${res.status}`);
  return res.json();
}

/** Wait until `pick(targets)` returns a target, then return it. */
export async function waitForTarget(port, pick, { timeoutMs = 60_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let targets = [];
    try {
      targets = await listTargets(port);
    } catch {
      /* browser not up yet */
    }
    const hit = pick(targets);
    if (hit?.webSocketDebuggerUrl) return hit;
    if (Date.now() > deadline) throw new Error('timed out waiting for CDP target');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Attach to one target. `send` resolves with the result; `onEvent` taps protocol events. */
export function attach(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
  const handlers = new Map();

  const ready = new Promise((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(new Error(`cdp socket error: ${e?.message ?? 'unknown'}`));
  });

  ws.onmessage = (ev) => {
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (m.id !== undefined && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(`cdp: ${m.error.message ?? JSON.stringify(m.error)}`));
      else resolve(m.result);
    } else if (m.method) {
      for (const fn of handlers.get(m.method) ?? []) {
        try {
          fn(m.params);
        } catch {
          /* collector bugs must not break the run */
        }
      }
    }
  };

  const closed = new Promise((resolve) => {
    ws.onclose = () => {
      for (const { reject } of pending.values()) reject(new Error('cdp socket closed'));
      pending.clear();
      resolve();
    };
  });

  return {
    ready,
    closed,
    send: (method, params = {}) =>
      ready.then(
        () =>
          new Promise((resolve, reject) => {
            const id = ++seq;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
          }),
      ),
    onEvent: (method, fn) => {
      if (!handlers.has(method)) handlers.set(method, []);
      handlers.get(method).push(fn);
    },
    close: () => ws.close(),
  };
}

/** Collect console errors and page exceptions for the verdict. */
export function collectProblems(session) {
  const problems = [];
  session.onEvent('Runtime.consoleAPICalled', (p) => {
    if (p?.type === 'error') {
      problems.push({ console: (p.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ') });
    }
  });
  session.onEvent('Runtime.exceptionThrown', (p) => {
    problems.push({ exception: p?.exceptionDetails?.exception?.description ?? p?.exceptionDetails?.text ?? 'unknown' });
  });
  session.onEvent('Log.entryAdded', (p) => {
    if (p?.entry?.level === 'error') problems.push({ log: p.entry.text, url: p.entry.url });
  });
  return problems;
}

/**
 * Evaluate JS in the page and return the value. Throws when the page throws, so a missing
 * element probe reads as a harness error rather than a silent undefined.
 */
export async function evaluate(session, expression) {
  const res = await session.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res?.exceptionDetails) {
    throw new Error(`page threw: ${res.exceptionDetails.text ?? JSON.stringify(res.exceptionDetails)}`);
  }
  return res?.result?.value ?? null;
}

/** Poll `expression` until it returns truthy; returns the last value. */
export async function waitForEval(session, expression, { timeoutMs = 60_000, intervalMs = 500, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  for (;;) {
    try {
      last = await evaluate(session, expression);
    } catch {
      last = null;
    }
    if (last) return last;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
