import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = new Map<string, string>();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string; contents?: string }) => {
    const rel = a.path.replace(/^\/w\//, '');
    if (cmd === 'read_text_file') {
      const v = fs.get(rel);
      if (v === undefined) throw new Error('missing');
      return v;
    }
    if (cmd === 'write_text_file') {
      fs.set(rel, a.contents ?? '');
      return;
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

import { newScene, serializeScene, type Scene } from './schema';
import { listSnapshots, readSnapshot, reviewRun, revertFields, saveSnapshot, summarizeValue } from './writeback';

const before = newScene({ id: 'scn_A', name: 'Intro', type: 'motion', template: 'commercial@1' });
const writeScene = (s: unknown) => fs.set('scenes/intro/scene.json', typeof s === 'string' ? s : JSON.stringify(s));
const withEntry = () => fs.set('scenes/intro/src/index.html', '<html></html>');
const edit = (patch: Record<string, unknown>) => ({ ...before, ...patch }) as unknown as Scene;

beforeEach(() => fs.clear());

describe('reviewRun', () => {
  it('allowed edits with an entry file: generated, nothing to confirm', async () => {
    withEntry();
    writeScene(edit({ structure: 'continuous', visualStyle: { ...(before as { visualStyle: object }).visualStyle, mood: 'warm' } }));
    const r = await reviewRun('/w', 'intro', before);
    expect(r.state).toBe('ok');
    if (r.state !== 'ok') return;
    expect(r.disallowed).toEqual([]);
    expect(r.status).toBe('generated');
    expect(r.changes.map((c) => c.field).sort()).toEqual(['structure', 'visualStyle']);
    expect(r.changes.every((c) => c.allowed)).toBe(true);
  });

  it('no entry file means needs-revision even if scene.json is fine', async () => {
    writeScene(before);
    const r = await reviewRun('/w', 'intro', before);
    expect(r).toMatchObject({ state: 'ok', entryExists: false, status: 'needs-revision' });
  });

  it('flags changes outside the write-back whitelist', async () => {
    withEntry();
    writeScene(edit({ name: 'Hijacked', userPrompt: 'rewritten', copy: { textFidelity: 'exact', items: ['new line'] }, structure: 'hybrid' }));
    const r = await reviewRun('/w', 'intro', before);
    if (r.state !== 'ok') throw new Error('expected ok');
    expect(r.disallowed.sort()).toEqual(['copy', 'name', 'userPrompt']);
    expect(r.changes.find((c) => c.field === 'structure')?.allowed).toBe(true);
    expect(r.changes.find((c) => c.field === 'name')?.allowed).toBe(false);
  });

  it('invalid JSON, schema violations and a missing file are reported as invalid', async () => {
    writeScene('{ not json');
    expect(await reviewRun('/w', 'intro', before)).toMatchObject({ state: 'invalid' });
    writeScene(edit({ endCard: { holdSeconds: 0.2, elements: [] } }));
    const bad = await reviewRun('/w', 'intro', before);
    expect(bad).toMatchObject({ state: 'invalid' });
    if (bad.state === 'invalid') expect(bad.errors.join(' ')).toMatch(/holdSeconds/);
    fs.delete('scenes/intro/scene.json');
    expect(await reviewRun('/w', 'intro', before)).toMatchObject({ state: 'invalid' });
  });

  it('refuses a changed scene id', async () => {
    writeScene({ ...before, id: 'scn_OTHER' });
    const r = await reviewRun('/w', 'intro', before);
    expect(r).toMatchObject({ state: 'invalid' });
  });
});

describe('revertFields', () => {
  it('restores only the named fields and keeps the rest of the edit', () => {
    const after = edit({ name: 'Hijacked', structure: 'hybrid' });
    const fixed = revertFields(after, before, ['name']);
    expect(fixed.name).toBe('Intro');
    expect((fixed as { structure: string }).structure).toBe('hybrid');
  });

  it('reverting everything that changed returns the original, an empty list changes nothing', () => {
    const after = edit({ name: 'x', structure: 'hybrid' });
    expect(revertFields(after, before, ['name', 'structure'])).toEqual(before);
    expect(revertFields(after, before, [])).toEqual(after);
  });
});

describe('snapshots', () => {
  it('saves canonical snapshots, lists them newest first and reads them back', async () => {
    const a = await saveSnapshot('/w', 'intro', before, 'before-run', new Date('2026-01-01T00:00:00Z'));
    const b = await saveSnapshot('/w', 'intro', edit({ structure: 'hybrid' }), 'approved', new Date('2026-01-02T00:00:00Z'));
    expect(fs.get(`scenes/intro/.vanilla/history/${a}`)).toBe(serializeScene(before));
    const list = await listSnapshots('/w', 'intro');
    expect(list.map((s) => s.label)).toEqual(['approved', 'before-run']);
    expect(list[0].name).toBe(b);
    expect((await readSnapshot('/w', 'intro', a)).name).toBe('Intro');
  });

  it('an empty history is an empty list', async () => {
    expect(await listSnapshots('/w', 'intro')).toEqual([]);
  });
});

describe('summarizeValue', () => {
  it('shortens long values and handles undefined', () => {
    expect(summarizeValue('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
    expect(summarizeValue({ a: 1 })).toBe('{"a":1}');
    expect(summarizeValue(undefined)).toBe('(none)');
  });
});
