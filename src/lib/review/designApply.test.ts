import { describe, expect, it, vi, beforeEach } from 'vitest';
import { applyPalette, resolvePaletteColors, updateManifestPalette } from './designApply';

const mocks = vi.hoisted(() => ({ files: new Map<string, string>() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, string>) => {
    if (cmd === 'list_dir') {
      const dir = (args.path as string).replace(/\/$/, '');
      const entries = [...mocks.files.keys()]
        .filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'))
        .map((p) => ({ name: p.slice(dir.length + 1), path: p, is_dir: false, size: 0 }));
      if (entries.length === 0) throw new Error('not found');
      return entries;
    }
    if (cmd === 'read_text_file') {
      const text = mocks.files.get(args.path as string);
      if (text === undefined) throw new Error('missing');
      return text;
    }
    if (cmd === 'write_text_file') {
      mocks.files.set(args.path as string, (args as unknown as { contents: string }).contents);
      return null;
    }
    if (cmd === 'checkpoint_commit') return { id: 'abc123', backend: 'git' };
    throw new Error(`unexpected command ${cmd}`);
  },
}));

const ROOT = 'C:/proj';
const DESIGN = `---
colors:
  canvas: "#FFFFFF"
  ink: "#111111"
  primary: "#1E2BFA"
  accent: "#F59E0B"
---
# Brand

Canvas (#FFFFFF) and ink (#111111).
`;
const MANIFEST = JSON.stringify({
  version: 1,
  name: 'Demo',
  outputType: 'video',
  format: { width: 1920, height: 1080, fps: 30, durationSec: 10 },
  template: null,
  palette: { id: 'default', source: 'builtin' },
  agents: { default: 'claude-code', enabled: ['claude-code'] },
  runtime: { version: '0.1.0' },
  createdAt: '2026-09-29T00:00:00.000Z',
});
const PALETTE = {
  id: 'paper-dawn',
  name: 'Paper Dawn',
  source: 'builtin' as const,
  colors: { canvas: '#FAF6EC', ink: '#1F2A5A', primary: '#8E4394', accent: '#F2C230' },
};

describe('resolvePaletteColors', () => {
  it('fills derived roles from the four core roles', () => {
    expect(Object.keys(resolvePaletteColors(PALETTE.colors)).sort()).toEqual(
      expect.arrayContaining(['surface', 'ink-muted', 'line', 'on-primary']),
    );
  });

  it('falls back to raw colors when core roles are missing', () => {
    expect(resolvePaletteColors({ canvas: '#FFFFFF' })).toEqual({ canvas: '#FFFFFF' });
  });
});

describe('applyPalette', () => {
  beforeEach(() => {
    mocks.files.clear();
    mocks.files.set(`${ROOT}/DESIGN.md`, DESIGN);
    mocks.files.set(`${ROOT}/vanilla.json`, MANIFEST);
  });

  it('rewrites colors, updates prose + manifest, and checkpoints', async () => {
    const r = await applyPalette(ROOT, PALETTE);
    expect(r.checkpointId).toBe('abc123');
    expect(r.manifestUpdated).toBe(true);
    const design = mocks.files.get(`${ROOT}/DESIGN.md`) ?? '';
    expect(design).toContain('canvas: "#FAF6EC"');
    // Prose hex follows the new value; the rest of the body is untouched.
    expect(design).toContain('Canvas (#FAF6EC)');
    expect(design).toContain('# Brand');
    const manifest = JSON.parse(mocks.files.get(`${ROOT}/vanilla.json`) ?? '{}') as { palette: unknown };
    expect(manifest.palette).toEqual({ id: 'paper-dawn', source: 'builtin' });
  });

  it('still applies when the manifest is missing', async () => {
    mocks.files.delete(`${ROOT}/vanilla.json`);
    const r = await applyPalette(ROOT, PALETTE);
    expect(r.manifestUpdated).toBe(false);
    expect(mocks.files.get(`${ROOT}/DESIGN.md`) ?? '').toContain('canvas: "#FAF6EC"');
  });

  it('throws when DESIGN.md is missing', async () => {
    mocks.files.delete(`${ROOT}/DESIGN.md`);
    await expect(applyPalette(ROOT, PALETTE)).rejects.toThrow('DESIGN.md not found');
  });
});

describe('updateManifestPalette', () => {
  beforeEach(() => {
    mocks.files.clear();
    mocks.files.set(`${ROOT}/vanilla.json`, MANIFEST);
  });

  it('skips non-slug ids and invalid manifests', async () => {
    expect(await updateManifestPalette(ROOT, { id: 'Not A Slug!', source: 'user' })).toBe(false);
    mocks.files.set(`${ROOT}/vanilla.json`, '{broken');
    expect(await updateManifestPalette(ROOT, { id: 'ok-id', source: 'user' })).toBe(false);
  });
});
