import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = new Map<string, string>();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string; contents?: string }) => {
    const rel = a.path.replace(/^\/w\//, '');
    if (cmd === 'write_text_file') return void fs.set(rel, a.contents ?? '');
    if (cmd === 'read_text_file') {
      const v = fs.get(rel);
      if (v === undefined) throw new Error('missing');
      return v;
    }
    if (cmd === 'list_dir') {
      const base = `${rel.replace(/\/$/, '')}/`;
      const files = [...fs.keys()].filter((k) => k.startsWith(base));
      if (!files.length) throw new Error('no dir');
      return files.map((f) => ({ name: f.slice(base.length), is_dir: false }));
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { newScene, type Scene } from './schema';
import { changedSinceSettled } from './revision';
import { saveSnapshot } from './writeback';

const base = newScene({ id: 'scn_A', name: 'Intro', type: 'motion', template: 'commercial@1' });
const at = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s));

beforeEach(() => fs.clear());

describe('changedSinceSettled', () => {
  it('no settled snapshot: nothing to report', async () => {
    await saveSnapshot('/w', 'intro', base, 'before-run', at(1));
    expect(await changedSinceSettled('/w', 'intro', { ...base, structure: 'continuous' } as Scene)).toEqual([]);
  });

  it('diffs against the latest approved snapshot and ignores status', async () => {
    await saveSnapshot('/w', 'intro', base, 'approved', at(1));
    await saveSnapshot('/w', 'intro', { ...base, structure: 'continuous' } as Scene, 'before-run', at(2));
    const now = { ...base, status: 'needs-revision', userPrompt: 'make it warmer' } as Scene;
    expect(await changedSinceSettled('/w', 'intro', now)).toEqual(['userPrompt']);
  });

  it('empty when identical', async () => {
    await saveSnapshot('/w', 'intro', base, 'reverted', at(1));
    expect(await changedSinceSettled('/w', 'intro', base)).toEqual([]);
  });
});
