import { describe, expect, it } from 'vitest';
import { evaluateStatus, groupChanges, isPromptReady, outsideWrites, sceneSlugOf } from './status';
import { newScene, type Scene, type SceneStatus } from './schema';

const scene = (status: SceneStatus, over: Partial<Scene> = {}): Scene => ({ ...newScene({ id: 'scn_A', name: 'A', type: 'motion', template: 'commercial@1' }), status, ...over }) as Scene;
const withPrompt = { userPrompt: 'make it' };

describe('paths', () => {
  it('finds the scene slug', () => {
    expect(sceneSlugOf('scenes/intro/src/index.html')).toBe('intro');
    expect(sceneSlugOf('scenes\\intro\\scene.json')).toBe('intro');
    expect(sceneSlugOf('workspace.json')).toBeNull();
    expect(sceneSlugOf('scenes/Bad Slug/x')).toBeNull();
  });

  it('groups a burst by scene', () => {
    const g = groupChanges(['scenes/a/scene.json', 'scenes/a/src/x.ts', 'scenes/b/scene.json', 'DESIGN.md']);
    expect([...g.bySlug.entries()]).toEqual([
      ['a', ['scenes/a/scene.json', 'scenes/a/src/x.ts']],
      ['b', ['scenes/b/scene.json']],
    ]);
    expect(g.other).toEqual(['DESIGN.md']);
  });

  it('flags writes outside the active scene but not app-owned files', () => {
    expect(outsideWrites(['scenes/a/src/x.ts', 'scenes/b/src/y.ts', 'workspace.json', 'DESIGN.md', 'sequence.json'], 'a')).toEqual([
      'scenes/b/src/y.ts',
      'DESIGN.md',
    ]);
  });
});

describe('evaluateStatus', () => {
  const ok = 'ok' as const;

  it('prompt-ready follows the inputs', () => {
    expect(isPromptReady(scene('draft'))).toBe(false);
    expect(evaluateStatus({ scene: scene('draft', withPrompt), entryExists: false, guide: ok })).toBe('prompt-ready');
    expect(evaluateStatus({ scene: scene('prompt-ready'), entryExists: false, guide: ok })).toBe('draft');
    expect(evaluateStatus({ scene: scene('draft'), entryExists: false, guide: ok })).toBe('draft');
  });

  it('an entry file makes a draft or prompt-ready scene generated', () => {
    expect(evaluateStatus({ scene: scene('draft'), entryExists: true, guide: ok })).toBe('generated');
    expect(evaluateStatus({ scene: scene('prompt-ready', withPrompt), entryExists: true, guide: ok })).toBe('generated');
  });

  it('a generated scene whose scene.json changed after the guide render needs revision', () => {
    expect(evaluateStatus({ scene: scene('generated'), entryExists: true, guide: 'stale' })).toBe('needs-revision');
    expect(evaluateStatus({ scene: scene('generated'), entryExists: true, guide: ok })).toBe('generated');
    expect(evaluateStatus({ scene: scene('generated'), entryExists: true, guide: 'edited' })).toBe('generated');
  });

  it('needs-revision sticks until regenerated', () => {
    expect(evaluateStatus({ scene: scene('needs-revision'), entryExists: true, guide: ok })).toBe('needs-revision');
  });

  it('losing the entry file steps back', () => {
    expect(evaluateStatus({ scene: scene('generated', withPrompt), entryExists: false, guide: ok })).toBe('prompt-ready');
    expect(evaluateStatus({ scene: scene('needs-revision'), entryExists: false, guide: ok })).toBe('draft');
  });

  it('is stable: re-evaluating its own result changes nothing', () => {
    for (const status of ['draft', 'prompt-ready', 'generated', 'needs-revision'] as const) {
      for (const entryExists of [true, false]) {
        for (const guide of ['ok', 'stale', 'missing'] as const) {
          const s1 = scene(status, withPrompt);
          const next = evaluateStatus({ scene: s1, entryExists, guide });
          const again = evaluateStatus({ scene: { ...s1, status: next } as Scene, entryExists, guide: next === status ? guide : 'ok' });
          expect(again).toBe(next);
        }
      }
    }
  });
});
