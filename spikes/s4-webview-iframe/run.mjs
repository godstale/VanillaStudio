// S4 orchestration: preview dev server → tauri dev (host) → wait for out/result.json → clean up.
import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const result = 'out/result.json';
rmSync(result, { force: true });
writeFileSync('preview-app/src/label.ts', "export const LABEL = 'initial';\n");

const start = (cmd, name) => {
  const p = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  return p;
};
const killTree = (p) => {
  try {
    execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    /* already gone */
  }
};

const preview = start('pnpm preview', 'preview');
await new Promise((r) => setTimeout(r, 3000));
const tauri = start('pnpm tauri dev', 'tauri');

const deadline = Date.now() + 15 * 60 * 1000; // first build compiles tauri
while (!existsSync(result) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 1000));
await new Promise((r) => setTimeout(r, 4000));
killTree(tauri);
killTree(preview);
writeFileSync('preview-app/src/label.ts', "export const LABEL = 'initial';\n");
console.log(existsSync(result) ? readFileSync(result, 'utf8') : 'NO RESULT (timeout)');
process.exit(0);
