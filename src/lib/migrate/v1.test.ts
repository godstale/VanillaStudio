// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sceneSchema } from '@/lib/scene/schema';
import { beatsFromPlan, canvasFromFormat, parseBrief, planV1Migration, sceneTypeFor, type V1Bundle } from './v1';

const FIXTURES = resolve(__dirname, '../../../tests/fixtures/v1');
const TEXT_EXT = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'css', 'html', 'json', 'md', 'svg', 'glsl', 'vert', 'frag', 'txt', 'csv']);
const WANTED = new Set(['vanilla.json', 'DESIGN.md', 'frame.md', 'index.html', 'brief', 'plan', 'assets', 'src', 'params', 'public']);

/** Rust `read_v1_project`와 같은 규칙으로 폴더를 번들로 읽는다(테스트용 미러). */
function readBundle(root: string): V1Bundle {
  const out: V1Bundle = { root, texts: {}, binaries: [], skipped: [] };
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith('.') || name === 'node_modules' || name === 'dist') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const rel = relative(root, p).split(sep).join('/');
        const ext = name.split('.').pop()?.toLowerCase() ?? '';
        if (TEXT_EXT.has(ext)) out.texts[rel] = readFileSync(p, 'utf8');
        else out.binaries.push(rel);
      }
    }
  };
  for (const name of readdirSync(root).sort()) {
    if (name.startsWith('.')) continue;
    if (!WANTED.has(name)) out.skipped.push(name);
    else if (statSync(join(root, name)).isDirectory()) walk(join(root, name));
    else out.texts[name] = readFileSync(join(root, name), 'utf8');
  }
  return out;
}

const bundle = (name: string) => readBundle(join(FIXTURES, name));
const planOf = (name: string, opts = {}) => {
  const r = planV1Migration(bundle(name), opts);
  if (!r.ok) throw new Error(r.error);
  return r.plan;
};

describe('mapping rules', () => {
  it('output type → scene type', () => {
    expect(sceneTypeFor('web', {})).toBe('static');
    expect(sceneTypeFor('slides', {})).toBe('static');
    expect(sceneTypeFor('video', {})).toBe('motion');
    expect(sceneTypeFor('image', {})).toBe('motion');
    expect(sceneTypeFor('interactive', {})).toBe('static');
    expect(sceneTypeFor('interactive', { interactiveAs: 'motion' })).toBe('motion');
  });

  it('format → canvas keeps presets and derives other ratios', () => {
    expect(canvasFromFormat({ width: 1920, height: 1080, fps: 24 })).toEqual({ aspect: '16:9', width: 1920, height: 1080, fps: 24 });
    expect(canvasFromFormat({ width: 1080, height: 1920 })).toEqual({ aspect: '9:16', width: 1080, height: 1920, fps: 30 });
    expect(canvasFromFormat({ width: 1200, height: 800 })).toEqual({ aspect: '3:2', width: 1200, height: 800, fps: 30 });
    expect(canvasFromFormat({ width: 1237, height: 911 }).aspect).toBe('custom');
    expect(canvasFromFormat({ width: 99999, height: 4 })).toMatchObject({ width: 7680, height: 16 });
  });

  it('brief.md: headings and "key: value" lines, in Korean and English', () => {
    expect(parseBrief('## 목적\nSell it.\n\n## 대상\nTeams\n\n## 핵심 메시지\nWarm')).toEqual({ subject: '', goal: 'Sell it.', audience: 'Teams', message: 'Warm' });
    expect(parseBrief('Goal: promote\nAudience: customers\n- Message: it works\nSubject: Widget')).toEqual({ subject: 'Widget', goal: 'promote', audience: 'customers', message: 'it works' });
    expect(parseBrief('free text only')).toEqual({ subject: '', goal: '', audience: '', message: '' });
    expect(parseBrief('')).toEqual({ subject: '', goal: '', audience: '', message: '' });
  });

  it('plan scenes → contiguous beats; unusable times give null', () => {
    const r = beatsFromPlan([{ id: 'a', start: 0, end: 3, purpose: 'Hook' }, { id: 'b', start: 5, end: 9 }, { id: 'a', start: 9, end: 10 }]);
    expect(r?.seconds).toBe(8);
    expect(r?.beats.map((b) => [b.id, b.start, b.end])).toEqual([['a', 0, 3], ['b', 3, 7], ['a-3', 7, 8]]);
    expect(beatsFromPlan([{ id: 'a' }])).toBeNull();
    expect(beatsFromPlan([{ id: 'a', start: 0, end: 3 }, { id: 'b' }])).toBeNull();
    expect(beatsFromPlan([{ id: 'a', start: 3, end: 3 }])).toBeNull();
    expect(beatsFromPlan([])).toBeNull();
  });
});

describe('the three v1 samples', () => {
  it('web-landing → static scroll scene with sections', () => {
    const p = planOf('web-landing');
    const scene = p.scene('scn_X1');
    expect(p.sceneType).toBe('static');
    expect(p.canvas).toEqual({ aspect: '16:9', width: 1920, height: 1080, fps: 30 });
    expect(scene).toMatchObject({ type: 'static', mode: 'scroll', name: 'web-landing', status: 'generated', sections: ['Hero', 'Features'] });
    expect(scene.brief).toMatchObject({ goal: 'Sell the product.', audience: 'Small teams.', message: 'Simple and warm.', language: 'ko' });
    expect(sceneSchema.safeParse(scene).success).toBe(true);
  });

  it('video-promo → motion scene with beats from the plan and the declared duration', () => {
    const p = planOf('video-promo');
    const scene = p.scene('scn_X2') as unknown as { type: string; duration: { seconds: number }; beats: { id: string; start: number; end: number; role: string }[]; endCard: { holdSeconds: number } };
    expect(scene.type).toBe('motion');
    expect(scene.duration.seconds).toBe(7);
    expect(scene.beats.map((b) => [b.id, b.start, b.end, b.role])).toEqual([['intro', 0, 3, 'Hook'], ['main', 3, 7, 'Demo']]);
    expect(scene.endCard.holdSeconds).toBeGreaterThanOrEqual(0.7);
    expect(sceneSchema.safeParse(scene).success).toBe(true);
  });

  it('slides-deck → static steps scene, one click step per plan slide', () => {
    const scene = planOf('slides-deck').scene('scn_X3') as unknown as { mode: string; steps: { id: string; advance: string }[] };
    expect(scene.mode).toBe('steps');
    expect(scene.steps.map((s) => [s.id, s.advance])).toEqual([['s1', 'click'], ['s2', 'click'], ['s3', 'click']]);
    expect(sceneSchema.safeParse(scene).success).toBe(true);
  });

  it('every sample keeps its code, params, design, materials and credits where v2 expects them', () => {
    for (const name of ['web-landing', 'video-promo', 'slides-deck']) {
      const p = planOf(name);
      const b = bundle(name);
      for (const rel of Object.keys(b.texts).filter((r) => r.startsWith('src/'))) expect(p.sceneFiles[rel], `${name}:${rel}`).toBe(b.texts[rel]);
      expect(p.sceneFiles['src/index.html']).toContain('./main.tsx');
      expect(Object.keys(p.sceneFiles).filter((r) => r.startsWith('params/'))).toHaveLength(1);
      expect(p.workspaceFiles['DESIGN.md']).toBe(b.texts['DESIGN.md']);
      expect(p.workspaceFiles['public/readme.txt']).toBe(b.texts['public/readme.txt']);
      expect(p.sceneFiles['CREDITS.md']).toBe(b.texts['assets/CREDITS.md']);
      expect(p.sceneFiles['references/materials/logo.svg']).toBe(b.texts['brief/materials/logo.svg']);
    }
  });

  it('what could not be converted is listed with a reason, never silently dropped', () => {
    const p = planOf('video-promo');
    const items = p.unconverted.map((u) => `${u.kind}:${u.item}`);
    expect(items).toContain('archived:brief/brief.md');
    expect(items).toContain('archived:plan/plan.json');
    expect(items).toContain('archived:plan/plan.md');
    expect(items).toContain('dropped:reviews/');
    expect(items).toContain('dropped:prompts/');
    expect(items.some((i) => i.startsWith('partial:brief/materials/notes.txt'))).toBe(true); // copied, not registered
    expect(items.some((i) => i.startsWith('dropped:vanilla.json'))).toBe(true);
    expect(p.sceneFiles['v1-archive/plan.json']).toBe(bundle('video-promo').texts['plan/plan.json']);
    for (const u of p.unconverted) expect(u.detail.length).toBeGreaterThan(5);
  });

  it('a registered reference points at an image material (svg is not registered, only raster/video are)', () => {
    const refs = planOf('web-landing').scene('scn_Z').references;
    expect(refs).toEqual([]); // the sample only has an svg and a txt
  });

  it('binary files are scheduled for copying, never read', () => {
    const b = bundle('web-landing');
    const withBinaries: V1Bundle = { ...b, binaries: ['src/assets/logo.png', 'public/font.woff2', 'brief/materials/photo.jpg', 'exports/x.mp4'] };
    const r = planV1Migration(withBinaries);
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.copies).toEqual([
      { from: 'src/assets/logo.png', scope: 'scene', to: 'src/assets/logo.png' },
      { from: 'public/font.woff2', scope: 'workspace', to: 'public/font.woff2' },
      { from: 'brief/materials/photo.jpg', scope: 'scene', to: 'references/materials/photo.jpg' },
    ]);
    expect(r.plan.scene('scn_Z').references.map((x) => [x.kind, x.path])).toContainEqual(['image', 'references/materials/photo.jpg']);
  });

  it('interactive projects follow the chosen scene type', () => {
    const b = bundle('web-landing');
    const interactive: V1Bundle = { ...b, texts: { ...b.texts, 'vanilla.json': b.texts['vanilla.json'].replace('"web"', '"interactive"') } };
    const asStatic = planV1Migration(interactive);
    const asMotion = planV1Migration(interactive, { interactiveAs: 'motion' });
    if (!asStatic.ok || !asMotion.ok) throw new Error('plan failed');
    expect(asStatic.plan.sceneType).toBe('static');
    expect(asMotion.plan.sceneType).toBe('motion');
    expect(sceneSchema.safeParse(asMotion.plan.scene('scn_Z')).success).toBe(true);
  });
});

describe('bad input', () => {
  it('rejects a folder without vanilla.json and a broken one', () => {
    expect(planV1Migration({ root: '/x', texts: {}, binaries: [], skipped: [] })).toEqual({ ok: false, error: 'not-a-v1-project' });
    const r = planV1Migration({ root: '/x', texts: { 'vanilla.json': '{ nope' }, binaries: [], skipped: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid-vanilla-json/);
  });

  it('a project without brief, plan or source still migrates, with warnings', () => {
    const b = bundle('video-promo');
    const bare: V1Bundle = { root: '/x', texts: { 'vanilla.json': b.texts['vanilla.json'] }, binaries: [], skipped: [] };
    const r = planV1Migration(bare);
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.warnings.join(' ')).toMatch(/no brief/);
    expect(r.plan.warnings.join(' ')).toMatch(/no src/);
    expect(r.plan.warnings.join(' ')).toMatch(/no DESIGN/);
    expect(r.plan.scene('scn_Z')).toMatchObject({ status: 'draft', brief: { goal: '' } });
  });

  it('plan times that do not match the declared duration are explained', () => {
    const b = bundle('video-promo');
    const odd: V1Bundle = { ...b, texts: { ...b.texts, 'plan/plan.json': b.texts['plan/plan.json'].replace('"end": 7', '"end": 9') } };
    const r = planV1Migration(odd);
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.warnings.join(' ')).toMatch(/add up to 9s, not the declared 7s/);
    expect((r.plan.scene('scn_Z') as unknown as { duration: { seconds: number } }).duration.seconds).toBe(9);
  });

  it('invalid plan times leave the beats empty and say so', () => {
    const b = bundle('video-promo');
    const bad: V1Bundle = { ...b, texts: { ...b.texts, 'plan/plan.json': JSON.stringify({ scenes: [{ id: 'a' }, { id: 'b' }] }) } };
    const r = planV1Migration(bad);
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.unconverted.some((u) => u.item.includes('scene times') && u.kind === 'partial')).toBe(true);
    expect((r.plan.scene('scn_Z') as unknown as { beats: unknown[] }).beats).toEqual([]);
  });
});
