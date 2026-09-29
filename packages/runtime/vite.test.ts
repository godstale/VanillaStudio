import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedConfig } from 'vite';
import { loadDesign, vanillaDesign } from './vite';

const sample = readFileSync(path.resolve(__dirname, '../../src/lib/design/__fixtures__/DESIGN.md'), 'utf8');
const RESOLVED = '\0virtual:vanilla/design';

describe('loadDesign', () => {
  it('serves resolved tokens with a content hash', () => {
    const r = loadDesign(sample, null);
    expect(r.stale).toBe(false);
    expect(r.design?.colors.canvas).toBe('#E9E5DB');
    expect(r.design?.colors['on-primary']).toBeTruthy();
    expect(r.design?.rounded.md).toBe('12px');
    expect(r.design?.typography.display.fontFamily).toBe('Georgia');
    expect(loadDesign(sample, null).design?.hash).toBe(r.design?.hash);
    expect(loadDesign(sample.replace('#E9E5DB', '#E9E5DC'), null).design?.hash).not.toBe(r.design?.hash);
  });

  it('keeps the last good tokens when the file is broken or mid-edit', () => {
    const good = loadDesign(sample, null).design;
    const broken = loadDesign(sample.replace('canvas: "#E9E5DB"', 'canvas: "not-a-color"'), good);
    expect(broken.stale).toBe(true);
    expect(broken.design).toBe(good);
    const prose = loadDesign('# just prose', good);
    expect(prose.stale).toBe(true);
    expect(loadDesign('---\ncolors: [', good).design).toBe(good);
  });

  it('has nothing to serve when the very first read is broken', () => {
    expect(loadDesign('# just prose', null)).toMatchObject({ design: null, stale: false });
  });
});

describe('vanillaDesign plugin', () => {
  function setup(command: 'serve' | 'build' = 'serve') {
    const dir = mkdtempSync(path.join(tmpdir(), 'vanilla-design-'));
    const file = path.join(dir, 'DESIGN.md');
    writeFileSync(file, sample);
    const plugin = vanillaDesign();
    (plugin.configResolved as (c: ResolvedConfig) => void)({ root: dir, command } as ResolvedConfig);
    const ctx = { addWatchFile: vi.fn(), warn: vi.fn(), error: vi.fn((m: string) => { throw new Error(m); }) };
    const load = () => (plugin.load as unknown as (this: typeof ctx, id: string) => string | undefined).call(ctx, RESOLVED);
    return { plugin, ctx, file, dir, load };
  }

  it('resolves and loads the virtual module and watches the file', () => {
    const { plugin, ctx, file, load } = setup();
    expect((plugin.resolveId as (id: string) => string | undefined)('virtual:vanilla/design')).toBe(RESOLVED);
    expect((plugin.resolveId as (id: string) => string | undefined)('other')).toBeUndefined();
    const code = load()!;
    expect(code.startsWith('export default {')).toBe(true);
    expect(JSON.parse(code.slice('export default '.length, -1)).colors.primary).toBe('#F1EE2E');
    expect(ctx.addWatchFile).toHaveBeenCalledWith(file);
    expect(ctx.warn).not.toHaveBeenCalled();
  });

  it('reserves last good tokens and warns when the file breaks; build fails when there are none', () => {
    const { ctx, file, load } = setup();
    load();
    writeFileSync(file, '# oops');
    const code = load()!;
    expect(JSON.parse(code.slice('export default '.length, -1)).colors.primary).toBe('#F1EE2E');
    expect(ctx.warn).toHaveBeenCalledOnce();

    const b = setup('build');
    writeFileSync(b.file, '# oops');
    expect(() => b.load()).toThrow(/DESIGN\.md/);
  });

  it('invalidates the virtual module when DESIGN.md changes and ignores other files', () => {
    const { plugin, file, dir } = setup();
    const mod = { id: RESOLVED };
    const server = { moduleGraph: { getModuleById: vi.fn(() => mod), invalidateModule: vi.fn() } };
    const hot = plugin.handleHotUpdate as (c: { file: string; server: unknown }) => unknown;
    expect(hot({ file: path.join(dir, 'src', 'a.ts'), server })).toBeUndefined();
    expect(hot({ file, server })).toEqual([mod]);
    expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(mod);
  });
});
