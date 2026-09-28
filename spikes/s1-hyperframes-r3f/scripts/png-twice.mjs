// S1: render raw PNG frames twice and hash them — isolates capture determinism from the encoder.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync } from 'node:fs';

const env = { ...process.env, DO_NOT_TRACK: '1', HYPERFRAMES_SKIP_SKILLS: '1' };
const extra = process.argv.slice(2);
const runs = [];
for (const name of ['png1', 'png2']) {
  const dir = `out/${name}`;
  rmSync(dir, { recursive: true, force: true });
  const started = Date.now();
  const r = spawnSync('npx', ['hyperframes', 'render', 'dist', '--format', 'png-sequence', '-o', dir, '--quiet', ...extra], {
    env,
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) throw new Error(`${name} failed`);
  const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const hashes = files.map((f) => createHash('sha1').update(readFileSync(`${dir}/${f}`)).digest('hex'));
  runs.push({ name, seconds: (Date.now() - started) / 1000, files, hashes });
}
const [a, b] = runs;
const diff = a.hashes.map((h, i) => (h === b.hashes[i] ? null : i)).filter((i) => i !== null);
console.log(JSON.stringify({
  seconds: runs.map((r) => r.seconds),
  frames: [a.files.length, b.files.length],
  differing: diff.length,
  diffs: diff.slice(0, 40),
}, null, 2));
