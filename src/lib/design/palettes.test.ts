import { describe, expect, it, vi, beforeEach } from 'vitest';
import { contrastReport } from './roles';
import {
  BUILT_IN_PALETTES,
  getPalette,
  listProjectPalettes,
  paletteDesignColors,
  parsePaletteFile,
  saveProjectPalette,
  searchPalettes,
} from './palettes';

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
    throw new Error(`unexpected command ${cmd}`);
  },
}));

const ROOT = 'C:/proj';
const VALID = {
  version: 1,
  id: 'paper-dawn',
  name: 'Paper Dawn',
  tags: ['editorial'],
  scheme: 'light',
  colors: { canvas: '#FAF6EC', ink: '#1F2A5A', primary: '#8E4394', accent: '#F2C230' },
  source: 'builtin',
  license: 'CC0-1.0',
};

describe('parsePaletteFile', () => {
  it('accepts the spec example shape', () => {
    const r = parsePaletteFile(VALID);
    expect(r.ok).toBe(true);
  });

  it('rejects missing core roles and bad colors', () => {
    const missing = parsePaletteFile({ ...VALID, colors: { canvas: '#FFFFFF' } });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain('missing core role');
    const bad = parsePaletteFile({ ...VALID, colors: { ...VALID.colors, ink: 'not-a-color' } });
    expect(bad.ok).toBe(false);
  });

  it('rejects bad ids and versions', () => {
    expect(parsePaletteFile({ ...VALID, id: 'Not A Slug' }).ok).toBe(false);
    expect(parsePaletteFile({ ...VALID, version: 2 }).ok).toBe(false);
  });
});

describe('built-ins', () => {
  it('ships the full 32-palette set (24 core + 8 Opus), balanced across schemes', () => {
    expect(BUILT_IN_PALETTES.length).toBe(32);
    expect(BUILT_IN_PALETTES.filter((p) => p.scheme === 'light')).toHaveLength(16);
    expect(BUILT_IN_PALETTES.filter((p) => p.scheme === 'dark')).toHaveLength(16);
    expect(BUILT_IN_PALETTES.filter((p) => p.tags.includes('opus'))).toHaveLength(8);
    const ids = BUILT_IN_PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Legacy D2 palettes keep their original tags; new palettes carry a scheme tag.
    const legacy = new Set(['ember-night', 'forest-mist', 'midnight-rampart', 'paper-dawn']);
    for (const p of BUILT_IN_PALETTES) {
      expect(p.tags.length).toBeGreaterThan(0);
      if (!legacy.has(p.id)) {
        expect(p.tags.map((t) => t.toLowerCase())).toContain(p.scheme);
      }
      expect(p.source).toBe('builtin');
    }
  });

  it('loads at least one palette per scheme', () => {
    expect(BUILT_IN_PALETTES.length).toBeGreaterThan(0);
    expect(BUILT_IN_PALETTES.some((p) => p.scheme === 'light')).toBe(true);
    expect(BUILT_IN_PALETTES.some((p) => p.scheme === 'dark')).toBe(true);
  });

  it('every built-in passes the WCAG contrast pairs (F-PAL-04)', () => {
    for (const p of BUILT_IN_PALETTES) {
      const failing = contrastReport(paletteDesignColors(p)).filter((r) => !r.ok);
      expect(failing).toEqual([]);
    }
  });
});

describe('searchPalettes', () => {
  it('matches id, name and tags; filters by scheme', () => {
    expect(searchPalettes(BUILT_IN_PALETTES, 'rampart')).toHaveLength(1);
    expect(searchPalettes(BUILT_IN_PALETTES, 'DARK').every((p) => p.scheme === 'dark')).toBe(true);
    expect(searchPalettes(BUILT_IN_PALETTES, '', { scheme: 'light' }).every((p) => p.scheme === 'light')).toBe(true);
    expect(searchPalettes(BUILT_IN_PALETTES, 'no-such-palette')).toHaveLength(0);
    expect(searchPalettes(BUILT_IN_PALETTES, '', { tags: ['warm'] }).length).toBeGreaterThan(0);
  });

  it('getPalette finds by id', () => {
    expect(getPalette(BUILT_IN_PALETTES, 'paper-dawn')?.name).toBe('Paper Dawn');
    expect(getPalette(BUILT_IN_PALETTES, 'missing')).toBeNull();
  });
});

describe('project palettes', () => {
  beforeEach(() => {
    mocks.files.clear();
  });

  it('returns [] without a palettes folder and skips broken files', async () => {
    expect(await listProjectPalettes(ROOT)).toEqual([]);
    mocks.files.set(`${ROOT}/palettes/ok.json`, JSON.stringify(VALID));
    mocks.files.set(`${ROOT}/palettes/broken.json`, '{nope');
    const list = await listProjectPalettes(ROOT);
    expect(list.map((p) => p.id)).toEqual(['paper-dawn']);
  });

  it('saves as a user palette and reads it back', async () => {
    const parsed = parsePaletteFile(VALID);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await saveProjectPalette(ROOT, parsed.palette);
    const list = await listProjectPalettes(ROOT);
    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe('user');
  });
});
