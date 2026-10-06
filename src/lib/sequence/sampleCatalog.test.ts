// @vitest-environment node
// 샘플 4종(T7.6): motion(강동 숲속 도서관)·static(랜딩 페이지)·3d(토러스 쇼케이스)·시퀀스(sequence-demo).
// 각 샘플의 JSON(workspace·scene·sequence)은 아래 코드가 만든 것과 바이트까지 같아야 한다(드리프트 방지). sequence-demo는 sampleSequence.test.ts가 같은 방식으로 지킨다.
// 다시 만들려면: GEN_SAMPLE=1 pnpm vitest run src/lib/sequence/sampleCatalog.test.ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBuiltinTemplate } from '@/lib/guides/template';
import { renderSceneFiles } from '@/lib/scene/files';
import { newScene, parseScene, serializeScene, type Scene } from '@/lib/scene/schema';
import { serializeWorkspace } from '@/lib/workspace/file';
import { addNode, newSequence, parseSequence, serializeSequence } from './schema';
import { hasErrors, validateSequence } from './validate';

const SAMPLES = resolve(__dirname, '../../../resources/samples');

interface Sample {
  dir: string;
  workspaceId: string;
  name: string;
  canvas: { aspect: string; width: number; height: number; fps: number };
  slug: string;
  scene: Scene;
}

const brief = (subject: string, goal: string, audience: string, message: string, language: 'ko' | 'en') => ({ subject, goal, audience, message, language });

const forest = ({
  ...newScene({ id: 'scn_forestPromo01', name: '강동 숲속 도서관 강좌 홍보', type: 'motion', template: 'commercial@1', language: 'ko' }),
  status: 'generated',
  brief: brief('강동 숲속 도서관 재능기부 강좌', '강좌 참여 유도', '지역 주민·개발 입문자', '숲에서, AI를 만나다.', 'ko'),
  duration: { seconds: 10 },
  structure: 'multi-shot',
  copy: { textFidelity: 'exact', items: ['AI의 역사', 'LLM의 원리 이해', '바이브 코딩 입문', '재능기부 강좌', '숲에서, AI를 만나다.', '강동 숲속 도서관'] },
  beats: [
    { id: 'books', start: 0, end: 1.6, role: 'opening', copy: '', visual: 'books grow into trees', motion: [], camera: '', transitionOut: 'crossfade', notes: '' },
    { id: 'history', start: 1.6, end: 3.4, role: 'topic-1', copy: '', visual: 'timeline of dots', motion: [], camera: '', transitionOut: 'crossfade', notes: '' },
    { id: 'llm', start: 3.4, end: 5.2, role: 'topic-2', copy: '', visual: 'tree of tokens', motion: [], camera: '', transitionOut: 'crossfade', notes: '' },
    { id: 'vibe', start: 5.2, end: 7, role: 'topic-3', copy: '', visual: 'paper cards and bars', motion: [], camera: '', transitionOut: 'crossfade', notes: '' },
    { id: 'volunteer', start: 7, end: 8.4, role: 'topic-4', copy: '', visual: 'icons over small trees', motion: [], camera: '', transitionOut: 'circular-reveal', notes: '' },
    { id: 'closing', start: 8.4, end: 10, role: 'closing', copy: '', visual: 'tagline and library name', motion: [], camera: '', transitionOut: '', notes: '' },
  ],
  endCard: { holdSeconds: 1.6, elements: ['tagline', 'library name'] },
}) as unknown as Scene;

const landing = ({
  ...newScene({ id: 'scn_landing00001', name: 'Morning Grain landing', type: 'static', template: 'web-page@1', language: 'en' }),
  status: 'generated',
  brief: brief('Morning Grain coffee subscription', 'Start subscriptions', 'Home coffee drinkers, 25-40', 'Fresh-roasted beans, every week', 'en'),
  mode: 'scroll',
  sections: ['hero', 'how-it-works', 'beans'],
  layout: 'single column, centered hero, three-column cards',
  breakpoints: ['1440', '390'],
  accessibility: ['semantic landmarks', 'contrast 4.5:1'],
}) as unknown as Scene;

const torus = ({
  ...newScene({ id: 'scn_torus0000001', name: 'Torus showcase', type: '3d', template: 'three-scene@1', language: 'en' }),
  status: 'generated',
  brief: brief('Rotating torus knot', 'Show the 3D runtime', 'Developers', 'Deterministic 3D', 'en'),
  duration: { seconds: 6 },
  beats: [{ id: 'spin', start: 0, end: 6, role: 'showcase', copy: '', visual: 'torus knot rotating', motion: [], camera: 'static', transitionOut: '', notes: '' }],
  endCard: { holdSeconds: 1, elements: [] },
  composition: 'one centered object',
  materials: ['metallic, medium roughness'],
  lighting: 'ambient plus one key light',
  cameraPath: 'static front camera',
  performanceBudget: 'one mesh, under 10k triangles',
}) as unknown as Scene;

const SAMPLE_LIST: Sample[] = [
  { dir: 'gangdong-forest-library-promo', workspaceId: 'ws_gangdongforest1', name: 'Gangdong Forest Library Promo', canvas: { aspect: '16:9', width: 1920, height: 1080, fps: 30 }, slug: 'forest-promo', scene: forest },
  { dir: 'landing-page', workspaceId: 'ws_landingpage0001', name: 'Landing Page', canvas: { aspect: '16:9', width: 1920, height: 1080, fps: 30 }, slug: 'landing', scene: landing },
  { dir: 'torus-showcase', workspaceId: 'ws_torusshowcase01', name: 'Torus Showcase', canvas: { aspect: '16:9', width: 1280, height: 720, fps: 30 }, slug: 'knot', scene: torus },
];

const filesOf = (s: Sample): Record<string, string> => ({
  'workspace.json': serializeWorkspace({ version: 1, workspaceId: s.workspaceId, name: s.name, canvas: s.canvas }),
  'sequence.json': serializeSequence({ ...addNode(newSequence(s.workspaceId), s.scene.id, { x: 0, y: 0 }), mode: 'linear' }),
  [`scenes/${s.slug}/scene.json`]: serializeScene(s.scene),
});

if (process.env.GEN_SAMPLE) {
  describe('generate samples', () => {
    it('writes the sample JSON files', () => {
      for (const s of SAMPLE_LIST) {
        for (const [rel, text] of Object.entries(filesOf(s))) {
          const p = join(SAMPLES, s.dir, rel);
          mkdirSync(dirname(p), { recursive: true });
          writeFileSync(p, text);
        }
      }
    });
  });
}

describe.each(SAMPLE_LIST)('sample $dir', (s) => {
  const root = join(SAMPLES, s.dir);

  it('JSON files are the canonical output of the generator (no drift)', () => {
    for (const [rel, text] of Object.entries(filesOf(s))) {
      expect(existsSync(join(root, rel)), `${rel} exists (run with GEN_SAMPLE=1)`).toBe(true);
      expect(readFileSync(join(root, rel), 'utf8'), rel).toBe(text);
    }
  });

  it('the scene entry and the sources exist; the one-scene sequence is valid', () => {
    const scene = parseScene(readFileSync(join(root, 'scenes', s.slug, 'scene.json'), 'utf8'));
    for (const f of [scene.runtime.entry, 'src/main.tsx', 'src/composition.tsx', 'src/scene.tsx']) expect(existsSync(join(root, 'scenes', s.slug, f)), f).toBe(true);
    const seq = parseSequence(readFileSync(join(root, 'sequence.json'), 'utf8'));
    expect(validateSequence(seq, { workspaceId: s.workspaceId, scenes: new Map([[scene.id, { type: scene.type, name: scene.name }]]) })).toEqual([]);
    expect(seq.start).toBe(scene.id);
  });

  it('the guide files render deterministically from scene.json with the sample template', () => {
    const scene = parseScene(readFileSync(join(root, 'scenes', s.slug, 'scene.json'), 'utf8'));
    const template = getBuiltinTemplate(scene.template);
    expect(template, scene.template).not.toBeNull();
    const ctx = { workspace: { id: s.workspaceId, name: s.name }, scene, template: template! };
    const a = renderSceneFiles(ctx, { agents: null, claude: null });
    expect(renderSceneFiles(ctx, { agents: null, claude: null })).toEqual(a);
    expect(a['AGENTS.md']).toContain(`workspaceId: ${s.workspaceId}`);
    expect(a['GUIDE.md']).toContain(scene.name);
    for (const text of Object.values(a)) expect(text).not.toMatch(/[A-Za-z]:[\\/]/);
  });

  it('passes the same contract check the workspace runs: no errors', async () => {
    const { checkScene } = await import('../../../resources/workspace-template/scripts/check-scene-core.mjs');
    const dir = join(root, 'scenes', s.slug);
    const files: Record<string, string> = {};
    for (const name of readdirSync(join(dir, 'src'))) files[`src/${name}`] = readFileSync(join(dir, 'src', name), 'utf8');
    const findings = checkScene({ scene: JSON.parse(readFileSync(join(dir, 'scene.json'), 'utf8')), files }) as { severity: string; rule: string; message: string }[];
    expect(findings.filter((f) => f.severity === 'error'), JSON.stringify(findings.filter((f) => f.severity === 'error'))).toEqual([]);
  });
});

describe('sample catalog', () => {
  it('covers motion, static and 3d, plus the sequence sample', () => {
    expect(SAMPLE_LIST.map((s) => s.scene.type).sort()).toEqual(['3d', 'motion', 'static']);
    expect(existsSync(join(SAMPLES, 'sequence-demo', 'sequence.json'))).toBe(true);
    expect(readdirSync(SAMPLES).sort()).toEqual(['gangdong-forest-library-promo', 'landing-page', 'sequence-demo', 'torus-showcase']);
  });

  it('the original standalone Gangdong html is kept as provenance, not as the sample entry', () => {
    expect(existsSync(join(SAMPLES, 'gangdong-forest-library-promo', 'index.html'))).toBe(false);
    expect(existsSync(join(SAMPLES, 'gangdong-forest-library-promo', 'scenes', 'forest-promo', 'v1-archive', 'standalone.html'))).toBe(true);
  });

  it('motion samples never read the clock or random numbers', () => {
    const draw = readFileSync(join(SAMPLES, 'gangdong-forest-library-promo', 'scenes', 'forest-promo', 'src', 'draw.ts'), 'utf8');
    const code = draw.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'); // comments may mention the banned names
    expect(code).not.toMatch(/Date\.now|performance\.now|Math\.random|requestAnimationFrame|setInterval/);
  });

  it('validateSequence reports no problems for any single-scene sample', () => {
    for (const s of SAMPLE_LIST) {
      const seq = parseSequence(readFileSync(join(SAMPLES, s.dir, 'sequence.json'), 'utf8'));
      expect(hasErrors(validateSequence(seq, { workspaceId: s.workspaceId, scenes: new Map([[s.scene.id, { type: s.scene.type, name: s.scene.name }]]) })), s.dir).toBe(false);
    }
  });
});
