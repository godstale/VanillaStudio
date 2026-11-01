import { describe, expect, it } from 'vitest';
import { getBuiltinTemplate } from '@/lib/guides/template';
import { BUILT_IN_PALETTES } from '@/lib/design/palettes';
import { agentsMdSections } from '@/lib/guides/agentsMd';
import { renderGuideMd } from '@/lib/guides/guideMd';
import { newScene, parseScene, serializeScene } from '@/lib/scene/schema';
import { PROJECT_TEMPLATES, renderProjectTemplateMd } from '@/lib/projectTemplates/catalog';
import { addSceneStyle, getStyle, removeSceneStyle, STYLE_LIBRARY } from './library';

const scene = () => newScene({ id: 'scn_a', name: 'A', type: 'motion', template: 'commercial@1' });

describe('style library', () => {
  it('holds 200 unique styles with a known family', () => {
    expect(STYLE_LIBRARY.styles).toHaveLength(200);
    expect(new Set(STYLE_LIBRARY.styles.map((s) => s.id)).size).toBe(200);
    for (const s of STYLE_LIBRARY.styles) expect(STYLE_LIBRARY.families[s.family], s.id).toBeTruthy();
  });

  it('does not name trademarked works in ids or labels', () => {
    const text = STYLE_LIBRARY.styles.map((s) => [s.id, s.label.ko, s.label.en, s.example].join(' ')).join(' ').toLowerCase();
    for (const word of ['pixar', 'lego', 'funko', 'barbie', 'ghibli', 'simpson', 'disney', 'burton']) expect(text).not.toContain(word);
  });

  it('keeps scene bytes unchanged until a style is used and after the last is removed', () => {
    const before = serializeScene(scene());
    expect(before).not.toContain('styles');
    const styled = addSceneStyle(parseScene(before), 'chrome', 'image');
    expect(serializeScene(styled)).toContain('"styles"');
    expect(serializeScene(removeSceneStyle(styled, 'chrome'))).toBe(before);
  });

  it('replaces the scope instead of duplicating a style', () => {
    const next = addSceneStyle(addSceneStyle(scene(), 'chrome', 'image'), 'chrome', 'motion');
    expect(next.styles).toEqual([{ id: 'chrome', scope: 'motion' }]);
  });

  it('renders chosen styles into GUIDE.md and AGENTS.md', () => {
    const styled = addSceneStyle(scene(), 'soft-3d-cartoon', 'scene');
    expect(renderGuideMd(styled, 'W')).toContain('`soft-3d-cartoon` (whole scene)');
    const template = getBuiltinTemplate('commercial@1')!;
    const body = agentsMdSections({ workspace: { id: 'w', name: 'W' }, scene: styled, template }).find((s) => s.id === 'styles')!.body;
    expect(body).toContain('rounded forms');
    expect(body).toContain('No existing characters');
    const empty = agentsMdSections({ workspace: { id: 'w', name: 'W' }, scene: scene(), template }).find((s) => s.id === 'styles')!.body;
    expect(empty).toContain('No style is selected');
  });
});

describe('project templates', () => {
  it('only reference existing styles, guides and palettes', () => {
    for (const t of PROJECT_TEMPLATES) {
      expect(BUILT_IN_PALETTES.some((p) => p.id === t.paletteId), t.paletteId).toBe(true);
      for (const slot of t.slots) {
        expect(getBuiltinTemplate(slot.guide)?.meta.type, slot.guide).toBe(slot.sceneType);
        for (const s of slot.styles) expect(getStyle(s.id), s.id).toBeTruthy();
      }
    }
  });

  it('renders every slot into the skeleton document', () => {
    const t = PROJECT_TEMPLATES[0];
    const md = renderProjectTemplateMd(t);
    for (const slot of t.slots) expect(md).toContain(slot.purpose);
  });
});
