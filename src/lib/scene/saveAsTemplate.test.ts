import { beforeEach, describe, expect, it, vi } from 'vitest';

const written = new Map<string, string>();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string; contents?: string }) => {
    if (cmd === 'write_text_file') {
      written.set(a.path.replace(/^\/w\//, ''), a.contents ?? '');
      return;
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { applyTemplateDefaults, mergeTemplate } from '@/lib/guides/merge';
import { buildTemplate, defaultTemplateFor, type GuideTemplate } from '@/lib/guides/template';
import { draftToFiles } from '@/lib/guides/templateEditor';
import { newScene, sceneSchema, type Scene } from './schema';
import { buildSceneTemplate, CONTENT_FIELDS, saveSceneAsTemplate, structuralDefaults, templateIdFromName } from './saveAsTemplate';

beforeEach(() => written.clear());

const motionParent = (): GuideTemplate => defaultTemplateFor('motion');
const staticParent = (): GuideTemplate => defaultTemplateFor('static');

const richMotion = (): Scene =>
  ({
    ...newScene({ id: 'scn_RICH', name: 'Forest promo', type: 'motion', template: motionParent().ref }),
    status: 'generated',
    brief: { subject: 'Gangdong Forest Library', goal: 'Visit', audience: 'families', message: 'Read outdoors', language: 'ko' },
    userPrompt: 'make it warm',
    references: [{ id: 'ref-1', kind: 'url', path: null, url: 'https://example.com/a', note: '', analysis: null }],
    duration: { seconds: 6 },
    structure: 'hybrid',
    creativeMode: ['product-launch'],
    brandVoice: ['warm'],
    visualStyle: { medium: '2d', lighting: 'soft', typography: 'serif', density: 'airy', cameraFeeling: 'calm', mood: 'cozy' },
    motionVocabulary: { typography: ['fade-in'], object: [], camera: ['dolly-in'], material: [], transition: ['crossfade'] },
    beats: [
      { id: 'a', start: 0, end: 3, role: 'hook', copy: 'Welcome to the forest', visual: 'trees', motion: ['fade-in'], camera: 'dolly-in', transitionOut: 'crossfade', notes: 'slow' },
      { id: 'b', start: 3, end: 6, role: 'cta', copy: 'Visit today', visual: 'door', motion: [], camera: '', transitionOut: '', notes: '' },
    ],
    copy: { textFidelity: 'exact', items: ['Welcome to the forest', 'Visit today'] },
    identity: { product: 'Library', character: 'Owl', mustKeep: ['logo'] },
    endCard: { holdSeconds: 1.2, elements: ['logo', 'address'] },
    audio: { voiceOver: 'warm voice', soundDesign: null, music: 'piano' },
    constraints: { avoid: ['stock footage'], noUnspecifiedElements: true },
  }) as unknown as Scene;

describe('structuralDefaults', () => {
  it('keeps structure and style, drops content', () => {
    const d = structuralDefaults(richMotion());
    expect(d.structure).toBe('hybrid');
    expect(d.duration).toEqual({ seconds: 6 });
    expect(d.visualStyle).toMatchObject({ medium: '2d', mood: 'cozy' });
    expect(d.motionVocabulary).toMatchObject({ transition: ['crossfade'] });
    expect(d.constraints).toEqual({ avoid: ['stock footage'], noUnspecifiedElements: true });
    for (const content of CONTENT_FIELDS) expect(d, content).not.toHaveProperty(content);
    for (const protectedField of ['id', 'name', 'type', 'template', 'status', 'runtime', 'custom']) expect(d, protectedField).not.toHaveProperty(protectedField);
  });

  it('beats keep the skeleton and lose the wording; end card keeps the hold time only', () => {
    const d = structuralDefaults(richMotion()) as { beats: Record<string, unknown>[]; endCard: Record<string, unknown> };
    expect(d.beats[0]).toEqual({ id: 'a', start: 0, end: 3, role: 'hook', copy: '', visual: '', motion: ['fade-in'], camera: 'dolly-in', transitionOut: 'crossfade', notes: '' });
    expect(d.beats[1]).toMatchObject({ id: 'b', start: 3, end: 6, copy: '' });
    expect(d.endCard).toEqual({ holdSeconds: 1.2, elements: [] });
  });

  it('static steps keep ids, input and layout but lose titles and copy', () => {
    const page = {
      ...newScene({ id: 'scn_PAGE', name: 'Page', type: 'static', template: staticParent().ref }),
      mode: 'steps',
      steps: [{ id: 's1', title: 'Welcome', copy: 'Hello', layout: 'hero', enter: 'crossfade', advance: 'click' }, { id: 's2', title: 'More', copy: 'Text', layout: 'split', enter: 'slide-left', advance: 'key:ArrowRight' }],
    } as unknown as Scene;
    const d = structuralDefaults(page) as { steps: Record<string, unknown>[]; mode: string };
    expect(d.mode).toBe('steps');
    expect(d.steps).toEqual([
      { id: 's1', title: '', copy: '', layout: 'hero', enter: 'crossfade', advance: 'click' },
      { id: 's2', title: '', copy: '', layout: 'split', enter: 'slide-left', advance: 'key:ArrowRight' },
    ]);
  });

  it('does not alias the scene (mutating the defaults never changes the scene)', () => {
    const scene = richMotion();
    const d = structuralDefaults(scene) as { beats: { id: string }[] };
    d.beats[0].id = 'changed';
    expect((scene as unknown as { beats: { id: string }[] }).beats[0].id).toBe('a');
  });
});

describe('buildSceneTemplate', () => {
  it('extends the scene template (guides stay) and validates', () => {
    const { draft, template } = buildSceneTemplate(richMotion(), motionParent(), 'Warm promo');
    expect(draft).toMatchObject({ id: 'warm-promo', version: 1, extends: motionParent().ref, label: { ko: 'Warm promo', en: 'Warm promo' } });
    expect(template.rules).toBe(motionParent().rules); // no extra rules: the guides are inherited as they are
    expect(template.glossary.terms).toHaveLength(motionParent().glossary.terms.length);
    expect(Object.keys(template.schema.defaults)).toContain('beats');
  });

  it('round trip: a new scene made from the template starts with the same structure and empty content', () => {
    const { draft, template } = buildSceneTemplate(richMotion(), motionParent(), 'Warm promo');
    // what is saved to disk is exactly what the catalog would load and merge
    const child = buildTemplate(draftToFiles(draft), 'motion');
    const merged = mergeTemplate(child, motionParent());
    expect(merged.schema.defaults).toEqual(template.schema.defaults);

    const fresh = applyTemplateDefaults(newScene({ id: 'scn_NEW', name: 'New', type: 'motion', template: merged.ref }), merged) as unknown as Record<string, unknown>;
    expect(sceneSchema.safeParse(fresh).success).toBe(true);
    expect(fresh.structure).toBe('hybrid');
    expect(fresh.duration).toEqual({ seconds: 6 });
    expect((fresh.beats as { id: string; copy: string }[]).map((b) => [b.id, b.copy])).toEqual([['a', ''], ['b', '']]);
    expect(fresh.visualStyle).toMatchObject({ mood: 'cozy' });
    // content stays empty
    expect(fresh.brief).toMatchObject({ subject: '', message: '' });
    expect(fresh.userPrompt).toBe('');
    expect(fresh.references).toEqual([]);
    expect(fresh.copy).toEqual({ textFidelity: 'exact', items: [] });
    expect(fresh.identity).toMatchObject({ product: '', character: '' });
    expect(fresh.status).toBe('draft');
  });

  it('static scenes work the same way', () => {
    const page = {
      ...newScene({ id: 'scn_PAGE', name: 'Page', type: 'static', template: staticParent().ref }),
      mode: 'steps',
      steps: [{ id: 's1', title: 'Welcome', copy: 'Hello', layout: 'hero', enter: 'crossfade', advance: 'click' }],
    } as unknown as Scene;
    const { template } = buildSceneTemplate(page, staticParent(), 'Deck');
    const fresh = applyTemplateDefaults(newScene({ id: 'scn_N', name: 'N', type: 'static', template: template.ref }), template) as unknown as { mode: string; steps: { id: string; title: string }[] };
    expect(fresh.mode).toBe('steps');
    expect(fresh.steps).toMatchObject([{ id: 's1', title: '' }]);
  });

  it('needs a name, and ids are made from it', () => {
    expect(() => buildSceneTemplate(richMotion(), motionParent(), '   ')).toThrow('name-required');
    expect(templateIdFromName('Warm Promo (2026)!')).toBe('warm-promo-2026');
    expect(templateIdFromName('한글')).toBe('scene-template');
  });
});

describe('saveSceneAsTemplate', () => {
  it('writes the template folder into the workspace and refuses to overwrite one', async () => {
    const r = await saveSceneAsTemplate('/w', richMotion(), motionParent(), 'Warm promo', () => false);
    expect(r.template.ref).toBe('warm-promo@1');
    expect([...written.keys()].sort()).toEqual(['guide-templates/warm-promo@1/schema.json', 'guide-templates/warm-promo@1/template.json']);
    expect(JSON.parse(written.get('guide-templates/warm-promo@1/schema.json')!).defaults.structure).toBe('hybrid');
    expect(JSON.parse(written.get('guide-templates/warm-promo@1/template.json')!)).toMatchObject({ id: 'warm-promo', extends: motionParent().ref, type: 'motion' });
    written.clear();
    await expect(saveSceneAsTemplate('/w', richMotion(), motionParent(), 'Warm promo', (ref) => ref === 'warm-promo@1')).rejects.toThrow('template-exists');
    expect(written.size).toBe(0);
  });
});
