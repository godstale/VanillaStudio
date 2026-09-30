// Supervisor for the review preview E2E (T4.21). Usage:
//   node tests/e2e/run-review-preview.mjs [--port 9223] [--timeout-ms 180000]
//     [--project <dir>]            use this fixture project (must have node_modules/vite)
//     [--prepare [<dir>]]          build a fixture from resources/project-template + pnpm install
//     [--launch dev]               spawn `pnpm tauri dev` with a CDP port (else attach to a running app)
//
// Default (no flags): attach to an app already running with --remote-debugging-port=9223 and a
// prepared project at --project. Exit 0 on pass, 1 on fail; steps print as JSON lines.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForTarget } from './cdp.mjs';
import { runReviewPreviewScenario } from './review-preview.mjs';

const REPO = resolve(join(fileURLToPath(import.meta.url), '..', '..', '..'));

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith('--')) return fallback;
  return next;
}

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`command failed: ${cmd} ${args.join(' ')}`);
}

/** Copy the scaffold template and install it so the preview server can boot (needs vite). */
export function prepareFixture(dir) {
  // A running app may hold the previous fixture open (file watcher); retry briefly on Windows.
  for (let attempt = 0; ; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      break;
    } catch (err) {
      if (attempt >= 4) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  mkdirSync(dir, { recursive: true });
  cpSync(join(REPO, 'resources', 'project-template'), dir, { recursive: true });
  // Scaffolding places the runtime at ./vanilla/runtime (T1.13 `install_runtime`); the template's
  // package.json links @vanilla/runtime there, so pnpm install fails without it.
  cpSync(join(REPO, 'resources', 'runtime'), join(dir, 'vanilla', 'runtime'), {
    recursive: true,
    filter: (src) => !src.split(/[/\\]/).includes('node_modules'),
  });
  if (!existsSync(join(dir, 'node_modules', 'vite'))) {
    console.log(`[e2e] pnpm install in ${dir}`);
    sh('pnpm', ['install'], dir);
  }
  return dir;
}

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGKILL');
  }
}

async function main() {
  const port = Number(process.env.CDP_PORT ?? arg('port', '9223'));
  const timeoutMs = Number(process.env.E2E_TIMEOUT_MS ?? arg('timeout-ms', '180000'));
  const launch = arg('launch', 'none');
  let projectDir = arg('project', process.env.E2E_PROJECT ?? null);
  if (!projectDir) {
    projectDir = resolve(arg('prepare', join(tmpdir(), 'vanilla-e2e-fixture')));
    prepareFixture(projectDir);
  }

  let child = null;
  try {
    if (launch === 'dev') {
      console.log(`[e2e] launching pnpm tauri dev (cdp ${port})`);
      child = spawn('pnpm', ['tauri', 'dev'], {
        cwd: REPO,
        shell: process.platform === 'win32',
        env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` },
        stdio: 'inherit',
      });
      await waitForTarget(port, (ts) => ts.find((t) => t.type === 'page'), { timeoutMs });
    }
    const started = Date.now();
    const result = await runReviewPreviewScenario({ port, projectDir, timeoutMs: Math.max(15_000, timeoutMs - (Date.now() - started)) });
    console.log(`[e2e] PASS\n${JSON.stringify({ projectDir, steps: result.steps }, null, 1)}`);
  } catch (err) {
    console.error(`[e2e] FAIL: ${err?.message ?? err}`);
    process.exitCode = 1;
  } finally {
    if (child) killTree(child);
  }
}

// `node --check` and reuse from other runners must not boot the scenario.
if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  await main();
}
