import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = new Map<string, string>();
const dirs = new Set<string>();
let counter = 0;
const rel = (p: string) => p.replace(/^\/w\//, '');
const slugify = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scene';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: Record<string, string>) => {
    switch (cmd) {
      case 'write_text_file':
        fs.set(rel(a.path), a.contents);
        return;
      case 'read_text_file': {
        const v = fs.get(rel(a.path));
        if (v === undefined) throw new Error('missing');
        return v;
      }
      case 'list_dir': {
        const base = `${rel(a.path).replace(/\/$/, '')}/`;
        const files = [...fs.keys()].filter((k) => k.startsWith(base) && !k.slice(base.length).includes('/'));
        const subdirs = [...dirs].filter((d) => d.startsWith(base)).map((d) => d.slice(base.length).split('/')[0]);
        if (!files.length && !subdirs.length) throw new Error('no dir');
        return [...new Set(subdirs)].map((name) => ({ name, is_dir: true })).concat(files.map((f) => ({ name: f.slice(base.length), is_dir: false })));
      }
      case 'read_template_folders': {
        const base = `${rel(a.dir)}/`;
        const byDir = new Map<string, Record<string, string>>();
        for (const [k, v] of fs) {
          if (!k.startsWith(base)) continue;
          const [dirName, ...rest] = k.slice(base.length).split('/');
          byDir.set(dirName, { ...(byDir.get(dirName) ?? {}), [rest.join('/')]: v });
        }
        return [...byDir.entries()].map(([dirName, files]) => ({ dirName, files, skipped: [] }));
      }
      case 'create_scene': {
        const slug = slugify(a.name);
        dirs.add(`scenes/${slug}`);
        return { slug, sceneId: `scn_${String(++counter).padStart(12, '0')}`, dir: `/w/scenes/${slug}` };
      }
      case 'delete_scene':
        return '/w/.vanilla/trash/x';
      default:
        throw new Error(`unexpected ${cmd}`);
    }
  },
}));

import { loadCatalog } from './catalog';
import { visibleSections } from './forms';
import { draftFromTemplate, draftToFiles, duplicateDraft, saveDraft, validateDraft, hideableFields } from './templateEditor';
import { createScene, readScene } from '@/lib/scene/files';
import { defaultTemplateFor } from './template';

const ROOT = '/w';
const WS = { id: 'ws_1', name: 'Demo' };
const parent = defaultTemplateFor('motion');

beforeEach(() => {
  fs.clear();
  dirs.clear();
  counter = 0;
});

describe('template editor', () => {
  it('duplicates a built-in into an empty extension and writes only the required files', () => {
    const d = duplicateDraft(parent, 'house', { ko: '우리 회사', en: 'House style' });
    expect(Object.keys(draftToFiles(d))).toEqual(['template.json', 'schema.json']);
    const check = validateDraft(d, parent);
    expect(check.ok).toBe(true);
  });

  it('round-trips a saved template back into a draft', async () => {
    const d = { ...duplicateDraft(parent, 'house', { ko: '우리 회사', en: 'House style' }), hide: ['audio'], rules: 'Always end on the logo.' };
    await saveDraft(ROOT, d);
    const entry = (await loadCatalog(ROOT, null)).get('house@1')!;
    expect(draftFromTemplate(entry.raw!)).toEqual(d);
  });

  it('refuses invalid drafts with a reason', () => {
    const base = duplicateDraft(parent, 'house', { ko: '우리 회사', en: 'House style' });
    expect(validateDraft({ ...base, id: 'Bad Id' }, parent).ok).toBe(false);
    expect(validateDraft({ ...base, label: { ko: '', en: 'x' } }, parent).ok).toBe(false);
    const hideId = validateDraft({ ...base, hide: ['id'] }, parent);
    expect(hideId).toMatchObject({ ok: false, error: expect.stringMatching(/cannot hide/) });
    const redefine = validateDraft({ ...base, fields: [{ id: 'beats', type: 'text', label: { ko: 'ㅂ', en: 'b' } }] }, parent);
    expect(redefine).toMatchObject({ ok: false, error: expect.stringMatching(/redefines a built-in/) });
  });

  it('only offers fields that may be hidden', () => {
    const f = hideableFields('motion');
    expect(f).toContain('audio');
    expect(f).not.toContain('id');
    expect(f).not.toContain('status');
  });

  it('refuses to edit a built-in template directly', () => {
    expect(() => draftFromTemplate(parent)).toThrow(/duplicate/);
  });

  it('E2E: duplicate → add a field and a rule → apply to a new scene → generated files reflect it', async () => {
    const base = duplicateDraft(parent, 'house', { ko: '우리 회사', en: 'House style' });
    const draft = {
      ...base,
      hide: ['audio'],
      fields: [
        {
          id: 'tone',
          type: 'select' as const,
          label: { ko: '톤', en: 'Tone' },
          options: [{ id: 'friendly', label: { ko: '친근', en: 'Friendly' } }],
          default: 'friendly',
        },
      ],
      rules: 'Always end on the house logo.',
      checklist: '- [ ] House logo visible',
    };
    const check = validateDraft(draft, parent);
    expect(check.ok).toBe(true);
    await saveDraft(ROOT, draft);

    const catalog = await loadCatalog(ROOT, null);
    const entry = catalog.get('house@1')!;
    expect(entry.source).toBe('workspace');
    expect(entry.error).toBeUndefined();
    expect(catalog.usable('motion').map((e) => e.ref)).toContain('house@1');

    const { slug, scene } = await createScene(ROOT, WS, { name: 'Promo', type: 'motion', template: entry.template });
    expect(scene.template).toBe('house@1');
    expect(scene.custom).toEqual({ tone: 'friendly' });
    expect((await readScene(ROOT, slug)).custom).toEqual({ tone: 'friendly' });
    expect(fs.get(`scenes/${slug}/AGENTS.md`)).toContain('Always end on the house logo.');
    expect(fs.get(`scenes/${slug}/AGENTS.md`)).toContain('House logo visible');
    expect(fs.get(`scenes/${slug}/AGENTS.md`)).toContain('template: house@1');
    // 내장 규칙은 그대로 유지된다
    expect(fs.get(`scenes/${slug}/AGENTS.md`)).toContain('pure function of time');

    // 폼에서 숨긴 필드는 빠지고 사용자 필드가 보인다
    const sections = visibleSections(scene, entry.template!.schema).map((s) => s.id);
    expect(sections).not.toContain('audio');
    expect(sections).toContain('beats');
    expect(entry.template!.schema.fields.map((f) => f.id)).toEqual(['tone']);
  });

  it('a template that becomes invalid is refused and cannot create scenes via the catalog', async () => {
    const base = duplicateDraft(parent, 'house', { ko: '우리 회사', en: 'House style' });
    await saveDraft(ROOT, base);
    // 사용자가 파일을 손으로 고쳐 규칙을 어김
    fs.set('guide-templates/house@1/schema.json', JSON.stringify({ version: 1, hide: ['id'], defaults: {}, fields: [] }));
    const catalog = await loadCatalog(ROOT, null);
    const entry = catalog.get('house@1')!;
    expect(entry.template).toBeUndefined();
    expect(entry.error).toMatch(/cannot hide/);
    expect(catalog.usable('motion').map((e) => e.ref)).not.toContain('house@1');
  });
});
