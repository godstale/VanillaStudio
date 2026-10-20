// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as { cmd: string; args: Record<string, unknown> }[]);
const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: Record<string, unknown>) => {
    calls.push({ cmd, args: a });
    const norm = (p: unknown) => String(p).replace(/\\/g, '/');
    switch (cmd) {
      case 'create_scene':
        return { slug: String(a.name), sceneId: 'scn_migrated001', dir: `/dest/scenes/${a.name}` };
      case 'write_text_file':
        disk.set(norm(a.path).replace(/^\/dest\//, ''), String(a.contents));
        return;
      case 'import_external_file':
        disk.set(norm(a.dest).replace(/^\/dest\//, ''), `[copied from ${norm(a.source)}]`);
        return;
      case 'read_text_file': {
        const v = disk.get(norm(a.path).replace(/^\/dest\//, ''));
        if (v === undefined) throw new Error('missing');
        return v;
      }
      case 'list_dir': {
        const base = `${norm(a.path).replace(/^\/dest\//, '').replace(/\/$/, '')}/`;
        const files = [...disk.keys()].filter((k) => k.startsWith(base) && !k.slice(base.length).includes('/'));
        if (!files.length) throw new Error('no dir');
        return files.map((f) => ({ name: f.slice(base.length), is_dir: false }));
      }
      default:
        throw new Error(`unexpected ${cmd}`);
    }
  },
}));

import { parseScene } from '@/lib/scene/schema';
import { parseSequence } from '@/lib/sequence/schema';
import { applyV1Migration, joinNative } from './applyV1';
import { planV1Migration, type V1Bundle } from './v1';

const FIXTURES = resolve(__dirname, '../../../tests/fixtures/v1');
const TEXT_EXT = new Set(['ts', 'tsx', 'json', 'md', 'html', 'svg', 'txt']);
const WANTED = new Set(['vanilla.json', 'DESIGN.md', 'frame.md', 'index.html', 'brief', 'plan', 'assets', 'src', 'params', 'public']);
function readBundle(root: string): V1Bundle {
  const out: V1Bundle = { root, texts: {}, binaries: ['src/assets/logo.png', 'brief/materials/photo.jpg'], skipped: [] };
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (TEXT_EXT.has(name.split('.').pop() ?? '')) out.texts[relative(root, p).split(sep).join('/')] = readFileSync(p, 'utf8');
    }
  };
  for (const name of readdirSync(root).sort()) {
    if (!WANTED.has(name)) out.skipped.push(name);
    else if (statSync(join(root, name)).isDirectory()) walk(join(root, name));
    else out.texts[name] = readFileSync(join(root, name), 'utf8');
  }
  return out;
}

const api = { createWorkspace: vi.fn(async () => 'ws_new0000000001'), openWorkspace: vi.fn(async () => ({ kind: 'workspace' as const, workspaceId: 'ws_new0000000001', name: 'x' })) };

beforeEach(() => {
  calls.length = 0;
  disk.clear();
  api.createWorkspace.mockClear();
  api.openWorkspace.mockClear();
});

describe('applyV1Migration', () => {
  it('creates the workspace, writes the converted files, copies binaries and regenerates the guides', async () => {
    const bundle = readBundle(join(FIXTURES, 'video-promo'));
    const r = planV1Migration(bundle);
    if (!r.ok) throw new Error(r.error);
    const res = await applyV1Migration('/dest', r.plan, 'C:\\v1\\video-promo', api);

    expect(api.createWorkspace).toHaveBeenCalledWith('/dest', 'video-promo', { aspect: '16:9', width: 1920, height: 1080, fps: 30 });
    expect(api.openWorkspace).toHaveBeenCalledWith('/dest');
    expect(res).toMatchObject({ workspaceId: 'ws_new0000000001', slug: 'video-promo', sceneId: 'scn_migrated001' });

    // workspace-level and scene-level files
    expect(disk.get('DESIGN.md')).toBe(bundle.texts['DESIGN.md']);
    expect(disk.get('scenes/video-promo/src/scenes/intro.tsx')).toBe(bundle.texts['src/scenes/intro.tsx']);
    expect(disk.get('scenes/video-promo/params/intro.values.json')).toBe(bundle.texts['params/intro.values.json']);
    expect(disk.get('scenes/video-promo/src/index.html')).toContain('./main.tsx');
    expect(disk.get('scenes/video-promo/v1-archive/plan.json')).toBeTruthy();

    // binaries are copied from the v1 folder using its own separator (extended Windows paths reject "/")
    const copies = calls.filter((c) => c.cmd === 'import_external_file');
    expect(copies.map((c) => c.args.source)).toEqual(['C:\\v1\\video-promo\\src\\assets\\logo.png', 'C:\\v1\\video-promo\\brief\\materials\\photo.jpg']);
    expect(res.copied).toBe(2);

    // guides regenerated for THIS workspace, scene.json uses the issued id
    const scene = parseScene(disk.get('scenes/video-promo/scene.json')!);
    expect(scene.id).toBe('scn_migrated001');
    expect(disk.get('scenes/video-promo/AGENTS.md')).toContain('workspaceId: ws_new0000000001');
    expect(disk.get('scenes/video-promo/GUIDE.md')).toBeTruthy();
    const seq = parseSequence(disk.get('sequence.json')!);
    expect(seq).toMatchObject({ workspaceId: 'ws_new0000000001', start: 'scn_migrated001' });
    expect(seq.nodes).toHaveLength(1);
  });

  it('never writes into the v1 folder: every write targets the new workspace', async () => {
    const r = planV1Migration(readBundle(join(FIXTURES, 'web-landing')));
    if (!r.ok) throw new Error(r.error);
    await applyV1Migration('/dest', r.plan, '/home/me/v1/web-landing', api);
    for (const c of calls.filter((x) => x.cmd === 'write_text_file')) expect(String(c.args.path).startsWith('/dest/')).toBe(true);
    for (const c of calls.filter((x) => x.cmd === 'import_external_file')) expect(String(c.args.dest).startsWith('/dest/')).toBe(true);
    expect(calls.some((c) => c.cmd === 'delete_path' || c.cmd === 'delete_scene')).toBe(false);
  });

  it('stops with the error when the workspace cannot be created', async () => {
    const r = planV1Migration(readBundle(join(FIXTURES, 'slides-deck')));
    if (!r.ok) throw new Error(r.error);
    api.createWorkspace.mockRejectedValueOnce(new Error('destination-not-empty'));
    await expect(applyV1Migration('/dest', r.plan, '/v1', api)).rejects.toThrow('destination-not-empty');
    expect(calls).toEqual([]); // nothing was written
  });
});

describe('joinNative', () => {
  it('follows the separator of the source root', () => {
    expect(joinNative('C:\\a\\b', 'src/x/y.png')).toBe('C:\\a\\b\\src\\x\\y.png');
    expect(joinNative('\\\\?\\C:\\a\\', 'src/x.png')).toBe('\\\\?\\C:\\a\\src\\x.png');
    expect(joinNative('/home/me/p/', 'src/x.png')).toBe('/home/me/p/src/x.png');
  });
});
