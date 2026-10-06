import { beforeEach, describe, expect, it, vi } from 'vitest';

// Rust 명령을 메모리 파일시스템으로 흉내 낸다(실제 Rust 동작은 package_commands.rs의 cargo test가 검증).
const fs = new Map<string, string>();
const pkg = vi.hoisted(() => ({ files: new Map<string, string>(), failExtractFor: null as string | null, nextId: 1 }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: Record<string, unknown>) => {
    const rel = (p: unknown) => String(p).replace(/^\/w\//, '');
    switch (cmd) {
      case 'create_scene': {
        const slug = String(a.name).toLowerCase();
        let s = slug;
        for (let n = 2; [...fs.keys()].some((k) => k.startsWith(`scenes/${s}/`)); n++) s = `${slug}-${n}`;
        fs.set(`scenes/${s}/.keep`, '');
        return { slug: s, sceneId: `scn_new${pkg.nextId++}`, dir: `/w/scenes/${s}` };
      }
      case 'extract_vsx_scene': {
        if (pkg.failExtractFor === a.sourceSlug) throw new Error('hash-mismatch: x');
        const prefix = `scenes/${a.sourceSlug}/`;
        for (const [name, text] of pkg.files) if (name.startsWith(prefix)) fs.set(`scenes/${a.targetSlug}/${name.slice(prefix.length)}`, text);
        return [];
      }
      case 'extract_vsx_templates':
        return { imported: ['guide-templates/mine@1'], skipped: [] };
      case 'read_vsx_text': {
        const v = pkg.files.get(String(a.entry));
        if (v === undefined) throw new Error('missing-file');
        return v;
      }
      case 'read_text_file': {
        const v = fs.get(rel(a.path));
        if (v === undefined) throw new Error('missing');
        return v;
      }
      case 'write_text_file':
        fs.set(rel(a.path), String(a.contents));
        return;
      case 'delete_scene':
        for (const k of [...fs.keys()]) if (k.startsWith(`scenes/${a.slug}/`)) fs.delete(k);
        return;
      case 'list_dir': {
        const base = `${rel(a.path).replace(/\/$/, '')}/`;
        const files = [...fs.keys()].filter((k) => k.startsWith(base) && !k.slice(base.length).includes('/'));
        if (!files.length) throw new Error('no dir');
        return files.map((f) => ({ name: f.slice(base.length), is_dir: false }));
      }
      default:
        throw new Error(`unexpected ${cmd}`);
    }
  },
}));

import { builtinResolver } from '@/lib/scene/files';
import { newScene, parseScene, serializeScene, type Scene } from '@/lib/scene/schema';
import { addNode, newSequence, parseSequence, serializeSequence, type Sequence } from '@/lib/sequence/schema';
import { importScenes, remapEdges, scenesInPackage, type ImportDeps } from './import';
import { manifestSchema, type PackageInfo } from './manifest';

const WS = { id: 'ws_mine', name: 'Mine' };
const sha = 'a'.repeat(64);
const tr = { type: 'crossfade', durationMs: 600, easing: 'ease-in-out', params: {} };

const introScene = { ...newScene({ id: 'scn_origIntro', name: 'Intro', type: 'motion', template: 'commercial@1' }), status: 'generated' } as Scene;
const pageScene = { ...newScene({ id: 'scn_origPage', name: 'Page', type: 'static', template: 'web-page@1' }), status: 'generated' } as Scene;

const pkgSeq: Sequence = {
  ...['scn_origIntro', 'scn_origPage'].reduce<Sequence>((s, id) => addNode(s, id, { x: 0, y: 0 }), { ...newSequence('ws_theirs'), mode: 'interactive' }),
  edges: [{ from: 'scn_origIntro', to: 'scn_origPage', trigger: 'end', transition: tr }],
};

function info(over: { kind?: 'sequence' | 'scene'; scene?: string | null; templates?: string[]; files?: string[] } = {}): PackageInfo {
  const files = over.files ?? ['scenes/intro/scene.json', 'scenes/page/scene.json', 'sequence.json'];
  return {
    manifest: manifestSchema.parse({
      formatVersion: 1,
      kind: over.kind ?? 'sequence',
      app: { name: 'vanilla-studio', version: '0.1.0' },
      schemas: { workspace: 1, scene: 1, sequence: 1 },
      workspace: { id: 'ws_theirs', name: 'Theirs' },
      scene: over.scene ?? null,
      templates: over.templates ?? [],
      files: files.map((path) => ({ path, size: 1, sha256: sha })),
    }),
    reviewFiles: [],
    totalBytes: 2,
  };
}

const deps = (over: Partial<ImportDeps> = {}): ImportDeps => ({
  importTemplates: async () => ({ imported: [], skipped: [] }),
  resolverAfterTemplates: async () => builtinResolver,
  readText: async (_p, entry) => {
    const v = pkg.files.get(entry);
    if (v === undefined) throw new Error('missing');
    return v;
  },
  ...over,
});

beforeEach(() => {
  fs.clear();
  pkg.files = new Map([
    ['scenes/intro/scene.json', serializeScene(introScene)],
    ['scenes/intro/src/index.html', '<html>intro</html>'],
    ['scenes/page/scene.json', serializeScene(pageScene)],
    ['scenes/page/src/index.html', '<html>page</html>'],
    ['sequence.json', serializeSequence(pkgSeq)],
  ]);
  pkg.failExtractFor = null;
  pkg.nextId = 1;
  fs.set('sequence.json', serializeSequence(newSequence(WS.id)));
});

describe('scenesInPackage / remapEdges', () => {
  it('lists the scene folders', () => {
    expect(scenesInPackage(info())).toEqual(['intro', 'page']);
    expect(scenesInPackage(info({ kind: 'scene', scene: 'intro', files: ['scenes/intro/scene.json', 'scenes/intro/src/a.ts'] }))).toEqual(['intro']);
  });

  it('keeps only edges between imported scenes and maps their ids', () => {
    const both = remapEdges(pkgSeq, new Map([['scn_origIntro', 'scn_a'], ['scn_origPage', 'scn_b']]));
    expect(both).toEqual([{ from: 'scn_a', to: 'scn_b', trigger: 'end', transition: tr }]);
    expect(remapEdges(pkgSeq, new Map([['scn_origIntro', 'scn_a']]))).toEqual([]);
  });
});

describe('importScenes', () => {
  it('copies a scene into a new folder with a new id, the current workspaceId and regenerated guides', async () => {
    const r = await importScenes('/w', WS, '/p.vsx', info(), ['intro'], deps());
    expect(r.failed).toEqual([]);
    expect(r.imported).toHaveLength(1);
    const got = r.imported[0];
    expect(got).toMatchObject({ sourceSlug: 'intro', slug: 'intro', sceneId: 'scn_new1', templateUnavailable: false });
    const scene = parseScene(fs.get('scenes/intro/scene.json')!);
    expect(scene.id).toBe('scn_new1'); // not the package's scn_origIntro
    expect(scene.name).toBe('Intro');
    expect(fs.get('scenes/intro/src/index.html')).toBe('<html>intro</html>'); // sources preserved
    expect(fs.get('scenes/intro/AGENTS.md')).toContain('workspaceId: ws_mine'); // regenerated for this workspace (D-029)
    expect(fs.get('scenes/intro/AGENTS.md')).not.toContain('ws_theirs');
    expect(fs.get('scenes/intro/GUIDE.md')).toBeTruthy();
    const seq = parseSequence(fs.get('sequence.json')!);
    expect(seq.nodes.map((n) => n.sceneId)).toEqual(['scn_new1']);
    expect(seq.start).toBe('scn_new1');
    expect(seq.edges).toEqual([]); // only one scene: edges are not imported
  });

  it('importing every scene of a sequence package also brings the edges and the start scene', async () => {
    const r = await importScenes('/w', WS, '/p.vsx', info(), ['intro', 'page'], deps());
    expect(r.imported.map((i) => i.slug)).toEqual(['intro', 'page']);
    expect(r.edgesAdded).toBe(1);
    const seq = parseSequence(fs.get('sequence.json')!);
    expect(seq.edges).toEqual([{ from: 'scn_new1', to: 'scn_new2', trigger: 'end', transition: tr }]);
    expect(seq.start).toBe('scn_new1');
    expect(seq.mode).toBe('linear'); // the receiving workspace keeps its own mode
  });

  it('never overwrites an existing scene: name collisions get a new folder', async () => {
    fs.set('scenes/intro/scene.json', serializeScene(newScene({ id: 'scn_mine', name: 'Mine', type: 'motion', template: 'commercial@1' })));
    const r = await importScenes('/w', WS, '/p.vsx', info(), ['intro'], deps());
    expect(r.imported[0].slug).toBe('intro-2');
    expect(parseScene(fs.get('scenes/intro/scene.json')!).id).toBe('scn_mine'); // untouched
    expect(parseScene(fs.get('scenes/intro-2/scene.json')!).id).toBe('scn_new1');
  });

  it('a scene that fails to extract is cleaned up and the others still import', async () => {
    pkg.failExtractFor = 'intro';
    const r = await importScenes('/w', WS, '/p.vsx', info(), ['intro', 'page'], deps());
    expect(r.failed).toEqual([{ sourceSlug: 'intro', error: 'hash-mismatch: x' }]);
    expect(r.imported.map((i) => i.slug)).toEqual(['page']);
    expect([...fs.keys()].some((k) => k.startsWith('scenes/intro/'))).toBe(false); // no half-imported folder
    expect(r.edgesAdded).toBe(0); // not all scenes came across
    expect(parseSequence(fs.get('sequence.json')!).nodes).toHaveLength(1);
  });

  it('an invalid scene.json in the package is a failure for that scene only', async () => {
    pkg.files.set('scenes/intro/scene.json', '{ "broken": true }');
    const r = await importScenes('/w', WS, '/p.vsx', info(), ['intro', 'page'], deps());
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].sourceSlug).toBe('intro');
    expect(r.imported).toHaveLength(1);
  });

  it('bundled templates are imported first and the resolver is refreshed afterwards', async () => {
    const order: string[] = [];
    const d = deps({
      importTemplates: async () => {
        order.push('templates');
        return { imported: ['guide-templates/mine@1'], skipped: [] };
      },
      resolverAfterTemplates: async () => {
        order.push('resolver');
        return builtinResolver;
      },
    });
    const r = await importScenes('/w', WS, '/p.vsx', info({ templates: ['guide-templates/mine@1'] }), ['page'], d);
    expect(order).toEqual(['templates', 'resolver']);
    expect(r.templates.imported).toEqual(['guide-templates/mine@1']);
  });

  it('a scene whose template cannot be used still imports, flagged, without generated guides', async () => {
    const d = deps({ resolverAfterTemplates: async () => () => null });
    const r = await importScenes('/w', WS, '/p.vsx', info(), ['intro'], d);
    expect(r.imported[0].templateUnavailable).toBe(true);
    expect(fs.get('scenes/intro/scene.json')).toBeTruthy();
    expect(fs.get('scenes/intro/AGENTS.md')).toBeUndefined();
  });

  it('ignores slugs the package does not contain', async () => {
    const r = await importScenes('/w', WS, '/p.vsx', info(), ['ghost'], deps());
    expect(r.imported).toEqual([]);
    expect(r.failed).toEqual([]);
    expect(parseSequence(fs.get('sequence.json')!).nodes).toEqual([]);
  });
});
