// S1: render the built composition twice and compare decoded frames (determinism check).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = 'out';
mkdirSync(out, { recursive: true });
const env = { ...process.env, DO_NOT_TRACK: '1', HYPERFRAMES_SKIP_SKILLS: '1' };
const hf = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const extra = process.argv.slice(2);
const ffmpeg = process.env.HYPERFRAMES_FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.HYPERFRAMES_FFPROBE_PATH ?? 'ffprobe';

const results = [];
for (const name of ['run1', 'run2']) {
  const file = `${out}/${name}.mp4`;
  const started = Date.now();
  const r = spawnSync(hf, ['hyperframes', 'render', 'dist', '-o', file, '--quiet', ...extra], {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const seconds = (Date.now() - started) / 1000;
  if (r.status !== 0) throw new Error(`${name} failed with status ${r.status}`);
  results.push({ name, file, seconds });
  console.log(`${name}: ${seconds.toFixed(1)}s`);
}

const md5 = (file) =>
  execFileSync(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:v', '-f', 'framemd5', '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').at(-1).trim());

const a = md5(results[0].file);
const b = md5(results[1].file);
const diff = a.map((h, i) => (h === b[i] ? null : i)).filter((i) => i !== null);
const probe = execFileSync(
  ffprobe,
  ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames,codec_name', '-of', 'json', results[0].file],
  { encoding: 'utf8' },
);

for (const t of [0, 1, 3.2, 7.5, 14.9]) {
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-ss', String(t), '-i', results[0].file, '-frames:v', '1', `${out}/frame-${t}.png`]);
}

const summary = {
  renders: results,
  frames: { run1: a.length, run2: b.length, differing: diff.length, firstDiffs: diff.slice(0, 10) },
  stream: JSON.parse(probe).streams[0],
};
writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
