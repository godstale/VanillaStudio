// Attach to WebView2 over CDP (WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223)
// and dump console output, exceptions and a DOM probe for every page/iframe target.
const port = Number(process.env.CDP_PORT ?? 9223);
const seconds = Number(process.argv[2] ?? 20);
const seen = new Set();
const out = [];

async function attach(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  const call = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
  ws.onopen = () => {
    call('Runtime.enable');
    call('Log.enable');
    call('Runtime.evaluate', {
      expression: `JSON.stringify({ href: location.href, ready: document.readyState, bodyLen: document.body?.innerHTML.length, canvases: document.querySelectorAll('canvas').length, tauri: typeof window.__TAURI_INTERNALS__ })`,
      returnByValue: true,
    });
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    const tag = `${t.type}:${t.url}`;
    if (m.method === 'Runtime.consoleAPICalled') out.push({ tag, console: m.params.type, args: m.params.args.map((a) => a.value ?? a.description) });
    else if (m.method === 'Runtime.exceptionThrown') out.push({ tag, exception: m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text });
    else if (m.method === 'Log.entryAdded') out.push({ tag, log: m.params.entry.level, text: m.params.entry.text, url: m.params.entry.url });
    else if (m.result?.result?.value) out.push({ tag, probe: JSON.parse(m.result.result.value) });
  };
}

const deadline = Date.now() + seconds * 1000;
while (Date.now() < deadline) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    for (const t of targets) {
      if (seen.has(t.id) || !t.webSocketDebuggerUrl) continue;
      seen.add(t.id);
      out.push({ target: t.type, url: t.url });
      attach(t);
    }
  } catch {
    /* webview not up yet */
  }
  await new Promise((r) => setTimeout(r, 500));
}
console.log(JSON.stringify(out, null, 1));
process.exit(0);
