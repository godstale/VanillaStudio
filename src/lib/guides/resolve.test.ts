import { describe, expect, it } from 'vitest';
import { buildCatalog, type RawTemplateFolder } from './resolve';
import { listBuiltinTemplates } from './template';

const builtin = listBuiltinTemplates();

const folder = (id: string, ver: number, over: { extends?: string | null; type?: string; schema?: object; files?: Record<string, string>; dirName?: string } = {}): RawTemplateFolder => ({
  dirName: over.dirName ?? `${id}@${ver}`,
  skipped: [],
  files: {
    'template.json': JSON.stringify({ id, version: ver, type: over.type ?? 'motion', label: { ko: '내 템플릿', en: 'Mine' }, extends: over.extends === undefined ? 'commercial@1' : over.extends }),
    'schema.json': JSON.stringify({ version: 1, hide: [], defaults: {}, fields: [], ...over.schema }),
    ...over.files,
  },
});

describe('template catalog', () => {
  it('contains the built-ins when there are no user templates', () => {
    const c = buildCatalog(builtin);
    expect(c.usable().map((e) => e.ref)).toEqual(expect.arrayContaining(['commercial@1', 'three-scene@1', 'web-page@1']));
    expect(c.get('commercial@1')?.source).toBe('builtin');
    expect(c.get('missing@1')).toBeNull();
  });

  it('resolves a user template that extends a built-in and merges it', () => {
    const c = buildCatalog(builtin, [], [folder('mine', 1, { files: { 'rules.md': 'Always end on the logo.' }, schema: { hide: ['audio'] } })]);
    const e = c.get('mine@1')!;
    expect(e.source).toBe('workspace');
    expect(e.error).toBeUndefined();
    expect(e.template?.rules).toContain('Always end on the logo.');
    expect(e.template?.schema.hide).toEqual(['audio']);
    expect(c.usable('motion').map((x) => x.ref)).toContain('mine@1');
    expect(c.usable('static').map((x) => x.ref)).not.toContain('mine@1');
  });

  it('workspace beats global beats built-in for the same ref', () => {
    const g = folder('shared', 1, { files: { 'rules.md': 'from global' } });
    const w = folder('shared', 1, { files: { 'rules.md': 'from workspace' } });
    expect(buildCatalog(builtin, [g], [w]).get('shared@1')?.template?.rules).toContain('from workspace');
    expect(buildCatalog(builtin, [g], []).get('shared@1')?.template?.rules).toContain('from global');
    expect(buildCatalog(builtin, [g], [w]).get('shared@1')?.source).toBe('workspace');
  });

  it('a workspace template can extend the same ref from a lower source without a cycle', () => {
    const w = folder('commercial', 1, { files: { 'rules.md': 'house rules' } });
    const c = buildCatalog(builtin, [], [w]);
    const e = c.get('commercial@1')!;
    expect(e.source).toBe('workspace');
    expect(e.template?.rules).toContain('house rules');
    expect(e.template?.rules).toContain('pure function of time'); // built-in rules are still there
  });

  it('refuses an invalid template and does not fall back silently to a lower one', () => {
    const bad = folder('commercial', 1, { schema: { hide: ['id'] } }); // identity fields cannot be hidden
    const c = buildCatalog(builtin, [], [bad]);
    const e = c.get('commercial@1')!;
    expect(e.source).toBe('workspace');
    expect(e.error).toMatch(/cannot hide/);
    expect(e.template).toBeUndefined();
    expect(c.usable().some((x) => x.source === 'workspace')).toBe(false);
  });

  it('reports a missing parent, a type change, a bad folder name and unreadable files', () => {
    const c = buildCatalog(builtin, [], [
      folder('orphan', 1, { extends: 'ghost@1' }),
      folder('wrongtype', 1, { type: 'static' }),
      folder('named', 1, { dirName: 'other@1' }),
      { dirName: 'broken@1', skipped: ['rules.md: larger than 262144 bytes'], files: { 'template.json': '{' } },
    ]);
    expect(c.get('orphan@1')?.error).toMatch(/parent ghost@1 not found/);
    expect(c.get('wrongtype@1')?.error).toMatch(/differs from parent|not found/);
    expect(c.get('other@1')?.error).toMatch(/does not match/);
    expect(c.get('broken@1')?.error).toBeTruthy();
    expect(c.get('broken@1')?.skipped).toHaveLength(1);
  });

  it('chains extends through several user templates', () => {
    const a = folder('base', 1, { files: { 'rules.md': 'base rule' } });
    const b = folder('child', 1, { extends: 'base@1', files: { 'rules.md': 'child rule' } });
    const c = buildCatalog(builtin, [], [a, b]);
    const t = c.get('child@1')?.template;
    expect(t?.rules).toContain('base rule');
    expect(t?.rules).toContain('child rule');
  });

  it('rejects an extends cycle or an over-deep chain', () => {
    const a = folder('a', 1, { extends: 'b@1' });
    const b = folder('b', 1, { extends: 'a@1' });
    const c = buildCatalog(builtin, [], [a, b]);
    expect(c.get('a@1')?.error).toBeTruthy();
    expect(c.get('b@1')?.error).toBeTruthy();
  });

  it('an invalid parent makes the child unusable', () => {
    const bad = folder('base', 1, { schema: { hide: ['id'] } });
    const child = folder('child', 1, { extends: 'base@1' });
    const c = buildCatalog(builtin, [], [bad, child]);
    expect(c.get('child@1')?.error).toMatch(/not usable|not found/);
  });
});
