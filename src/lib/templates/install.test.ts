import { describe, expect, it } from 'vitest';
import {
  buildTemplateInstallPlan,
  CORE_SKILL_ID,
  skillTargets,
  TEMPLATE_REQUIRED_FILES,
} from './install';

const TEMPLATE_FILES = [
  'SKILL.md',
  'template.json',
  'DESIGN.md',
  'references/layout.md',
  'examples/hero.tsx',
  'preview/cover.png',
  'CREDITS.md',
];
const CORE_FILES = ['SKILL.md'];

describe('skillTargets', () => {
  it('maps one skill file to both agent roots (D-008)', () => {
    expect(skillTargets('editorial-slides', 'SKILL.md')).toEqual([
      '.claude/skills/editorial-slides/SKILL.md',
      '.agents/skills/editorial-slides/SKILL.md',
    ]);
  });

  it('rejects escaping paths', () => {
    for (const bad of ['../x.md', '/abs.md', '', 'a//b.md', './x.md', 'a\\b.md', 'C:/x.md']) {
      expect(() => skillTargets('ok-id', bad), bad).toThrow();
    }
    expect(() => skillTargets('Bad_Id', 'SKILL.md')).toThrow();
  });
});

describe('buildTemplateInstallPlan', () => {
  it('installs vanilla-core plus the template skill under both roots', () => {
    const plan = buildTemplateInstallPlan('editorial-slides', TEMPLATE_FILES, CORE_FILES);
    expect(plan.skillIds).toEqual([CORE_SKILL_ID, 'editorial-slides']);
    // Every entry lands in both skill roots: the install result tree.
    for (const e of plan.entries) {
      expect(e.targets).toHaveLength(2);
      expect(e.targets[0]).toMatch(/^\.claude\/skills\//);
      expect(e.targets[1]).toMatch(/^\.agents\/skills\//);
    }
    const targets = plan.entries.flatMap((e) => e.targets);
    expect(targets).toContain('.claude/skills/vanilla-core/SKILL.md');
    expect(targets).toContain('.agents/skills/vanilla-core/SKILL.md');
    expect(targets).toContain('.claude/skills/editorial-slides/SKILL.md');
    expect(targets).toContain('.claude/skills/editorial-slides/references/layout.md');
    expect(targets).toContain('.agents/skills/editorial-slides/preview/cover.png');
    expect(targets).toContain('.agents/skills/editorial-slides/DESIGN.md');
    // Sources stay distinguishable for the copying side.
    expect(plan.entries.find((e) => e.file === 'SKILL.md' && e.source === 'core')).toBeDefined();
    expect(plan.entries.find((e) => e.file === 'SKILL.md' && e.source === 'template')).toBeDefined();
  });

  it('requires SKILL.md, template.json and DESIGN.md in the template', () => {
    for (const missing of TEMPLATE_REQUIRED_FILES) {
      const files = TEMPLATE_FILES.filter((f) => f !== missing);
      expect(() => buildTemplateInstallPlan('t', files, CORE_FILES), missing).toThrow(missing);
    }
    expect(() => buildTemplateInstallPlan('t', TEMPLATE_FILES, [])).toThrow('SKILL.md');
  });

  it('rejects unsafe template file lists', () => {
    expect(() => buildTemplateInstallPlan('t', [...TEMPLATE_FILES, '../evil.md'], CORE_FILES)).toThrow();
    expect(() => buildTemplateInstallPlan('../evil', TEMPLATE_FILES, CORE_FILES)).toThrow();
  });
});
