import { describe, expect, it } from 'vitest';
import { buildTemplate, defaultTemplateFor, getBuiltinTemplate, listBuiltinTemplates } from './template';

describe('built-in templates', () => {
  it('ships one valid skeleton per scene type', () => {
    const t = listBuiltinTemplates();
    expect(t.map((x) => x.ref).sort()).toEqual(['commercial@1', 'three-scene@1', 'web-page@1']);
    expect(t.map((x) => x.meta.type).sort()).toEqual(['3d', 'motion', 'static']);
    for (const x of t) {
      expect(x.rules.length).toBeGreaterThan(0);
      expect(x.checklist.length).toBeGreaterThan(0);
      expect(Object.keys(x.prompts).sort()).toEqual(['analyze-reference', 'generate', 'revise']);
      expect(x.rules).not.toContain('\r');
    }
  });

  it('resolves by ref and by scene type', () => {
    expect(getBuiltinTemplate('commercial@1')?.meta.type).toBe('motion');
    expect(getBuiltinTemplate('nope@1')).toBeNull();
    expect(defaultTemplateFor('static').ref).toBe('web-page@1');
  });
});

describe('buildTemplate', () => {
  const ok = {
    'template.json': JSON.stringify({ id: 'x', version: 1, type: 'motion', label: { ko: 'ㅋ', en: 'x' }, extends: null }),
    'schema.json': JSON.stringify({ version: 1, hide: [], defaults: {} }),
    'glossary.json': JSON.stringify({ version: 1, terms: {} }),
    'rules.md': 'r',
    'checklist.md': 'c',
    'prompts/generate.md': 'g',
    'prompts/analyze-reference.md': 'a',
    'prompts/revise.md': 'v',
  };

  it('accepts a complete template', () => {
    expect(buildTemplate(ok, 'motion').ref).toBe('x@1');
  });

  it('rejects a missing file, bad JSON, bad meta and a type mismatch', () => {
    const { 'rules.md': _r, ...noRules } = ok;
    void _r;
    expect(() => buildTemplate(noRules)).toThrow(/rules\.md/);
    expect(() => buildTemplate({ ...ok, 'glossary.json': '{' })).toThrow(/valid JSON/);
    expect(() => buildTemplate({ ...ok, 'template.json': JSON.stringify({ id: 'X' }) })).toThrow();
    expect(() => buildTemplate(ok, 'static')).toThrow(/not static/);
  });

  it('rejects unknown schema fields (user templates may only extend)', () => {
    expect(() => buildTemplate({ ...ok, 'schema.json': JSON.stringify({ version: 1, hide: [], defaults: {}, replace: true }) })).toThrow();
  });
});
