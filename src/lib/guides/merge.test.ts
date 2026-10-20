import { describe, expect, it } from 'vitest';
import { newScene } from '@/lib/scene/schema';
import { applyTemplateDefaults, configurableFields, mergeTemplate, sceneFieldNames, TemplateError } from './merge';
import { buildTemplate, defaultTemplateFor, type GuideTemplate } from './template';

const parent = defaultTemplateFor('motion'); // commercial@1

function child(over: { schema?: object; extra?: Record<string, string>; meta?: object } = {}): GuideTemplate {
  return buildTemplate({
    'template.json': JSON.stringify({ id: 'mine', version: 1, type: 'motion', label: { ko: '내 템플릿', en: 'Mine' }, extends: 'commercial@1', ...over.meta }),
    'schema.json': JSON.stringify({ version: 1, hide: [], defaults: {}, fields: [], ...over.schema }),
    ...over.extra,
  });
}

const rejects = (c: GuideTemplate, re: RegExp) => {
  expect(() => mergeTemplate(c, parent)).toThrow(TemplateError);
  expect(() => mergeTemplate(c, parent)).toThrow(re);
};

describe('extending templates', () => {
  it('loads with only template.json and schema.json', () => {
    const c = child();
    expect(c.rules).toBe('');
    expect(c.glossary.terms).toEqual([]);
  });

  it('merges additions: fields, hide, defaults, terms, rules, checklist, prompts', () => {
    const c = child({
      schema: {
        hide: ['audio'],
        defaults: { structure: 'continuous', tone: 'friendly' },
        fields: [{ id: 'tone', type: 'select', label: { ko: '톤', en: 'Tone' }, options: [{ id: 'friendly', label: { ko: '친근', en: 'Friendly' } }] }],
      },
      extra: {
        'rules.md': 'Always end on the logo.',
        'checklist.md': '- [ ] Logo visible',
        'prompts/generate.md': 'Custom generate prompt.',
        'glossary.json': JSON.stringify({
          version: 1,
          terms: [{ category: 'typography', id: 'wobble', label: { ko: '흔들림', en: 'Wobble' }, definition: { ko: '흔들림', en: 'Wobble' }, implementationHint: 'rotate +-2deg', tags: [] }],
        }),
      },
    });
    const m = mergeTemplate(c, parent);
    expect(m.ref).toBe('mine@1');
    expect(m.schema.hide).toEqual(['audio']);
    expect(m.schema.defaults).toMatchObject({ structure: 'continuous', tone: 'friendly' });
    expect(m.schema.fields.map((f) => f.id)).toEqual(['tone']);
    expect(m.glossary.terms.length).toBe(parent.glossary.terms.length + 1);
    expect(m.rules.startsWith(parent.rules.trimEnd())).toBe(true);
    expect(m.rules).toContain('Additional rules (mine@1)');
    expect(m.rules).toContain('Always end on the logo.');
    expect(m.checklist).toContain('Logo visible');
    expect(m.prompts.generate).toBe('Custom generate prompt.');
    expect(m.prompts.revise).toBe(parent.prompts.revise);
  });

  it('rejects a wrong parent or a changed type', () => {
    rejects(child({ meta: { extends: 'other@1' } }), /not commercial@1/);
    rejects(child({ meta: { type: 'static' } }), /differs from parent/);
  });

  it('rejects hiding identity fields or unknown fields', () => {
    for (const f of ['id', 'name', 'type', 'template', 'runtime', 'status', 'custom', 'nope']) {
      rejects(child({ schema: { hide: [f] } }), /cannot hide/);
    }
  });

  it('rejects redefining a built-in field, duplicates, missing options and bad field defaults', () => {
    const field = (over: object) => ({ id: 'tone', type: 'text', label: { ko: 'ㅋ', en: 'x' }, ...over });
    rejects(child({ schema: { fields: [field({ id: 'beats' })] } }), /redefines a built-in/);
    rejects(child({ schema: { fields: [field({}), field({})] } }), /duplicate field/);
    rejects(child({ schema: { fields: [field({ type: 'select' })] } }), /needs options/);
    rejects(child({ schema: { fields: [field({ default: 5 })] } }), /default of "tone"/);
  });

  it('rejects defaults that would make a scene invalid or point at nothing', () => {
    rejects(child({ schema: { defaults: { structure: 'zigzag' } } }), /invalid defaults/);
    rejects(child({ schema: { defaults: { id: 'scn_X' } } }), /unknown default/);
    rejects(child({ schema: { defaults: { whatever: 1 } } }), /unknown default/);
  });

  it('rejects a term that already exists in the parent', () => {
    const dup = { category: 'typography', id: 'pop', label: { ko: 'ㅋ', en: 'x' }, definition: { ko: 'ㅋ', en: 'x' }, implementationHint: '', tags: [] };
    rejects(child({ extra: { 'glossary.json': JSON.stringify({ version: 1, terms: [dup] }) } }), /already exists/);
  });
});

describe('field lists', () => {
  it('lists configurable fields without identity fields', () => {
    const f = configurableFields('motion');
    expect(f).toContain('beats');
    expect(f).not.toContain('id');
    expect(sceneFieldNames('static')).toContain('steps');
    expect(configurableFields('static')).not.toContain('beats');
  });
});

describe('applyTemplateDefaults', () => {
  it('applies built-in and custom defaults to a new scene', () => {
    const c = mergeTemplate(
      child({
        schema: {
          defaults: { structure: 'continuous' },
          fields: [{ id: 'tone', type: 'text', label: { ko: '톤', en: 'Tone' }, default: 'friendly' }],
        },
      }),
      parent,
    );
    const scene = applyTemplateDefaults(newScene({ id: 'scn_A', name: 'A', type: 'motion', template: c.ref }), c);
    expect(scene).toMatchObject({ structure: 'continuous', custom: { tone: 'friendly' } });
  });

  it('leaves scenes alone for the built-in template', () => {
    const s = newScene({ id: 'scn_A', name: 'A', type: 'motion', template: parent.ref });
    expect(applyTemplateDefaults(s, parent)).toEqual(s);
  });
});
