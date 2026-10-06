import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = new Map<string, string>();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string }) => {
    const rel = a.path.replace(/^\/w\//, '');
    if (cmd === 'read_text_file') {
      const v = fs.get(rel);
      if (v === undefined) throw new Error('missing');
      return v;
    }
    if (cmd === 'list_dir') {
      const base = `${rel.replace(/\/$/, '')}/`;
      const files = [...fs.keys()].filter((k) => k.startsWith(base) && !k.slice(base.length).includes('/'));
      if (!files.length) throw new Error('no dir');
      return files.map((f) => ({ name: f.slice(base.length), is_dir: false }));
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { customTransitionSchema, loadCustomTransitions, parseCustomTransition, planCustom, SAMPLE_CUSTOM_TRANSITION } from './custom';

const json = (o: unknown) => JSON.stringify(o);
const spec = (type: string, durationMs = 600, easing = 'ease-in-out') => ({ type, durationMs, easing, params: {} });

beforeEach(() => fs.clear());

describe('custom transition schema', () => {
  it('accepts the sample and fills defaults', () => {
    expect(customTransitionSchema.safeParse(SAMPLE_CUSTOM_TRANSITION).success).toBe(true);
    const minimal = parseCustomTransition(json({ version: 1, name: 'fade', from: [{ opacity: 1 }, { opacity: 0 }] }));
    expect(minimal).toMatchObject({ durationMs: 600, easing: 'ease-in-out', description: '' });
  });

  it('rejects code-like and external values (nothing from an agent file is executed)', () => {
    const bad = (value: string) => customTransitionSchema.safeParse({ version: 1, name: 'x', from: [{ opacity: 1 }, { transform: value }] }).success;
    expect(bad('translateX(10px)')).toBe(true);
    for (const v of ['url(https://evil.example/a.png)', 'translateX(1px); position: fixed', '} body { display:none', 'calc(1px /* x */)', 'translateX(1px) \\', 'expression(alert(1))']) {
      expect(bad(v), v).toBe(false);
    }
    expect(bad('x'.repeat(300))).toBe(false);
  });

  it('rejects unknown properties, too few keyframes and bad names', () => {
    const base = { version: 1, name: 'x', from: [{ opacity: 1 }, { opacity: 0 }] };
    expect(customTransitionSchema.safeParse({ ...base, from: [{ opacity: 1 }] }).success).toBe(false);
    expect(customTransitionSchema.safeParse({ ...base, from: [{ opacity: 1 }, { width: '100px' }] }).success).toBe(false); // layout property
    expect(customTransitionSchema.safeParse({ ...base, from: [{ opacity: 1 }, {}] }).success).toBe(false);
    expect(customTransitionSchema.safeParse({ ...base, name: '../x' }).success).toBe(false);
    expect(customTransitionSchema.safeParse({ ...base, durationMs: 60000 }).success).toBe(false);
    expect(customTransitionSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });
});

describe('planCustom', () => {
  it('uses the edge timing, falls back to the definition, and keeps both keyframe lists', () => {
    const def = customTransitionSchema.parse({ ...SAMPLE_CUSTOM_TRANSITION, to: [{ opacity: 0 }, { opacity: 1 }] });
    const plan = planCustom(def, spec('custom:iris-blur', 900, 'linear'))!;
    expect(plan).toMatchObject({ durationMs: 900, easing: 'linear' });
    expect(plan.from).toHaveLength(2);
    expect(plan.to).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(planCustom(def, spec('custom:iris-blur', 0))!.durationMs).toBe(700);
    expect(planCustom(def, spec('custom:iris-blur', 600, 'steps(3)'))!.easing).toBe('ease-in-out');
    expect(planCustom(def, spec('custom:other'))).toBeNull();
    expect(planCustom(def, spec('crossfade'))).toBeNull();
  });
});

describe('loadCustomTransitions', () => {
  it('loads valid files, reports invalid ones and requires the name to match the file', async () => {
    fs.set('transitions/iris-blur.json', json(SAMPLE_CUSTOM_TRANSITION));
    fs.set('transitions/broken.json', '{ nope');
    fs.set('transitions/wrong.json', json({ ...SAMPLE_CUSTOM_TRANSITION, name: 'other' }));
    fs.set('transitions/evil.json', json({ version: 1, name: 'evil', from: [{ opacity: 1 }, { filter: 'url(http://x/y)' }] }));
    fs.set('transitions/notes.txt', 'ignored');
    const r = await loadCustomTransitions('/w');
    expect([...r.defs.keys()]).toEqual(['iris-blur']);
    expect([...r.errors.keys()].sort()).toEqual(['broken.json', 'evil.json', 'wrong.json']);
    expect(r.errors.get('wrong.json')).toMatch(/must match the file name/);
    expect(r.errors.get('evil.json')).toMatch(/unsafe CSS value/);
  });

  it('no folder means no custom transitions', async () => {
    expect(await loadCustomTransitions('/w')).toEqual({ defs: new Map(), errors: new Map() });
  });
});
