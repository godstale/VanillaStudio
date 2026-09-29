import { describe, expect, it } from 'vitest';
import { assemblePrompt } from './assemble';

const project = {
  outputType: 'video' as const,
  format: { width: 1920, height: 1080, fps: 30, durationSec: 15 },
};

describe('assemblePrompt', () => {
  it('assembles the plan prompt', () => {
    expect(
      assemblePrompt({ kind: 'plan', locale: 'ko', project, userInput: 'Make it warm.' }),
    ).toMatchSnapshot();
  });

  it('assembles the prompts prompt with validation errors', () => {
    expect(
      assemblePrompt({
        kind: 'prompts',
        locale: 'en',
        project,
        errors: ['tasks.0.prompt: must be a .md file'],
      }),
    ).toMatchSnapshot();
  });

  it('assembles a build prompt for one task', () => {
    expect(
      assemblePrompt({
        kind: 'build',
        locale: 'en',
        project,
        task: {
          id: 'T02',
          kind: 'scene',
          target: 's1-intro',
          prompt: 'prompts/scenes/s1-intro.md',
          dependsOn: ['T01'],
        },
      }),
    ).toMatchSnapshot();
  });

  it('assembles a revision prompt', () => {
    expect(
      assemblePrompt({ kind: 'revision', locale: 'ko', reviewFile: 'reviews/R-001.md' }),
    ).toMatchSnapshot();
  });

  it('references paths instead of embedding file content', () => {
    const out = assemblePrompt({ kind: 'plan', locale: 'en', project });
    expect(out).toContain('`brief/brief.md`');
    expect(out).toContain('`DESIGN.md`');
  });

  it('inserts the output language by locale', () => {
    expect(assemblePrompt({ kind: 'plan', locale: 'ko' })).toContain('in Korean');
    expect(assemblePrompt({ kind: 'plan', locale: 'en' })).toContain('in English');
  });

  it('keeps every preamble in English and protects user-owned params', () => {
    for (const kind of ['plan', 'prompts', 'build', 'revision'] as const) {
      const out = assemblePrompt({
        kind,
        locale: 'ko',
        task: { id: 'T1', kind: 'asset', target: 'a', prompt: 'prompts/assets/a.md', dependsOn: [] },
        reviewFile: 'reviews/R-001.md',
      });
      const preamble = out.split('## Reference files')[0];
      expect(preamble).not.toMatch(/[\u3131-\uD79D]/);
      expect(preamble).toContain('params/*.values.json');
    }
  });

  it('de-duplicates references and normalizes separators', () => {
    const out = assemblePrompt({ kind: 'plan', locale: 'en', refs: ['DESIGN.md', 'brief\\notes.md'] });
    const refs = out.split('## Reference files')[1].split('## ')[0];
    expect(refs.match(/`DESIGN.md`/g)).toHaveLength(1);
    expect(out).toContain('`brief/notes.md`');
  });

  it('rejects paths outside the project', () => {
    for (const bad of ['../secret.md', 'C:/x.md', '/etc/passwd']) {
      expect(() => assemblePrompt({ kind: 'plan', locale: 'en', refs: [bad] })).toThrow(/relative/);
    }
  });

  it('requires a task for build and a review file for revision', () => {
    expect(() => assemblePrompt({ kind: 'build', locale: 'en' })).toThrow();
    expect(() => assemblePrompt({ kind: 'revision', locale: 'en' })).toThrow();
  });
});
