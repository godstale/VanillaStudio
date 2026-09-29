// Preview server for a Vanilla Studio project (Technical-Design section 6, D-012).
// The app starts it with fixed argv: `node vite-runner.mjs --root <project> [--port <n>]`.
// It uses the project's own Vite, binds 127.0.0.1 only and reports the chosen port as one NDJSON line on
// stdout: {"type":"listening","port":N,"url":"http://127.0.0.1:N"}. Everything else Vite prints goes to stderr.
// The process exits non-zero when the server stops unexpectedly so the app can restart it.
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HOST = '127.0.0.1';
const report = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);
const fail = (message, code = 1) => {
  report({ type: 'error', message });
  process.exit(code);
};

function parseArgs(argv) {
  const out = { root: null, port: 0 };
  for (let i = 0; i < argv.length; i += 2) {
    const [k, v] = [argv[i], argv[i + 1]];
    if (k === '--root' && v) out.root = path.resolve(v);
    else if (k === '--port' && /^\d+$/.test(v ?? '')) out.port = Number(v);
    else fail(`unknown argument: ${k}`, 2);
  }
  if (!out.root) fail('--root is required', 2);
  return out;
}

/** An OS-chosen free port. Windows keeps excluded ranges (EACCES); port 0 never lands in them. */
function freePort() {
  return new Promise((resolve, reject) => {
    const s = createNetServer();
    s.once('error', reject);
    s.listen(0, HOST, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/** The project's Vite (ESM entry). Falls back to the CJS resolution when `exports` is unusual. */
async function loadVite(root) {
  const req = createRequire(path.join(root, 'package.json'));
  let pkgJson;
  try {
    pkgJson = req.resolve('vite/package.json');
  } catch {
    fail('vite is not installed in the project (run the dependency install first)');
  }
  const dir = path.dirname(pkgJson);
  const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'));
  const entry = pkg.exports?.['.']?.import?.default ?? pkg.exports?.['.']?.import ?? pkg.module ?? pkg.main;
  const file = path.join(dir, typeof entry === 'string' ? entry : 'dist/node/index.js');
  return import(pathToFileURL(existsSync(file) ? file : req.resolve('vite')).href);
}

const { root, port: wanted } = parseArgs(process.argv.slice(2));
const { createServer } = await loadVite(root);

let server = null;
for (let attempt = 0; attempt < 8 && !server; attempt++) {
  const port = wanted || (await freePort());
  try {
    const s = await createServer({
      root,
      logLevel: 'warn',
      clearScreen: false,
      server: { host: HOST, port, strictPort: true, open: false },
    });
    await s.listen();
    server = s;
  } catch (e) {
    const busy = e && (e.code === 'EACCES' || e.code === 'EADDRINUSE' || /already in use|EACCES/i.test(String(e.message)));
    if (!busy || wanted || attempt === 7) fail(String(e?.message ?? e));
  }
}

const address = server.httpServer?.address();
const boundPort = typeof address === 'object' && address ? address.port : server.config.server.port;
report({ type: 'listening', port: boundPort, url: `http://${HOST}:${boundPort}` });

let closing = false;
const shutdown = async () => {
  closing = true;
  try {
    await server.close();
  } finally {
    process.exit(0);
  }
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
server.httpServer?.on('close', () => {
  if (!closing) process.exit(3);
});
