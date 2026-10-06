import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as { cmd: string; args: Record<string, unknown> }[]);
const replies = vi.hoisted(() => new Map<string, unknown>());
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    calls.push({ cmd, args });
    if (!replies.has(cmd)) throw new Error(`no reply for ${cmd}`);
    const r = replies.get(cmd);
    if (r instanceof Error) throw r;
    return r;
  },
}));

import { createPackage, importScene, importWorkspace, inspectPackage, packageErrorKey } from './api';
import { manifestSchema, packageInfoSchema, schemaCompatibility, usedTemplateDirs } from './manifest';

const sha = 'a'.repeat(64);
const manifest = (over: Record<string, unknown> = {}) => ({
  formatVersion: 1,
  kind: 'sequence',
  app: { name: 'vanilla-studio', version: '0.1.0' },
  schemas: { workspace: 1, scene: 1, sequence: 1 },
  workspace: { id: 'ws_a', name: 'Demo' },
  scene: null,
  templates: [],
  files: [{ path: 'workspace.json', size: 10, sha256: sha }],
  ...over,
});

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

describe('shared golden manifest (same file the Rust test round-trips)', () => {
  it('parses with the TS schema', () => {
    const golden = JSON.parse(readFileSync(resolve(__dirname, '../../../tests/fixtures/manifest.sample.json'), 'utf8'));
    expect(manifestSchema.parse(golden).scene).toBe('intro');
  });
});

describe('manifest schema', () => {
  it('accepts what Rust writes', () => {
    expect(manifestSchema.safeParse(manifest()).success).toBe(true);
    expect(manifestSchema.safeParse(manifest({ kind: 'scene', scene: 'intro', templates: ['guide-templates/mine@1'] })).success).toBe(true);
  });

  it('rejects wrong versions, unsafe paths, duplicates and inconsistent scene fields', () => {
    expect(manifestSchema.safeParse(manifest({ formatVersion: 2 })).success).toBe(false);
    for (const path of ['../x', '/abs', 'a\\b', 'C:/x', 'a//b', '']) {
      expect(manifestSchema.safeParse(manifest({ files: [{ path, size: 1, sha256: sha }] })).success, path).toBe(false);
    }
    expect(manifestSchema.safeParse(manifest({ files: [{ path: 'a', size: 1, sha256: 'xyz' }] })).success).toBe(false);
    expect(manifestSchema.safeParse(manifest({ files: [{ path: 'a', size: 1, sha256: sha }, { path: 'a', size: 1, sha256: sha }] })).success).toBe(false);
    expect(manifestSchema.safeParse(manifest({ kind: 'scene', scene: null })).success).toBe(false);
    expect(manifestSchema.safeParse(manifest({ kind: 'sequence', scene: 'x' })).success).toBe(false);
    expect(manifestSchema.safeParse(manifest({ templates: ['elsewhere/mine'] })).success).toBe(false);
    expect(manifestSchema.safeParse({ ...manifest(), extra: 1 }).success).toBe(false);
  });

  it('schema compatibility names the first mismatching schema', () => {
    expect(schemaCompatibility(manifestSchema.parse(manifest()))).toEqual({ ok: true });
    const newer = manifestSchema.parse(manifest({ schemas: { workspace: 1, scene: 2, sequence: 1 } }));
    expect(schemaCompatibility(newer)).toMatchObject({ ok: false, reason: expect.stringContaining('scene schema 2') });
  });
});

describe('usedTemplateDirs', () => {
  it('only user templates are bundled; templates outside the workspace are reported missing', () => {
    const scenes = [{ template: 'commercial@1' }, { template: 'mine@1' }, { template: 'mine@1' }, { template: 'global@2' }];
    const r = usedTemplateDirs(scenes, (d) => d === 'guide-templates/mine@1');
    expect(r).toEqual({ dirs: ['guide-templates/mine@1'], missing: ['guide-templates/global@2'] });
    expect(usedTemplateDirs([{ template: 'commercial@1' }], () => false)).toEqual({ dirs: [], missing: [] });
  });
});

describe('api', () => {
  it('createPackage sends only paths and options, and validates the reply', async () => {
    replies.set('create_vsx', { path: 'D:/out.vsx', files: 1, bytes: 10, manifest: manifest() });
    const r = await createPackage('/w', 'D:/out.vsx', { scene: 'intro', templateDirs: ['guide-templates/mine@1'] });
    expect(r.files).toBe(1);
    expect(calls[0]).toEqual({ cmd: 'create_vsx', args: { workspaceRoot: '/w', outPath: 'D:/out.vsx', options: { scene: 'intro', includeReferenceMedia: false, templateDirs: ['guide-templates/mine@1'] } } });
    replies.set('create_vsx', { path: 'x', files: 1, bytes: 1, manifest: manifest({ formatVersion: 9 }) });
    await expect(createPackage('/w', 'x.vsx')).rejects.toThrow();
  });

  it('inspectPackage validates what Rust returns and passes errors through', async () => {
    replies.set('inspect_vsx', { manifest: manifest(), reviewFiles: ['AGENTS.md'], totalBytes: 10 });
    expect(packageInfoSchema.parse(await inspectPackage('p.vsx')).reviewFiles).toEqual(['AGENTS.md']);
    replies.set('inspect_vsx', new Error('hash-mismatch: a.txt'));
    await expect(inspectPackage('p.vsx')).rejects.toThrow('hash-mismatch');
    replies.set('inspect_vsx', { manifest: { nope: true }, reviewFiles: [], totalBytes: 0 });
    await expect(inspectPackage('p.vsx')).rejects.toThrow();
  });

  it('import commands pass ids and slugs only', async () => {
    replies.set('extract_vsx_scene', ['scene.json']);
    replies.set('extract_vsx_workspace', ['workspace.json']);
    expect(await importScene('/w', 'p.vsx', 'intro', 'intro-2')).toEqual(['scene.json']);
    expect(calls[0].args).toEqual({ workspaceRoot: '/w', path: 'p.vsx', sourceSlug: 'intro', targetSlug: 'intro-2' });
    expect(await importWorkspace('p.vsx', 'D:/new')).toEqual(['workspace.json']);
    expect(calls[1].args).toEqual({ path: 'p.vsx', destDir: 'D:/new' });
  });

  it('maps rejection codes to messages', () => {
    expect(packageErrorKey('unsafe-entry-name: absolute path: "/x"')).toBe('package.err.unsafe');
    expect(packageErrorKey('hash-mismatch: a.txt')).toBe('package.err.tampered');
    expect(packageErrorKey('symlink-entry: x')).toBe('package.err.unsafe');
    expect(packageErrorKey('scene-exists')).toBe('package.err.sceneExists');
    expect(packageErrorKey('boom')).toBeNull();
  });
});
