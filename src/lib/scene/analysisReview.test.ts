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
    if (cmd === 'write_text_file') return void fs.set(rel, a.contents ?? '');
    if (cmd === 'delete_path') return void fs.delete(rel);
    if (cmd === 'list_dir') {
      const base = `${rel.replace(/\/$/, '')}/`;
      const files = [...fs.keys()].filter((k) => k.startsWith(base) && !k.slice(base.length).includes('/'));
      if (!files.length) throw new Error('no dir');
      return files.map((f) => ({ name: f.slice(base.length), is_dir: false }));
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { ANALYSIS_BEGIN, ANALYSIS_END, readAnalysis } from '@/lib/design/analysis';
import { reviewAnalysis, revertAnalysis, snapshotAnalysis } from './analysisReview';

const DESIGN = 'scenes/intro/DESIGN.md';
const A1 = 'scenes/intro/references/analysis/ref-1.md';
const base = '---\nextends: ../../DESIGN.md\ncolors: {}\n---\n\n# Scene design\n\nUser prose.\n';
const withSection = (body: string) => `${base}\n${ANALYSIS_BEGIN}\n${body}\n${ANALYSIS_END}\n`;

beforeEach(() => {
  fs.clear();
  fs.set(DESIGN, base);
  fs.set(A1, 'old analysis');
});

describe('analysis review', () => {
  it('no changes: empty review', async () => {
    const before = await snapshotAnalysis('/w', 'intro');
    expect(await reviewAnalysis('/w', 'intro', before)).toEqual({ files: [], design: null, disallowed: false });
  });

  it('reports added and changed analysis files and the design section', async () => {
    const before = await snapshotAnalysis('/w', 'intro');
    fs.set(A1, 'new analysis');
    fs.set('scenes/intro/references/analysis/ref-2.md', 'second');
    fs.set(DESIGN, withSection('- warm palette'));
    const r = await reviewAnalysis('/w', 'intro', before);
    expect(r.files.map((f) => [f.path, f.kind])).toEqual([
      ['references/analysis/ref-1.md', 'changed'],
      ['references/analysis/ref-2.md', 'added'],
    ]);
    expect(r.design).toEqual({ section: { before: null, after: '- warm palette' }, outsideChanged: false, broken: false });
    expect(r.disallowed).toBe(false);
  });

  it('flags edits outside the marker section as disallowed', async () => {
    const before = await snapshotAnalysis('/w', 'intro');
    fs.set(DESIGN, `${withSection('- ok')}\nAGENT ADDED PROSE\n`.replace('User prose.', 'Rewritten prose.'));
    const r = await reviewAnalysis('/w', 'intro', before);
    expect(r.design?.outsideChanged).toBe(true);
    expect(r.disallowed).toBe(true);
  });

  it('broken markers are disallowed', async () => {
    const before = await snapshotAnalysis('/w', 'intro');
    fs.set(DESIGN, `${base}\n${ANALYSIS_BEGIN}\nhalf`);
    const r = await reviewAnalysis('/w', 'intro', before);
    expect(r.design?.broken).toBe(true);
    expect(r.disallowed).toBe(true);
  });

  it('revert all restores files and DESIGN.md and removes files the agent created', async () => {
    const before = await snapshotAnalysis('/w', 'intro');
    fs.set(A1, 'new analysis');
    fs.set('scenes/intro/references/analysis/ref-2.md', 'second');
    fs.set(DESIGN, withSection('- warm'));
    const r = await reviewAnalysis('/w', 'intro', before);
    await revertAnalysis('/w', 'intro', before, r, 'all');
    expect(fs.get(A1)).toBe('old analysis');
    expect(fs.has('scenes/intro/references/analysis/ref-2.md')).toBe(false);
    expect(fs.get(DESIGN)).toBe(base);
  });

  it('revert disallowed keeps the new analysis section but undoes edits outside it', async () => {
    const before = await snapshotAnalysis('/w', 'intro');
    fs.set(DESIGN, withSection('- keep me').replace('User prose.', 'Hijacked prose.'));
    const r = await reviewAnalysis('/w', 'intro', before);
    await revertAnalysis('/w', 'intro', before, r, 'disallowed');
    const text = fs.get(DESIGN) ?? '';
    expect(text).toContain('User prose.');
    expect(text).not.toContain('Hijacked');
    expect(readAnalysis(text)).toBe('- keep me');
  });

  it('revert disallowed with broken markers restores the file as it was', async () => {
    const before = await snapshotAnalysis('/w', 'intro');
    fs.set(DESIGN, `${base}\n${ANALYSIS_BEGIN}\nhalf`);
    const r = await reviewAnalysis('/w', 'intro', before);
    await revertAnalysis('/w', 'intro', before, r, 'disallowed');
    expect(fs.get(DESIGN)).toBe(base);
  });

  it('revert disallowed does nothing when only the section changed', async () => {
    const before = await snapshotAnalysis('/w', 'intro');
    fs.set(DESIGN, withSection('- fine'));
    const r = await reviewAnalysis('/w', 'intro', before);
    await revertAnalysis('/w', 'intro', before, r, 'disallowed');
    expect(readAnalysis(fs.get(DESIGN) ?? '')).toBe('- fine');
  });

  it('a design file the agent created from nothing is removed on revert all', async () => {
    fs.delete(DESIGN);
    const before = await snapshotAnalysis('/w', 'intro');
    fs.set(DESIGN, withSection('- x'));
    const r = await reviewAnalysis('/w', 'intro', before);
    expect(r.design?.section.after).toBe('- x');
    await revertAnalysis('/w', 'intro', before, r, 'all');
    expect(fs.has(DESIGN)).toBe(false);
  });
});
