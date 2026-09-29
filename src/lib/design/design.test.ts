import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitFrontMatter } from './frontmatter';
import { parseDesign } from './parse';
import { replaceColors } from './rewrite';
import { contrastReport, deriveRoles } from './roles';
import { hfToVanilla, type HfPalette } from './hyperframes';

const sample = readFileSync(path.resolve(__dirname, '__fixtures__/DESIGN.md'), 'utf8');

describe('parse', () => {
  it('reads tokens and resolves component references', () => {
    const d = parseDesign(sample);
    expect(d.issues).toEqual([]);
    expect(d.colors.canvas).toBe('#E9E5DB');
    expect(d.tokens.components.badge.backgroundColor).toBe('#F1EE2E');
    expect(d.tokens.components.badge.rounded).toBe('12px');
  });

  it('reports broken and circular references', () => {
    const text = sample.replace('"{colors.ink}"', '"{colors.nope}"').replace('  line: "#B9B3A3"', '  line: "{colors.line}"');
    const d = parseDesign(text);
    expect(d.issues.some((i) => i.startsWith('broken reference'))).toBe(true);
    expect(d.issues.some((i) => i.startsWith('circular reference'))).toBe(true);
  });

  it('flags a prose-only DESIGN.md', () => {
    const d = parseDesign('# Brand\n\nOnly prose, no tokens.\n');
    expect(d.issues[0]).toMatch(/no YAML front matter/);
  });
});

describe('replaceColors', () => {
  const next = { canvas: '#0A0A14', surface: '#1A1A2A', ink: '#E8E8F0', 'ink-muted': '#9A9AB0', primary: '#A855F7', secondary: '#4A4A6A', accent: '#22D3EE', line: '#33334A' };

  it('changes only the colors block; body and other front matter are byte-identical', () => {
    const out = replaceColors(sample, next).text;
    const a = splitFrontMatter(sample);
    const b = splitFrontMatter(out);
    expect(b.body).toBe(a.body);
    const strip = (y: string) => y.replace(/colors:\n(?: {2}.*\n)+/, '');
    expect(strip(b.yaml)).toBe(strip(a.yaml));
    expect(parseDesign(out).colors.primary).toBe('#A855F7');
  });

  it('round-trips: applying the original palette restores the file exactly', () => {
    const original = parseDesign(sample).tokens.colors;
    const there = replaceColors(sample, next, { updateProse: true }).text;
    const back = replaceColors(there, original, { updateProse: true }).text;
    expect(back).toBe(sample);
  });

  it('optionally updates hex values quoted in the prose', () => {
    const r = replaceColors(sample, next, { updateProse: true });
    expect(r.bodyReplacements).toBe(3);
    expect(r.text).toContain('**Canvas (#0A0A14):**');
  });

  it('keeps CRLF files CRLF', () => {
    const crlf = sample.replace(/\n/g, '\r\n');
    const out = replaceColors(crlf, next).text;
    expect(out.includes('\n') && !/[^\r]\n/.test(out)).toBe(true);
  });

  it('adds front matter to a prose-only file without changing the prose', () => {
    const prose = '# Brand\n\nSome text.\n';
    const out = replaceColors(prose, next).text;
    expect(splitFrontMatter(out).body).toBe(prose);
  });
});

describe('roles', () => {
  it('derives missing roles from the four core roles', () => {
    const c = deriveRoles({ canvas: '#FFFFFF', ink: '#111111', primary: '#1E2BFA', accent: '#F59E0B' });
    expect(Object.keys(c).sort()).toEqual(['accent', 'canvas', 'ink', 'ink-muted', 'line', 'on-primary', 'primary', 'secondary', 'surface']);
    expect(c['on-primary']).toBe('#FFFFFF');
  });

  it('reports contrast for the readable pairs', () => {
    const report = contrastReport(deriveRoles({ canvas: '#FFFFFF', ink: '#111111', primary: '#1E2BFA', accent: '#F59E0B' }));
    expect(report.every((r) => r.ok)).toBe(true);
  });

  it('maps a HyperFrames-style palette onto Vanilla roles by luminance', () => {
    const p: HfPalette = { id: 'sample-dark', name: 'Sample', tokens: { primary: '#F5F5F5', secondary: '#101018', tertiary: '#888899', accent: '#FF5500' }, extras: {} };
    const colors = deriveRoles(hfToVanilla(p));
    expect(colors.canvas).toBe('#101018');
    expect(colors.ink).toBe('#F5F5F5');
    expect(contrastReport(colors).find((r) => r.pair === 'ink/canvas')!.ratio).toBeGreaterThan(3);
  });
});
