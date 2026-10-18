import { describe, expect, it } from 'vitest';
import { categories, findTerm, searchTerms, splitValues, termLabel, termsIn } from './glossary';
import { buildTemplate, defaultTemplateFor, glossarySchema, listBuiltinTemplates } from './template';

const motion = defaultTemplateFor('motion').glossary;

describe('motion glossary', () => {
  it('has the categories the scene schema fields use', () => {
    expect(categories(motion).sort()).toEqual(
      ['adStructure', 'brandVoice', 'camera', 'creativeMode', 'layout', 'material', 'object', 'structure', 'theme', 'transition', 'typography'].sort(),
    );
  });

  it('covers every item the source guide lists', () => {
    expect(termsIn(motion, 'creativeMode').length).toBeGreaterThanOrEqual(15);
    expect(termsIn(motion, 'structure').map((t) => t.id)).toEqual(['multi-shot', 'continuous', 'hybrid']);
    expect(termsIn(motion, 'adStructure').length).toBeGreaterThanOrEqual(9);
    expect(termsIn(motion, 'brandVoice').length).toBeGreaterThanOrEqual(12);
    expect(termsIn(motion, 'typography').length).toBeGreaterThanOrEqual(12);
    expect(termsIn(motion, 'object').length).toBeGreaterThanOrEqual(12);
    expect(termsIn(motion, 'material').length).toBeGreaterThanOrEqual(9);
    expect(termsIn(motion, 'transition').length).toBeGreaterThanOrEqual(9);
  });

  it('every term has both languages, a definition and an implementation hint', () => {
    for (const t of motion.terms) {
      expect(t.label.ko && t.label.en && t.definition.ko && t.definition.en, t.id).toBeTruthy();
      expect(t.implementationHint.length, t.id).toBeGreaterThan(5);
    }
  });

  it('structure ids match the scene schema enum', () => {
    expect(termsIn(motion, 'structure').map((t) => t.id)).toEqual(['multi-shot', 'continuous', 'hybrid']);
  });
});

describe('glossary helpers', () => {
  it('finds and labels terms, falling back to the raw value for free input', () => {
    expect(findTerm(motion, 'typography', 'scale-punch')?.label.en).toBe('Scale punch');
    expect(termLabel(motion, 'typography', 'scale-punch', 'ko')).toBe('스케일 펀치');
    expect(termLabel(motion, 'typography', 'my own move', 'ko')).toBe('my own move');
  });

  it('searches labels, ids and tags case-insensitively', () => {
    expect(searchTerms(motion, 'typography', 'PUNCH').map((t) => t.id)).toEqual(['scale-punch']);
    expect(searchTerms(motion, 'typography', '펀치').map((t) => t.id)).toEqual(['scale-punch']);
    expect(searchTerms(motion, 'typography', '')).toHaveLength(termsIn(motion, 'typography').length);
    expect(searchTerms(motion, 'typography', 'zzzz')).toEqual([]);
  });

  it('splits stored values into known ids and free input', () => {
    expect(splitValues(motion, 'camera', ['push-in', 'wobble', 'crane'])).toEqual({ known: ['push-in', 'crane'], custom: ['wobble'] });
  });
});

describe('glossary schema', () => {
  it('rejects duplicate ids within a category but allows the same id across categories', () => {
    const term = { category: 'a', id: 'x', label: { ko: 'ㅋ', en: 'x' }, definition: { ko: 'ㅋ', en: 'x' }, implementationHint: '', tags: [] };
    expect(glossarySchema.safeParse({ version: 1, terms: [term, term] }).success).toBe(false);
    expect(glossarySchema.safeParse({ version: 1, terms: [term, { ...term, category: 'b' }] }).success).toBe(true);
  });

  it('every built-in template glossary validates', () => {
    for (const t of listBuiltinTemplates()) expect(glossarySchema.safeParse(t.glossary).success, t.ref).toBe(true);
    expect(() => buildTemplate({})).toThrow();
  });
});
