import { describe, expect, it } from 'vitest';
import { defaultTemplateFor } from './template';

// Refactor-Spec-v2 §6.2: the 29 sections of the source guide each have a home in rules.md.
const rules = defaultTemplateFor('motion').rules;

describe('motion rules.md', () => {
  it('has a numbered section for each of the 29 source sections plus the runtime contract', () => {
    for (let n = 0; n <= 29; n++) {
      expect(rules, `section ${n}`).toMatch(new RegExp(`^## ${n}\. `, 'm'));
    }
  });

  it('keeps the hard rules the app and checker rely on', () => {
    expect(rules).toContain('pure function of time');
    expect(rules).toContain('at least 0.7 s');
    expect(rules).toContain('immutable');
    expect(rules).toContain('no character limit');
    expect(rules).toContain('write-back whitelist');
    expect(rules).toContain('syllable blocks');
  });

  it('the checklist and prompts are complete', () => {
    const t = defaultTemplateFor('motion');
    expect(t.checklist).toContain('0.7 s');
    expect(t.prompts.generate).toContain('Output only the working scene');
    expect(t.prompts['analyze-reference']).toContain('Never copy a reference');
    expect(t.prompts.revise).toContain('Keep everything that did not change');
  });

  it('ids in the glossary match the structure enum used by scenes', () => {
    expect(rules).toContain('`multi-shot`, `continuous` or `hybrid`');
  });
});
