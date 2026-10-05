import { describe, expect, it } from 'vitest';
import { newScene, sceneSchema, type Scene, type SceneType } from '@/lib/scene/schema';
import { configurableFields } from './merge';
import { customFormFields, formFor, getAt, setAt, SOURCE_SECTION_MAP, visibleSections } from './forms';
import { defaultTemplateFor } from './template';

const mk = (type: SceneType) => newScene({ id: 'scn_A', name: 'A', type, template: defaultTemplateFor(type).ref });
const allPaths = (type: SceneType) => formFor(type).flatMap((s) => s.fields.map((x) => x.path));

describe('form definitions', () => {
  it.each(['static', 'motion', '3d'] as const)('every %s field path exists in a new scene and every term category exists in the glossary', (type) => {
    const scene = mk(type);
    const cats = new Set(defaultTemplateFor(type).glossary.terms.map((t) => t.category));
    for (const section of formFor(type)) {
      for (const field of section.fields) {
        expect(getAt(scene, field.path), `${type}:${field.path}`).not.toBeUndefined();
        if (field.widget === 'term-single' || field.widget === 'term-multi') {
          expect(cats.has(field.category!), `${type}:${field.path} → ${field.category}`).toBe(true);
        }
      }
    }
  });

  it('covers every user-editable field of each scene type except the overview ones', () => {
    const overview = new Set(['brief', 'userPrompt', 'references', 'custom']);
    for (const type of ['static', 'motion', '3d'] as const) {
      const covered = new Set(allPaths(type).map((p) => p.split('.')[0]));
      const missing = configurableFields(type).filter((k) => !covered.has(k) && !overview.has(k));
      expect(missing, type).toEqual([]);
    }
  });

  it('maps all 29 source sections to existing fields (Spec §6.2)', () => {
    const motion = new Set(allPaths('motion'));
    for (let n = 1; n <= 29; n++) {
      expect(SOURCE_SECTION_MAP[n], `section ${n}`).toBeDefined();
      for (const p of SOURCE_SECTION_MAP[n]) expect(motion.has(p), `section ${n} → ${p}`).toBe(true);
    }
    // 26~29(언어·길이·아이디어만 입력·출력 규칙)는 필드가 아니라 규칙 본문이 담는다.
    for (const n of [26, 27, 28, 29]) expect(SOURCE_SECTION_MAP[n]).toEqual([]);
  });

  it('hide removes fields and then empty sections', () => {
    const sections = formFor('motion', { hide: ['audio', 'beats'] }).map((s) => s.id);
    expect(sections).not.toContain('audio');
    expect(sections).not.toContain('beats');
    expect(sections).toContain('copy');
  });

  it('static steps section only shows in steps mode', () => {
    const scene = mk('static');
    expect(visibleSections(scene).map((s) => s.id)).toEqual(['page']);
    expect(visibleSections({ ...scene, mode: 'steps' } as Scene).map((s) => s.id)).toEqual(['page', 'steps']);
  });
});

describe('path helpers', () => {
  it('gets and sets nested values without mutating', () => {
    const scene = mk('motion');
    const next = setAt(scene, 'visualStyle.mood', 'warm');
    expect(getAt(next, 'visualStyle.mood')).toBe('warm');
    expect(getAt(scene, 'visualStyle.mood')).toBe('');
    expect(next).not.toBe(scene);
    expect(getAt(next, 'visualStyle.lighting')).toBe('');
    expect(sceneSchema.safeParse(next).success).toBe(true);
  });

  it('sets a top-level value and creates missing parents', () => {
    expect(setAt({ a: 1 }, 'b', 2)).toEqual({ a: 1, b: 2 });
    expect(setAt({} as Record<string, unknown>, 'custom.tone', 'x')).toEqual({ custom: { tone: 'x' } });
  });
});

describe('custom fields', () => {
  it('turns template fields into form fields stored under custom.<id>', () => {
    const fields = customFormFields([
      { id: 'tone', type: 'select', label: { ko: '톤', en: 'Tone' }, options: [{ id: 'a', label: { ko: 'ㅏ', en: 'A' } }] },
      { id: 'note', type: 'longtext', label: { ko: '메모', en: 'Note' } },
      { id: 'n', type: 'number', label: { ko: '수', en: 'N' } },
      { id: 'on', type: 'boolean', label: { ko: '켬', en: 'On' } },
      { id: 'tags', type: 'multiselect', label: { ko: '태그', en: 'Tags' }, options: [{ id: 'x', label: { ko: 'ㅌ', en: 'X' } }] },
      { id: 'title', type: 'text', label: { ko: '제목', en: 'Title' } },
    ]);
    expect(fields.map((x) => [x.path, x.widget])).toEqual([
      ['custom.tone', 'enum'],
      ['custom.note', 'longtext'],
      ['custom.n', 'number'],
      ['custom.on', 'bool'],
      ['custom.tags', 'string-list'],
      ['custom.title', 'text'],
    ]);
    expect(fields[0].options).toEqual(['a']);
  });
});
