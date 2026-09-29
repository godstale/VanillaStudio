import { describe, expect, it } from 'vitest';
import { parsePalette, PALETTE_VERSION } from './palette';

const valid = {
  version: PALETTE_VERSION,
  id: 'biennale-yellow',
  name: 'Biennale Yellow',
  tags: ['editorial', 'warm'],
  scheme: 'light',
  colors: {
    canvas: '#F4EEDF',
    ink: '#1F2A5A',
    primary: '#1F2A5A',
    accent: '#F2C230',
    surface: '#FFFFFF',
  },
  source: 'builtin',
  license: 'CC0-1.0',
};

describe('parsePalette', () => {
  it('accepts a valid palette.json', () => {
    const r = parsePalette(JSON.stringify(valid));
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    if (r.ok) expect(r.palette.scheme).toBe('light');
  });

  it('accepts functional color notations, not just hex', () => {
    const r = parsePalette(
      JSON.stringify({ ...valid, colors: { ...valid.colors, accent: 'oklch(0.85 0.15 90)' } }),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects a missing core role', () => {
    const { accent, ...colors } = valid.colors;
    void accent;
    const r = parsePalette(JSON.stringify({ ...valid, colors }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch('colors.accent');
  });

  it('rejects invalid colors, scheme, source, id', () => {
    expect(parsePalette(JSON.stringify({ ...valid, colors: { ...valid.colors, ink: 'nope' } })).ok).toBe(
      false,
    );
    expect(parsePalette(JSON.stringify({ ...valid, scheme: 'sepia' })).ok).toBe(false);
    expect(parsePalette(JSON.stringify({ ...valid, source: 'store' })).ok).toBe(false);
    expect(parsePalette(JSON.stringify({ ...valid, id: 'Bad' })).ok).toBe(false);
  });

  it('rejects invalid JSON and wrong version', () => {
    expect(parsePalette('{oops').ok).toBe(false);
    expect(parsePalette(JSON.stringify({ ...valid, version: 2 })).ok).toBe(false);
  });
});
