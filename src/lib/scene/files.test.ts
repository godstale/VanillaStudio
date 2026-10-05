import { beforeEach, describe, expect, it, vi } from 'vitest';

// 최소 인메모리 파일시스템 + Rust 신 명령 모사.
const fs = new Map<string, string>();
const dirs = new Set<string>();
let counter = 0;
let failWriteOf: string | null = null;

const slugify = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scene';
const rel = (p: string) => p.replace(/^\/w\//, '');

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: Record<string, string>) => {
    switch (cmd) {
      case 'read_text_file': {
        const v = fs.get(rel(a.path));
        if (v === undefined) throw new Error(`missing ${a.path}`);
        return v;
      }
      case 'write_text_file':
        if (failWriteOf && a.path.endsWith(failWriteOf)) throw new Error('disk full');
        fs.set(rel(a.path), a.contents);
        return;
      case 'list_dir': {
        const base = `${rel(a.path)}/`;
        const files = [...fs.keys()].filter((k) => k.startsWith(base) && !k.slice(base.length).includes('/'));
        const subdirs = [...dirs].filter((d) => d.startsWith(base)).map((d) => d.slice(base.length).split('/')[0]);
        if (files.length === 0 && subdirs.length === 0 && !dirs.has(rel(a.path))) throw new Error('no dir');
        return [
          ...new Set(subdirs).values(),
        ].map((name) => ({ name, is_dir: true })).concat(files.map((f) => ({ name: f.slice(base.length), is_dir: false })));
      }
      case 'create_scene': {
        let slug = slugify(a.name);
        for (let n = 2; dirs.has(`scenes/${slug}`); n++) slug = `${slugify(a.name)}-${n}`;
        dirs.add(`scenes/${slug}`);
        return { slug, sceneId: `scn_${String(++counter).padStart(12, '0')}`, dir: `/w/scenes/${slug}` };
      }
      case 'rename_scene': {
        const slug = slugify(a.newName);
        for (const [k, v] of [...fs]) {
          if (!k.startsWith(`scenes/${a.slug}/`)) continue;
          fs.set(k.replace(`scenes/${a.slug}/`, `scenes/${slug}/`), v);
          fs.delete(k);
        }
        dirs.delete(`scenes/${a.slug}`);
        dirs.add(`scenes/${slug}`);
        return { slug, sceneId: '', dir: `/w/scenes/${slug}` };
      }
      case 'duplicate_scene': {
        const slug = slugify(a.newName);
        for (const [k, v] of [...fs]) if (k.startsWith(`scenes/${a.slug}/`)) fs.set(k.replace(`scenes/${a.slug}/`, `scenes/${slug}/`), v);
        dirs.add(`scenes/${slug}`);
        return { slug, sceneId: `scn_${String(++counter).padStart(12, '0')}`, dir: `/w/scenes/${slug}` };
      }
      case 'delete_scene': {
        dirs.delete(`scenes/${a.slug}`);
        for (const k of [...fs.keys()]) if (k.startsWith(`scenes/${a.slug}/`)) fs.delete(k);
        return '/w/.vanilla/trash/x';
      }
      default:
        throw new Error(`unexpected ${cmd}`);
    }
  },
}));

import { createScene, deleteScene, duplicateScene, listScenes, readScene, refreshStatuses, renameScene, writeScene } from './files';
import { sceneSchema } from './schema';
import { checkGuide } from '@/lib/guides/guideMd';
import { outsideMarkers } from '@/lib/guides/markers';

const WS = { id: 'ws_1', name: 'Demo' };
const ROOT = '/w';

beforeEach(() => {
  fs.clear();
  dirs.clear();
  counter = 0;
  failWriteOf = null;
});

describe('scene files', () => {
  it.each(['static', 'motion', '3d'] as const)('creates a %s scene with scene.json and generated guides', async (type) => {
    const { slug, scene } = await createScene(ROOT, WS, { name: 'Intro Scene', type });
    expect(slug).toBe('intro-scene');
    expect(sceneSchema.safeParse(JSON.parse(fs.get('scenes/intro-scene/scene.json')!)).success).toBe(true);
    for (const f of ['GUIDE.md', 'AGENTS.md', 'CLAUDE.md', 'prompts/generate.md', 'prompts/revise.md', 'prompts/analyze-reference.md']) {
      expect(fs.has(`scenes/intro-scene/${f}`), f).toBe(true);
    }
    expect(fs.get('scenes/intro-scene/AGENTS.md')).toContain('workspaceId: ws_1');
    expect(fs.get('scenes/intro-scene/AGENTS.md')).toContain(`sceneId: ${scene.id}`);
    expect(checkGuide(fs.get('scenes/intro-scene/GUIDE.md')!, scene)).toBe('ok');
    expect(scene.type).toBe(type);
  });

  it('removes the folder when writing fails', async () => {
    failWriteOf = 'scene.json';
    await expect(createScene(ROOT, WS, { name: 'Broken', type: 'motion' })).rejects.toThrow('disk full');
    expect(dirs.has('scenes/broken')).toBe(false);
  });

  it('lists scenes and reports a broken scene.json instead of failing', async () => {
    await createScene(ROOT, WS, { name: 'A', type: 'static' });
    await createScene(ROOT, WS, { name: 'B', type: 'motion' });
    fs.set('scenes/b/scene.json', '{ not json');
    dirs.add('scenes/empty-folder');
    const list = await listScenes(ROOT);
    expect(list.map((e) => e.slug)).toEqual(['a', 'b', 'empty-folder']);
    expect(list[0].scene?.name).toBe('A');
    expect(list[1].error).toBeTruthy();
    expect(list[2].error).toBeTruthy();
  });

  it('lists nothing when scenes/ does not exist', async () => {
    expect(await listScenes(ROOT)).toEqual([]);
  });

  it('keeps user text outside the AGENTS.md markers when the scene is saved again', async () => {
    const { slug, scene } = await createScene(ROOT, WS, { name: 'Keep', type: 'motion' });
    const edited = `Team note\n\n${fs.get(`scenes/${slug}/AGENTS.md`)}\nfooter\n`;
    fs.set(`scenes/${slug}/AGENTS.md`, edited);
    fs.set(`scenes/${slug}/CLAUDE.md`, '@AGENTS.md\nmy extra\n');
    await writeScene(ROOT, slug, WS, { ...scene, userPrompt: 'new prompt' });
    expect(outsideMarkers(fs.get(`scenes/${slug}/AGENTS.md`)!)).toBe(outsideMarkers(edited));
    expect(fs.get(`scenes/${slug}/CLAUDE.md`)).toBe('@AGENTS.md\nmy extra\n');
    expect(fs.get(`scenes/${slug}/prompts/generate.md`)).toContain('new prompt');
  });

  it('renames: folder moves, name updates, id stays', async () => {
    const { slug, scene } = await createScene(ROOT, WS, { name: 'Old', type: 'static' });
    const r = await renameScene(ROOT, WS, slug, 'Brand New');
    expect(r.slug).toBe('brand-new');
    expect(r.scene.name).toBe('Brand New');
    expect((await readScene(ROOT, 'brand-new')).id).toBe(scene.id);
    expect(fs.get('scenes/brand-new/AGENTS.md')).toContain('scene: Brand New');
  });

  it('duplicates with a new id and draft status', async () => {
    const { slug, scene } = await createScene(ROOT, WS, { name: 'Src', type: 'motion' });
    await writeScene(ROOT, slug, WS, { ...scene, status: 'generated' });
    const d = await duplicateScene(ROOT, WS, slug, 'Src Copy');
    expect(d.scene.id).not.toBe(scene.id);
    expect(d.scene.status).toBe('draft');
    expect(d.scene.name).toBe('Src Copy');
    expect(checkGuide(fs.get(`scenes/${d.slug}/GUIDE.md`)!, d.scene)).toBe('ok');
  });

  it('deletes through the trash command', async () => {
    const { slug } = await createScene(ROOT, WS, { name: 'Gone', type: 'static' });
    expect(await deleteScene(ROOT, slug)).toContain('trash');
    expect(await listScenes(ROOT)).toEqual([]);
  });

  describe('refreshStatuses', () => {
    it('walks a scene through its life from file changes alone', async () => {
      const { slug } = await createScene(ROOT, WS, { name: 'Life', type: 'motion' });
      const status = async () => (await readScene(ROOT, slug)).status;
      const run = async () => refreshStatuses(ROOT, WS, await listScenes(ROOT));

      expect(await run()).toBe(false);
      expect(await status()).toBe('draft');

      const scene = await readScene(ROOT, slug);
      await writeScene(ROOT, slug, WS, { ...scene, userPrompt: 'make it punchy' });
      expect(await run()).toBe(true);
      expect(await status()).toBe('prompt-ready');

      fs.set(`scenes/${slug}/src/index.html`, '<html></html>');
      expect(await run()).toBe(true);
      expect(await status()).toBe('generated');
      expect(await run()).toBe(false); // 안정: 다시 돌려도 바뀌지 않는다

      // scene.json을 앱 밖에서 고침(GUIDE.md는 그대로) → 수정 필요
      const edited = JSON.parse(fs.get(`scenes/${slug}/scene.json`)!);
      edited.structure = 'continuous';
      fs.set(`scenes/${slug}/scene.json`, JSON.stringify(edited));
      expect(await run()).toBe(true);
      expect(await status()).toBe('needs-revision');
      expect(await run()).toBe(false);
    });

    it('skips scenes whose scene.json is unreadable', async () => {
      await createScene(ROOT, WS, { name: 'Bad', type: 'static' });
      fs.set('scenes/bad/scene.json', '{');
      expect(await refreshStatuses(ROOT, WS, await listScenes(ROOT))).toBe(false);
    });
  });
});
