import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as { cmd: string; args: Record<string, unknown> }[]);
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    calls.push({ cmd, args });
  },
}));

import { newScene, sceneSchema } from './schema';
import {
  addFileReference,
  addUrlReference,
  kindOfFile,
  nextReferenceId,
  normalizeReferenceUrl,
  referencesFileSchema,
  removeReference,
  safeFileName,
  serializeReferences,
  updateReferenceNote,
  writeReferencesMirror,
} from './references';

const scene = newScene({ id: 'scn_A', name: 'Intro', type: 'motion', template: 'commercial@1' });

describe('references', () => {
  it('infers the kind from the extension', () => {
    expect(kindOfFile('C:\\a\\Look.PNG')).toBe('image');
    expect(kindOfFile('/x/ad.mp4')).toBe('video');
    expect(kindOfFile('notes.pdf')).toBeNull();
    expect(kindOfFile('noext')).toBeNull();
  });

  it('makes safe file names and keeps the extension', () => {
    expect(safeFileName('C:\\Users\\me\\My Cool Ad (v2).MP4')).toBe('My-Cool-Ad-v2.mp4');
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('한글 이름.jpg')).toBe('한글-이름.jpg');
    expect(safeFileName('...png')).toBe('reference.png');
  });

  it('allocates the smallest free id', () => {
    const a = addUrlReference(scene, 'https://example.com/a');
    const b = addUrlReference(a, 'https://example.com/b');
    expect(b.references.map((r) => r.id)).toEqual(['ref-1', 'ref-2']);
    expect(nextReferenceId(removeReference(b, 'ref-1').references)).toBe('ref-1');
  });

  it('accepts only plain http(s) URLs', () => {
    expect(normalizeReferenceUrl(' https://example.com/x?y=1 ')).toBe('https://example.com/x?y=1');
    for (const bad of ['javascript:alert(1)', 'file:///c:/x', 'ftp://a.b/c', 'https://user:pw@a.b/', 'not a url', '']) expect(normalizeReferenceUrl(bad)).toBeNull();
    expect(() => addUrlReference(scene, 'javascript:alert(1)')).toThrow('invalid-url');
  });

  it('copies a file into the scene references folder and registers it', async () => {
    calls.length = 0;
    const next = await addFileReference('/w', 'intro', scene, 'D:\\Downloads\\Ad Look.mp4', 'pacing');
    expect(calls).toEqual([{ cmd: 'import_external_file', args: { source: 'D:\\Downloads\\Ad Look.mp4', dest: '/w/scenes/intro/references/ref-1-Ad-Look.mp4', workspaceRoot: '/w' } }]);
    expect(next.references).toEqual([{ id: 'ref-1', kind: 'video', path: 'references/ref-1-Ad-Look.mp4', url: null, note: 'pacing', analysis: null }]);
    expect(sceneSchema.safeParse(next).success).toBe(true);
  });

  it('rejects unsupported files without copying', async () => {
    calls.length = 0;
    await expect(addFileReference('/w', 'intro', scene, 'D:\\a.exe')).rejects.toThrow('unsupported-file');
    expect(calls).toEqual([]);
  });

  it('updates notes and removes entries (scene stays valid)', () => {
    const a = addUrlReference(scene, 'https://example.com/a');
    const b = updateReferenceNote(a, 'ref-1', 'color only');
    expect(b.references[0].note).toBe('color only');
    expect(removeReference(b, 'ref-1').references).toEqual([]);
  });

  it('mirror file is deterministic and matches its schema', async () => {
    const a = addUrlReference(scene, 'https://example.com/a', 'n');
    const text = serializeReferences(a.references);
    expect(text).toBe(serializeReferences(a.references));
    expect(referencesFileSchema.parse(JSON.parse(text)).references).toHaveLength(1);
    calls.length = 0;
    await writeReferencesMirror('/w', 'intro', a.references);
    expect(calls[0]).toMatchObject({ cmd: 'write_text_file', args: { path: '/w/scenes/intro/references/references.json', workspaceRoot: '/w' } });
  });
});
