import { describe, expect, it } from 'vitest';
import { newScene, parseScene, sceneSchema, serializeScene, type Scene, type SceneType } from './schema';

const make = (type: SceneType) => newScene({ id: 'scn_01ABC', name: 'Demo', type, template: 'commercial@1' });
const edit = (scene: Scene, patch: Record<string, unknown>) => ({ ...scene, ...patch });
const motion = () => make('motion');

const beats = (n: number, total: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `b${i + 1}`,
    start: (total / n) * i,
    end: (total / n) * (i + 1),
    role: 'hook',
    copy: '',
    visual: '',
    motion: [],
    camera: '',
    transitionOut: 'hard-cut',
    notes: '',
  }));

describe('sceneSchema', () => {
  it.each(['static', 'motion', '3d'] as const)('accepts a fresh %s scene and round-trips canonically', (type) => {
    const s = make(type);
    expect(sceneSchema.safeParse(s).success).toBe(true);
    const text = serializeScene(s);
    expect(serializeScene(parseScene(text))).toBe(text);
  });

  it('keeps spec key order and fixes times to 3 decimals', () => {
    const s = edit(motion(), { duration: { seconds: 10 }, beats: beats(4, 10) }) as Scene;
    const text = serializeScene(s);
    expect(text.indexOf('"version"')).toBeLessThan(text.indexOf('"id"'));
    expect(text.indexOf('"brief"')).toBeLessThan(text.indexOf('"duration"'));
    expect(text).toContain('"seconds": 10.000');
    expect(text).toContain('"start": 2.500');
    expect(text).toContain('"holdSeconds": 0.850');
  });

  it('rejects unknown fields and a missing type', () => {
    expect(sceneSchema.safeParse({ ...make('static'), extra: 1 }).success).toBe(false);
    const { type, ...noType } = make('motion');
    void type;
    expect(sceneSchema.safeParse(noType).success).toBe(false);
  });

  it('does not carry canvas fields (D-030)', () => {
    expect(sceneSchema.safeParse({ ...make('motion'), fps: 30 }).success).toBe(false);
  });

  describe('beats', () => {
    it('accepts contiguous beats that add up to the duration', () => {
      expect(sceneSchema.safeParse(edit(motion(), { beats: beats(4, 10) })).success).toBe(true);
    });

    it('rejects a gap, a wrong total and a late start', () => {
      const b = beats(2, 10);
      expect(sceneSchema.safeParse(edit(motion(), { beats: [b[0], { ...b[1], start: 6 }] })).success).toBe(false);
      expect(sceneSchema.safeParse(edit(motion(), { beats: [b[0], { ...b[1], end: 9 }] })).success).toBe(false);
      expect(sceneSchema.safeParse(edit(motion(), { beats: [{ ...b[0], start: 0.5 }, b[1]] })).success).toBe(false);
    });

    it('rejects duplicate ids and non-positive length', () => {
      const b = beats(2, 10);
      expect(sceneSchema.safeParse(edit(motion(), { beats: [b[0], { ...b[1], id: 'b1' }] })).success).toBe(false);
      expect(sceneSchema.safeParse(edit(motion(), { beats: [{ ...b[0], end: 0 }] })).success).toBe(false);
    });

    it('applies to 3d scenes too', () => {
      const s = edit(make('3d'), { beats: beats(2, 7) });
      expect(sceneSchema.safeParse(s).success).toBe(false);
    });
  });

  it('requires endCard.holdSeconds >= 0.7', () => {
    expect(sceneSchema.safeParse(edit(motion(), { endCard: { holdSeconds: 0.7, elements: [] } })).success).toBe(true);
    expect(sceneSchema.safeParse(edit(motion(), { endCard: { holdSeconds: 0.69, elements: [] } })).success).toBe(false);
  });

  describe('static', () => {
    const step = (id: string, advance: string) => ({ id, title: '', copy: '', layout: '', enter: 'fade', advance });

    it('allows user-input advances only (D-032)', () => {
      const ok = edit(make('static'), { mode: 'steps', steps: [step('s1', 'click'), step('s2', 'key:ArrowRight'), step('s3', 'choice:Yes')] });
      expect(sceneSchema.safeParse(ok).success).toBe(true);
      for (const bad of ['auto', 'timer:3', 'after:2s', '']) {
        const s = edit(make('static'), { mode: 'steps', steps: [step('s1', bad)] });
        expect(sceneSchema.safeParse(s).success).toBe(false);
      }
    });

    it('rejects steps in scroll mode and duplicate step ids', () => {
      expect(sceneSchema.safeParse(edit(make('static'), { mode: 'scroll', steps: [step('s1', 'click')] })).success).toBe(false);
      const dup = edit(make('static'), { mode: 'steps', steps: [step('s1', 'click'), step('s1', 'click')] });
      expect(sceneSchema.safeParse(dup).success).toBe(false);
    });

    it('has no duration', () => {
      expect(sceneSchema.safeParse(edit(make('static'), { duration: { seconds: 5 } })).success).toBe(false);
    });
  });

  describe('identity and references', () => {
    it.each([
      ['bad id', { id: 'x1' }],
      ['bad template', { template: 'commercial-v1' }],
      ['bad status', { status: 'done' }],
      ['bad runtime contract', { runtime: { contract: 'scene-runtime@2', entry: 'src/index.html' } }],
      ['entry escapes folder', { runtime: { contract: 'scene-runtime@1', entry: '../x.html' } }],
      ['absolute entry', { runtime: { contract: 'scene-runtime@1', entry: 'C:/x.html' } }],
    ])('rejects %s', (_, patch) => {
      expect(sceneSchema.safeParse(edit(motion(), patch)).success).toBe(false);
    });

    const ref = (over: object) => ({ id: 'r1', kind: 'video', path: 'references/a.mp4', url: null, note: '', analysis: null, ...over });

    it('requires path for files and url for links', () => {
      expect(sceneSchema.safeParse(edit(motion(), { references: [ref({})] })).success).toBe(true);
      expect(sceneSchema.safeParse(edit(motion(), { references: [ref({ kind: 'url', path: null, url: 'https://example.com/v' })] })).success).toBe(true);
      expect(sceneSchema.safeParse(edit(motion(), { references: [ref({ path: null })] })).success).toBe(false);
      expect(sceneSchema.safeParse(edit(motion(), { references: [ref({ kind: 'url' })] })).success).toBe(false);
      expect(sceneSchema.safeParse(edit(motion(), { references: [ref({ path: '../../secret.mp4' })] })).success).toBe(false);
    });
  });
});
