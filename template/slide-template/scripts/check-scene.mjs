// `pnpm check:scene [slug...]` — runs the scene contract checks and writes scenes/<slug>/.vanilla/self-check.md.
// Exit code 1 when any scene has an error. Without arguments every scene folder is checked.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkScene, renderSelfCheck } from './check-scene-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scenesDir = path.join(root, 'scenes');

function readTree(dir, base = dir, out = {}) {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) readTree(full, base, out);
    else if (statSync(full).size < 2_000_000) out[path.relative(base, full).split(path.sep).join('/')] = readFileSync(full, 'utf8');
  }
  return out;
}

const slugs = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(scenesDir).filter((n) => statSync(path.join(scenesDir, n)).isDirectory());
let failed = false;
for (const slug of slugs) {
  const dir = path.join(scenesDir, slug);
  const rel = path.relative(scenesDir, dir);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.includes(path.sep)) throw new Error(`not a scene folder: ${slug}`);
  let scene;
  try {
    scene = JSON.parse(readFileSync(path.join(dir, 'scene.json'), 'utf8'));
  } catch (e) {
    console.error(`${slug}: cannot read scene.json (${e.message})`);
    failed = true;
    continue;
  }
  let tree = {};
  try {
    tree = readTree(path.join(dir, 'src'));
  } catch {
    // no src/ yet: the "src has no source files" finding reports it
  }
  const files = Object.fromEntries(Object.entries(tree).map(([f, t]) => [`src/${f}`, t]));
  const findings = checkScene({ scene, files });
  mkdirSync(path.join(dir, '.vanilla'), { recursive: true });
  writeFileSync(path.join(dir, '.vanilla', 'self-check.md'), renderSelfCheck(scene.name ?? slug, findings));
  const errors = findings.filter((f) => f.severity === 'error').length;
  console.log(`${slug}: ${errors === 0 ? 'PASS' : 'FAIL'} (${errors} errors, ${findings.length - errors} warnings)`);
  for (const f of findings) console.log(`  [${f.severity}] ${f.rule}: ${f.message}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : ''}`);
  if (errors > 0) failed = true;
}
process.exit(failed ? 1 : 0);
