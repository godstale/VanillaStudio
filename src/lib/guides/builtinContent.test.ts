import { describe, expect, it } from 'vitest';
import { categories, termsIn } from './glossary';
import { glossarySchema, listBuiltinTemplates } from './template';

const byType = (type: string) => listBuiltinTemplates().find((t) => t.meta.type === type)!;

describe('built-in template content', () => {
  it.each(['static', 'motion', '3d'])('%s template is complete: rules, checklist, three prompts, valid glossary', (type) => {
    const t = byType(type);
    expect(t.rules.length).toBeGreaterThan(1500);
    expect(t.checklist).toMatch(/- \[ \]/);
    for (const p of Object.values(t.prompts)) expect(p.trim().length).toBeGreaterThan(100);
    expect(glossarySchema.safeParse(t.glossary).success).toBe(true);
    expect(t.glossary.terms.length).toBeGreaterThan(20);
  });

  it('static rules forbid automatic progress and list the allowed advance inputs', () => {
    const t = byType('static');
    expect(t.rules).toMatch(/nothing advances on its own/i);
    expect(t.rules).toContain('`click`, `key:<Key>`');
    expect(t.rules).toContain('`choice:<label>`');
    expect(t.prompts.generate).toContain('advances only on user input');
  });

  it('static glossary covers the fields the static scene schema uses', () => {
    expect(categories(byType('static').glossary).sort()).toEqual(['accessibility', 'breakpoints', 'enter', 'layout', 'sections', 'theme', 'transition']);
    expect(termsIn(byType('static').glossary, 'enter').length).toBeGreaterThan(3);
  });

  it('3d rules require determinism and a performance budget; glossary has the 3d categories', () => {
    const t = byType('3d');
    expect(t.rules).toContain('deterministic');
    expect(t.rules).toMatch(/performanceBudget/);
    for (const c of ['composition', 'materials', 'lighting', 'cameraPath', 'performanceBudget', 'structure']) {
      expect(categories(t.glossary), c).toContain(c);
    }
  });
});
