import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const fs = new Map<string, string>();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string; contents?: string }) => {
    const rel = a.path.replace(/^\/w\//, '');
    if (cmd === 'read_text_file') {
      const v = fs.get(rel);
      if (v === undefined) throw new Error(`missing ${rel}`);
      return v;
    }
    if (cmd === 'write_text_file') {
      fs.set(rel, a.contents ?? '');
      return;
    }
    if (cmd === 'delete_path') {
      fs.delete(rel);
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

import type { TerminalContextValue } from '@/components/terminal/terminalContextValue';
import type { TerminalSession } from '@/lib/terminal/sessions';
import { newScene, parseScene, serializeScene, type Scene } from '@/lib/scene/schema';
import { builtinResolver } from '@/lib/scene/files';
import { listSnapshots } from '@/lib/scene/writeback';
import { useRunReview } from './useRunReview';

const WS = { id: 'ws_1', name: 'W' };
const before = newScene({ id: 'scn_A', name: 'Intro', type: 'motion', template: 'commercial@1' });
const disk = () => parseScene(fs.get('scenes/intro/scene.json')!) as Scene & Record<string, unknown>;

const session = (status: TerminalSession['status']): TerminalSession =>
  ({ id: 'term-1', sceneSlug: 'intro', sceneName: 'Intro', status, agentId: 'codex', agentLabel: 'Codex' }) as TerminalSession;

function setup() {
  const onApplied = vi.fn();
  let sessions: TerminalSession[] = [];
  const terminals = () => ({ sessions }) as unknown as TerminalContextValue;
  const hook = renderHook(
    ({ t }: { t: TerminalContextValue }) => useRunReview({ root: '/w', workspace: WS, resolve: builtinResolver, terminals: t, onApplied }),
    { initialProps: { t: terminals() } },
  );
  const setSessions = (next: TerminalSession[]) => {
    sessions = next;
    hook.rerender({ t: terminals() });
  };
  return { hook, onApplied, setSessions };
}

/** 목 에이전트: 허용된 필드(structure)와 허용되지 않은 필드(name, userPrompt)를 고치고 엔트리를 만든다. */
function mockAgentWork() {
  const edited = { ...before, structure: 'hybrid', name: 'Hijacked', userPrompt: 'agent rewrote this' };
  fs.set('scenes/intro/scene.json', JSON.stringify(edited));
  fs.set('scenes/intro/src/index.html', '<html></html>');
}

beforeEach(() => {
  fs.clear();
  fs.set('scenes/intro/scene.json', serializeScene(before));
});

describe('useRunReview', () => {
  it('snapshots the scene before the run', async () => {
    const { hook } = setup();
    act(() => {
      void hook.result.current.begin('intro', before);
    });
    await waitFor(async () => expect((await listSnapshots('/w', 'intro')).map((s) => s.label)).toEqual(['before-run']));
  });

  it('does nothing while the agent is still running', async () => {
    const { hook, setSessions } = setup();
    act(() => {
      void hook.result.current.begin('intro', before);
    });
    setSessions([session('running')]);
    await new Promise((r) => setTimeout(r, 30));
    expect(hook.result.current.current).toBeNull();
  });

  it('reviews when the terminal exits: warns about disallowed fields', async () => {
    const { hook, setSessions } = setup();
    act(() => {
      void hook.result.current.begin('intro', before);
    });
    mockAgentWork();
    setSessions([session('exited')]);
    await waitFor(() => expect(hook.result.current.current).not.toBeNull());
    const r = hook.result.current.current!.review;
    expect(r.state).toBe('ok');
    if (r.state !== 'ok') return;
    expect(r.disallowed.sort()).toEqual(['name', 'userPrompt']);
    expect(r.status).toBe('generated');
  });

  it('revert disallowed: keeps the allowed edit, restores the others, saves the completion status', async () => {
    const { hook, setSessions, onApplied } = setup();
    act(() => {
      void hook.result.current.begin('intro', before);
    });
    mockAgentWork();
    setSessions([session('exited')]);
    await waitFor(() => expect(hook.result.current.current).not.toBeNull());
    await act(async () => hook.result.current.revertDisallowed());
    const saved = disk();
    expect(saved.name).toBe('Intro');
    expect(saved.userPrompt).toBe('');
    expect(saved.structure).toBe('hybrid');
    expect(saved.status).toBe('generated');
    expect(hook.result.current.current).toBeNull();
    expect(onApplied).toHaveBeenCalledOnce();
    expect((await listSnapshots('/w', 'intro')).map((s) => s.label)).toContain('reverted-partial');
    expect(fs.get('scenes/intro/GUIDE.md')).toContain('hybrid'); // generated files follow the saved scene
  });

  it('revert all: scene.json goes back to the state before the run', async () => {
    const { hook, setSessions } = setup();
    act(() => {
      void hook.result.current.begin('intro', before);
    });
    mockAgentWork();
    setSessions([session('exited')]);
    await waitFor(() => expect(hook.result.current.current).not.toBeNull());
    await act(async () => hook.result.current.revertAll());
    expect(disk()).toMatchObject({ name: 'Intro', userPrompt: '', structure: 'multi-shot' });
  });

  it('approve keeps every change and records the completion status', async () => {
    const { hook, setSessions } = setup();
    act(() => {
      void hook.result.current.begin('intro', before);
    });
    mockAgentWork();
    setSessions([session('exited')]);
    await waitFor(() => expect(hook.result.current.current).not.toBeNull());
    await act(async () => hook.result.current.approve());
    expect(disk()).toMatchObject({ name: 'Hijacked', structure: 'hybrid', status: 'generated' });
    expect((await listSnapshots('/w', 'intro')).map((s) => s.label)).toContain('approved');
  });

  it('an invalid scene.json after the run cannot be approved, only reverted', async () => {
    const { hook, setSessions } = setup();
    act(() => {
      void hook.result.current.begin('intro', before);
    });
    fs.set('scenes/intro/scene.json', '{ broken');
    setSessions([session('exited')]);
    await waitFor(() => expect(hook.result.current.current).not.toBeNull());
    expect(hook.result.current.current!.review.state).toBe('invalid');
    await act(async () => hook.result.current.approve()); // ignored for invalid reviews
    expect(fs.get('scenes/intro/scene.json')).toBe('{ broken');
    await act(async () => hook.result.current.revertAll());
    expect(disk().name).toBe('Intro');
  });

  it('missing entry file means needs-revision when approved', async () => {
    const { hook, setSessions } = setup();
    act(() => {
      void hook.result.current.begin('intro', before);
    });
    fs.set('scenes/intro/scene.json', JSON.stringify({ ...before, structure: 'hybrid' }));
    setSessions([session('exited')]);
    await waitFor(() => expect(hook.result.current.current).not.toBeNull());
    await act(async () => hook.result.current.approve());
    expect(disk().status).toBe('needs-revision');
  });

  it('reviews a session once and ignores scenes that were not started from the app', async () => {
    const { hook, setSessions } = setup();
    setSessions([session('exited')]); // no begin(): nothing to compare against
    await new Promise((r) => setTimeout(r, 30));
    expect(hook.result.current.current).toBeNull();
    act(() => {
      void hook.result.current.begin('intro', before);
    });
    setSessions([session('exited')]);
    await waitFor(() => expect(hook.result.current.current).not.toBeNull());
    act(() => hook.result.current.dismiss());
    setSessions([session('exited')]); // same session id: not reviewed again
    await new Promise((r) => setTimeout(r, 30));
    expect(hook.result.current.current).toBeNull();
  });

  describe('analysis runs (T5.5)', () => {
    const A1 = 'scenes/intro/references/analysis/ref-1.md';
    const DESIGN = 'scenes/intro/DESIGN.md';
    const designBase = '---\nextends: ../../DESIGN.md\ncolors: {}\n---\n\n# Scene design\n\nUser prose.\n';

    async function analysisRun() {
      fs.set(DESIGN, designBase);
      const h = setup();
      await act(async () => h.hook.result.current.begin('intro', before, { analysis: true }));
      // 목 에이전트: 분석 파일을 쓰고 DESIGN.md 구간 밖도 건드린다
      fs.set(A1, 'palette: warm');
      fs.set(DESIGN, `${designBase.replace('User prose.', 'Hijacked.')}\n<!-- vanilla:begin:analysis -->\n- warm\n<!-- vanilla:end:analysis -->\n`);
      h.setSessions([session('exited')]);
      await waitFor(() => expect(h.hook.result.current.current).not.toBeNull());
      return h;
    }

    it('reviews analysis files and the design section together with the scene', async () => {
      const { hook } = await analysisRun();
      const a = hook.result.current.current!.analysis!;
      expect(a.files.map((f) => [f.path, f.kind])).toEqual([['references/analysis/ref-1.md', 'added']]);
      expect(a.design?.section.after).toBe('- warm');
      expect(a.disallowed).toBe(true);
    });

    it('a normal run has no analysis part', async () => {
      const { hook, setSessions } = setup();
      act(() => {
      void hook.result.current.begin('intro', before);
    });
      mockAgentWork();
      setSessions([session('exited')]);
      await waitFor(() => expect(hook.result.current.current).not.toBeNull());
      expect(hook.result.current.current!.analysis).toBeUndefined();
    });

    it('approve links the analysis file to its reference so the guide can point at it', async () => {
      fs.set('scenes/intro/scene.json', serializeScene({ ...before, references: [{ id: 'ref-1', kind: 'image', path: 'references/ref-1-a.png', url: null, note: '', analysis: null }] } as Scene));
      const { hook } = await analysisRun();
      await act(async () => hook.result.current.approve());
      expect(disk().references[0].analysis).toBe('references/analysis/ref-1.md');
      expect(fs.get('scenes/intro/GUIDE.md')).toContain('references/analysis/ref-1.md');
    });

    it('approve keeps the files and does not turn the scene into "generated"', async () => {
      const { hook } = await analysisRun();
      await act(async () => hook.result.current.approve());
      expect(fs.get(A1)).toBe('palette: warm');
      expect(disk().status).toBe('draft'); // before.status; the entry-exists judgement belongs to generation runs
    });

    it('revert disallowed undoes the prose edit but keeps the analysis result', async () => {
      const { hook } = await analysisRun();
      await act(async () => hook.result.current.revertDisallowed());
      expect(fs.get(DESIGN)).toContain('User prose.');
      expect(fs.get(DESIGN)).not.toContain('Hijacked');
      expect(fs.get(DESIGN)).toContain('- warm');
      expect(fs.get(A1)).toBe('palette: warm');
    });

    it('revert all removes new analysis files and restores DESIGN.md', async () => {
      const { hook } = await analysisRun();
      await act(async () => hook.result.current.revertAll());
      expect(fs.has(A1)).toBe(false);
      expect(fs.get(DESIGN)).toBe(designBase);
    });
  });
});
