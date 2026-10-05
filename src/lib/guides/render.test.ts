import { describe, expect, it } from 'vitest';
import { newScene, type MotionScene, type Scene } from '@/lib/scene/schema';
import { agentsMdSections, renderAgentsMd, SCENE_CLAUDE_MD, type GuideContext } from './agentsMd';
import { checkGuide, renderGuideMd, sceneHash } from './guideMd';
import { outsideMarkers, readSection } from './markers';
import { assemblePrompt, renderPromptFiles } from './prompts';
import { defaultTemplateFor } from './template';
import { agentWritableFields, changedFields, disallowedChanges } from './writeback';

const ctxFor = (scene: Scene): GuideContext => ({
  workspace: { id: 'ws_abc', name: 'My Reel' },
  scene,
  template: defaultTemplateFor(scene.type),
});
const mk = (type: Scene['type']) => newScene({ id: 'scn_01ABC', name: 'Intro', type, template: defaultTemplateFor(type).ref });

describe('agents.md', () => {
  it.each(['static', 'motion', '3d'] as const)('has identity header, whitelist and scope for %s', (type) => {
    const scene = mk(type);
    const md = renderAgentsMd(null, ctxFor(scene));
    const identity = readSection(md, 'identity')!;
    expect(identity).toContain('workspaceId: ws_abc');
    expect(identity).toContain('sceneId: scn_01ABC');
    expect(identity).toContain(`template: ${scene.template}`);
    for (const f of agentWritableFields(type)) expect(readSection(md, 'writeback')).toContain(`\`${f}\``);
    expect(readSection(md, 'writeback')).toMatch(/Never change `id`, `name`, `type`/);
    expect(readSection(md, 'security')).toContain('Write only inside this scene folder');
    expect(readSection(md, 'type-rules')).toContain(defaultTemplateFor(type).rules.trim().split('\n')[0]);
    expect(agentsMdSections(ctxFor(scene)).map((s) => s.id)).toEqual([
      'identity', 'task', 'contract', 'design', 'writeback', 'type-rules', 'references', 'review', 'security',
    ]);
  });

  it('differs by type: timed scenes are time-pure, static scenes are input-driven', () => {
    expect(readSection(renderAgentsMd(null, ctxFor(mk('motion'))), 'contract')).toContain('pure function of time');
    expect(readSection(renderAgentsMd(null, ctxFor(mk('static'))), 'contract')).toContain('only on user input');
  });

  it('keeps user text outside the markers on re-render and is deterministic', () => {
    const ctx = ctxFor(mk('motion'));
    const first = renderAgentsMd(null, ctx);
    const edited = `Team note: keep it punchy.\n\n${first}\nMore notes\n`;
    const again = renderAgentsMd(edited, { ...ctx, scene: { ...ctx.scene, name: 'Renamed' } });
    expect(outsideMarkers(again)).toBe(outsideMarkers(edited));
    expect(readSection(again, 'identity')).toContain('scene: Renamed');
    expect(renderAgentsMd(first, ctx)).toBe(first);
  });

  it('claude.md only imports agents.md', () => {
    expect(SCENE_CLAUDE_MD).toBe('@AGENTS.md\n');
  });
});

describe('GUIDE.md', () => {
  const scene = mk('motion');

  it('is deterministic and carries the scene hash', () => {
    const a = renderGuideMd(scene, 'My Reel');
    expect(renderGuideMd(scene, 'My Reel')).toBe(a);
    expect(a).toContain(`scene-hash=${sceneHash(scene)}`);
    expect(a).toContain('## Beats');
    expect(a).toContain('Render these exactly');
  });

  it('renders every type', () => {
    expect(renderGuideMd(mk('static'), 'W')).toContain('## Steps');
    expect(renderGuideMd(mk('3d'), 'W')).toContain('## 3D scene');
  });

  it('detects missing, ok, stale, edited and unknown', () => {
    const guide = renderGuideMd(scene, 'W');
    expect(checkGuide(null, scene)).toBe('missing');
    expect(checkGuide(guide, scene)).toBe('ok');
    expect(checkGuide(guide.replace(/\n/g, '\r\n'), scene)).toBe('ok');
    expect(checkGuide(guide, { ...scene, userPrompt: 'changed' })).toBe('stale');
    expect(checkGuide(`${guide}\nmy manual line`, scene)).toBe('edited');
    expect(checkGuide(`${guide}\nmy manual line`, { ...scene, userPrompt: 'changed' })).toBe('edited');
    expect(checkGuide('# no header', scene)).toBe('unknown');
  });
});

describe('prompts', () => {
  it('generate starts with the identity header and carries language and whitelist', () => {
    const scene = { ...mk('motion'), userPrompt: 'Make it punchy', brief: { ...mk('motion').brief, language: 'ko' as const } };
    const p = assemblePrompt('generate', ctxFor(scene));
    expect(p.startsWith('[workspace: My Reel / scene: Intro]\n')).toBe(true);
    expect(p).toContain('Make it punchy');
    expect(p).toContain('Korean');
    expect(p).toContain('You may change these scene.json fields:');
    expect(p).not.toContain('\r');
  });

  it('revise lists the changed fields; analyze-reference lists references', () => {
    const scene = mk('motion');
    expect(assemblePrompt('revise', ctxFor(scene), { changedFields: ['beats', 'endCard'] })).toContain('`beats`, `endCard`');
    const withRef = { ...scene, references: [{ id: 'r1', kind: 'video' as const, path: 'references/a.mp4', url: null, note: '', analysis: 'references/analysis/r1.md' }] };
    const p = assemblePrompt('analyze-reference', ctxFor(withRef));
    expect(p).toContain('r1 (video): references/a.mp4 -> references/analysis/r1.md');
    expect(p).not.toContain('You may change');
  });

  it('writes the three prompt files', () => {
    expect(Object.keys(renderPromptFiles(ctxFor(mk('3d')))).sort()).toEqual([
      'prompts/analyze-reference.md', 'prompts/generate.md', 'prompts/revise.md',
    ]);
  });
});

describe('write-back whitelist', () => {
  const before = mk('motion') as MotionScene;

  it('never allows user-owned or immutable fields', () => {
    for (const type of ['static', 'motion', '3d'] as const) {
      const w = agentWritableFields(type);
      for (const f of ['id', 'name', 'type', 'template', 'brief', 'userPrompt', 'references', 'runtime', 'copy']) {
        expect(w).not.toContain(f);
      }
    }
  });

  it('flags only changes outside the whitelist', () => {
    const ok = { ...before, structure: 'continuous' as const, status: 'generated' as const };
    expect(changedFields(before, ok)).toEqual(['status', 'structure']);
    expect(disallowedChanges(before, ok)).toEqual([]);
    const bad = { ...ok, name: 'Hijacked', copy: { ...before.copy, items: ['new copy'] } };
    expect(disallowedChanges(before, bad)).toEqual(['copy', 'name']);
  });
});
