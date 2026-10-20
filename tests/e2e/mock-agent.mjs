// 목 에이전트(T4.11, T5.7): 실제 Claude Code·Codex 대신 신 폴더(cwd)에서 에이전트처럼 일하는 스크립트.
//   node tests/e2e/mock-agent.mjs            # MOCK_AGENT_MODE=good(기본) | rogue | broken | late-clock | analyze | analyze-rogue
// 하는 일(good): scene.json을 읽고 → 허용 필드(beats·endCard·duration)만 채우고 → copy.items를 그대로 넣은 소스(src/)를 쓴다.
//   rogue : 허용되지 않은 필드(name)까지 바꾼다.        → 앱이 경고하고 되돌릴 수 있어야 한다.
//   broken: scene.json을 스키마에 어긋나게 쓴다.         → 앱이 invalid로 판정해야 한다.
//   late-clock: 금지 API(Date.now)를 쓴다.             → check:scene이 실패해야 한다.
//   analyze / analyze-rogue: 레퍼런스 분석 태스크. references/analysis/<id>.md와 DESIGN.md의 분석 구간을 쓴다.
//     rogue는 DESIGN.md 구간 밖 본문도 바꾼다.          → 앱이 허용되지 않은 변경으로 경고해야 한다.
// 앱은 에이전트를 조종하지 않는다(D-022): 이 스크립트도 프롬프트를 받지 않고 신 폴더의 파일만 읽는다.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.env.MOCK_AGENT_MODE ?? 'good';
const dir = process.cwd();
const scenePath = join(dir, 'scene.json');
const scene = JSON.parse(readFileSync(scenePath, 'utf8'));
const slug = dir.split(/[/\\]/).pop();
const NL = '\n';

if (mode === 'analyze' || mode === 'analyze-rogue') {
  // 실제 에이전트처럼 레퍼런스 목록과 앱이 뽑아 둔 키프레임을 읽고, 스타일 관찰만 적는다(내용을 복제하지 않는다).
  mkdirSync(join(dir, 'references', 'analysis'), { recursive: true });
  const seen = [];
  for (const ref of scene.references ?? []) {
    const framesDir = join(dir, 'references', 'analysis', ref.id, 'frames');
    const frames = existsSync(framesDir) ? readdirSync(framesDir).filter((n) => n.endsWith('.jpg')).sort() : [];
    seen.push(`${ref.id}: ${frames.length} keyframes`);
    const lines = [`# ${ref.id}`, '', `Kind: ${ref.kind}`, `Keyframes inspected: ${frames.length}`, '', '- palette: warm neutrals', '- pacing: slow, long holds', '- typography: large sans-serif', ''];
    writeFileSync(join(dir, 'references', 'analysis', `${ref.id}.md`), lines.join(NL));
  }
  const designPath = join(dir, 'DESIGN.md');
  const starter = ['---', 'extends: ../../DESIGN.md', 'colors: {}', '---', '', '# Scene design', '', 'User prose.', ''].join(NL);
  const base = existsSync(designPath) ? readFileSync(designPath, 'utf8') : starter;
  const begin = '<!-- vanilla:begin:analysis -->';
  const end = '<!-- vanilla:end:analysis -->';
  const body = [begin, '- mood: warm, calm', `- ${seen.join('; ')}`, end].join(NL);
  const from = base.indexOf(begin);
  const to = base.indexOf(end);
  let next = from !== -1 && to > from ? base.slice(0, from) + body + base.slice(to + end.length) : `${base.replace(/\n*$/, NL)}${NL}${body}${NL}`;
  if (mode === 'analyze-rogue') next = next.replace('User prose.', 'Rewritten by the agent.');
  writeFileSync(designPath, next);
  console.log(`[mock-agent] ${mode}: analysed ${seen.length} reference(s)`);
  process.exit(0);
}

if (mode === 'broken') {
  writeFileSync(scenePath, JSON.stringify({ ...scene, structure: 'not-a-structure' }, null, 2));
  console.log('[mock-agent] wrote an invalid scene.json');
  process.exit(0);
}

const seconds = scene.duration?.seconds ?? 4;
const half = Math.round((seconds / 2) * 1000) / 1000;
const next = {
  ...scene,
  beats: [
    { ...(scene.beats?.[0] ?? {}), id: 'open', start: 0, end: half, role: 'hook', copy: '', visual: '', motion: [], camera: '', transitionOut: '', notes: '' },
    { ...(scene.beats?.[1] ?? {}), id: 'close', start: half, end: seconds, role: 'cta', copy: '', visual: '', motion: [], camera: '', transitionOut: '', notes: '' },
  ],
  endCard: { holdSeconds: 1, elements: scene.endCard?.elements ?? [] },
  status: scene.status,
};
if (mode === 'rogue') next.name = 'Hijacked by the agent';
writeFileSync(scenePath, JSON.stringify(next, null, 2));

const items = scene.copy?.items ?? [];
const clock = mode === 'late-clock' ? 'const wall = Date.now();' : '';
const src = join(dir, 'src');
mkdirSync(src, { recursive: true });
writeFileSync(join(src, 'index.html'), `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8" /><title>${slug}</title></head>\n<body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>\n`);
writeFileSync(
  join(src, 'main.tsx'),
  `import { mountVanilla } from '@vanilla/runtime/app';
import type { Composition } from '@vanilla/runtime';
import composition from './composition';

let dispose = mountVanilla(composition);
if (import.meta.hot) {
  import.meta.hot.accept('./composition', (mod) => {
    if (!mod) return;
    dispose();
    dispose = mountVanilla((mod as unknown as { default: Composition }).default);
  });
}
`,
);
writeFileSync(
  join(src, 'composition.tsx'),
  `import { defineComposition } from '@vanilla/runtime';
import scene from './scene';

export default defineComposition({ scenes: [scene], format: { width: 1920, height: 1080 } });
`,
);
writeFileSync(
  join(src, 'scene.tsx'),
  `import { defineScene, useTime } from '@vanilla/runtime';
${clock}
const COPY = ${JSON.stringify(items)};

function Scene() {
  const t = useTime();
  const line = COPY[Math.min(COPY.length - 1, Math.floor((t / ${seconds}) * COPY.length))] ?? '';
  return (
    <div style={{ color: 'var(--color-ink)', background: 'var(--color-canvas)' }}>
      <span id="copy">{line}</span>
    </div>
  );
}

export default defineScene({ id: ${JSON.stringify(slug)}, duration: ${seconds}, Component: Scene });
`,
);
console.log(`[mock-agent] ${mode}: wrote scene.json fields and src/ for ${slug}`);
