// @vitest-environment node
// 샘플 시퀀스(resources/samples/sequence-demo): motion → static(steps) → 3d + choice 분기. T6.8.
// JSON 파일(workspace·scene·sequence)은 아래 코드가 만든 것과 바이트까지 같아야 한다(정규화 직렬화, 드리프트 방지).
// 다시 만들려면: GEN_SAMPLE=1 pnpm vitest run src/lib/sequence/sampleSequence.test.ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBuiltinTemplate } from '@/lib/guides/template';
import { newScene, parseScene, serializeScene, type Scene } from '@/lib/scene/schema';
import { serializeWorkspace } from '@/lib/workspace/file';
import { addNode, newSequence, parseSequence, serializeSequence, type Sequence } from './schema';
import { hasErrors, validateSequence } from './validate';

const ROOT = resolve(__dirname, '../../../resources/samples/sequence-demo');
const WORKSPACE_ID = 'ws_sampleseq0001';

const motion = (id: string, name: string, seconds: number, items: string[], beats: { id: string; start: number; end: number; role: string }[]): Scene =>
  ({
    ...newScene({ id, name, type: 'motion', template: 'commercial@1' }),
    status: 'generated',
    duration: { seconds },
    copy: { textFidelity: 'exact', items },
    beats: beats.map((b) => ({ ...b, copy: '', visual: '', motion: [], camera: '', transitionOut: '', notes: '' })),
    endCard: { holdSeconds: 1, elements: [] },
  }) as Scene;

const SCENES: Record<string, Scene> = {
  intro: motion('scn_demoIntro01', 'Intro', 4, ['Vanilla Studio', 'Scenes in motion'], [
    { id: 'title', start: 0, end: 2, role: 'hook' },
    { id: 'tagline', start: 2, end: 4, role: 'brand' },
  ]),
  page: {
    ...newScene({ id: 'scn_demoPage001', name: 'Page', type: 'static', template: 'web-page@1' }),
    status: 'generated',
    mode: 'steps',
    steps: ['welcome', 'steps', 'next'].map((id) => ({ id, title: id, copy: '', layout: '', enter: 'crossfade', advance: 'click' })),
  } as Scene,
  globe: {
    ...newScene({ id: 'scn_demoGlobe01', name: 'Globe', type: '3d', template: 'three-scene@1' }),
    status: 'generated',
    duration: { seconds: 3 },
    endCard: { holdSeconds: 1, elements: [] },
    beats: [{ id: 'spin', start: 0, end: 3, role: 'showcase', copy: '', visual: '', motion: [], camera: '', transitionOut: '', notes: '' }],
  } as Scene,
  outro: motion('scn_demoOutro01', 'Outro', 2, ['Thank you'], [{ id: 'thanks', start: 0, end: 2, role: 'cta' }]),
};

const tr = (type: string, durationMs: number, params: Record<string, unknown> = {}) => ({ type, durationMs, easing: 'ease-in-out', params });

function buildSequence(): Sequence {
  let s: Sequence = { ...newSequence(WORKSPACE_ID), mode: 'interactive' };
  const order = ['intro', 'page', 'globe', 'outro'];
  order.forEach((slug, i) => {
    s = addNode(s, SCENES[slug].id, { x: i * 300, y: 0 });
  });
  const id = (slug: string) => SCENES[slug].id;
  return {
    ...s,
    edges: [
      { from: id('intro'), to: id('page'), trigger: 'end', transition: tr('crossfade', 600) },
      { from: id('page'), to: id('globe'), trigger: 'click', transition: tr('slide-left', 500) },
      { from: id('globe'), to: id('outro'), trigger: 'choice:Finish', transition: tr('circular-reveal', 700, { x: 50, y: 50 }) },
      { from: id('globe'), to: id('intro'), trigger: 'choice:Again', transition: tr('zoom-through', 600) },
    ],
  };
}

const workspace = { version: 1 as const, workspaceId: WORKSPACE_ID, name: 'Sequence Demo', canvas: { aspect: '16:9', width: 1280, height: 720, fps: 30 } };

const expected = (): Record<string, string> => ({
  'workspace.json': serializeWorkspace(workspace),
  'sequence.json': serializeSequence(buildSequence()),
  ...Object.fromEntries(Object.entries(SCENES).map(([slug, scene]) => [`scenes/${slug}/scene.json`, serializeScene(scene)])),
});

if (process.env.GEN_SAMPLE) {
  describe('generate sample', () => {
    it('writes the sample JSON files', () => {
      for (const [rel, text] of Object.entries(expected())) {
        mkdirSync(dirname(join(ROOT, rel)), { recursive: true });
        writeFileSync(join(ROOT, rel), text);
      }
    });
  });
}

describe('sample sequence (T6.8)', () => {
  it('JSON files are the canonical output of the generator (no drift)', () => {
    for (const [rel, text] of Object.entries(expected())) {
      expect(existsSync(join(ROOT, rel)), `${rel} exists (run with GEN_SAMPLE=1)`).toBe(true);
      expect(readFileSync(join(ROOT, rel), 'utf8'), rel).toBe(text);
    }
  });

  it('the sequence is valid for its scenes: no errors, no warnings', () => {
    const scenes = new Map(Object.values(SCENES).map((s) => [s.id, { type: s.type, name: s.name }]));
    const seq = parseSequence(readFileSync(join(ROOT, 'sequence.json'), 'utf8'));
    const issues = validateSequence(seq, { workspaceId: WORKSPACE_ID, scenes });
    expect(issues).toEqual([]);
    expect(hasErrors(issues)).toBe(false);
  });

  it('covers motion → static(steps) → 3d with one choice branch', () => {
    const seq = parseSequence(readFileSync(join(ROOT, 'sequence.json'), 'utf8'));
    const type = (id: string) => Object.values(SCENES).find((s) => s.id === id)!.type;
    const path = ['intro', 'page', 'globe'].map((slug) => type(SCENES[slug].id));
    expect(path).toEqual(['motion', 'static', '3d']);
    expect(seq.edges.filter((e) => e.trigger.startsWith('choice:')).map((e) => e.trigger)).toEqual(['choice:Finish', 'choice:Again']);
    expect(seq.start).toBe(SCENES.intro.id);
  });

  it('every scene folder has a parseable scene.json and an entry that exists', () => {
    for (const slug of Object.keys(SCENES)) {
      const scene = parseScene(readFileSync(join(ROOT, 'scenes', slug, 'scene.json'), 'utf8'));
      expect(existsSync(join(ROOT, 'scenes', slug, scene.runtime.entry)), `${slug} entry`).toBe(true);
      expect(scene.template, slug).toMatch(/@1$/);
    }
    expect(readdirSync(join(ROOT, 'scenes')).sort()).toEqual(Object.keys(SCENES).sort());
  });

  it('timed scenes obey the contract rules (the same checker the workspace runs)', async () => {
    const { checkScene } = await import('../../../resources/workspace-template/scripts/check-scene-core.mjs');
    for (const slug of Object.keys(SCENES)) {
      const dir = join(ROOT, 'scenes', slug);
      const files: Record<string, string> = {};
      for (const name of readdirSync(join(dir, 'src'))) files[`src/${name}`] = readFileSync(join(dir, 'src', name), 'utf8');
      const findings = checkScene({ scene: JSON.parse(readFileSync(join(dir, 'scene.json'), 'utf8')), files });
      expect(findings.filter((f: { severity: string }) => f.severity === 'error'), slug).toEqual([]);
      expect(findings.filter((f: { rule: string }) => f.rule === 'no-hardcoded-colors'), slug).toEqual([]);
    }
  });

  it('built-in templates referenced by the scenes exist', () => {
    for (const s of Object.values(SCENES)) expect(getBuiltinTemplate(s.template), s.template).not.toBeNull();
  });
});
