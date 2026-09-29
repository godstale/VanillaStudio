import { afterEach, describe, expect, it, vi } from 'vitest';
import { designToDtcgJson, designToTailwindCss, downloadTextFile, validateDesignImport } from './designIo';

const DESIGN = `---
colors:
  canvas: "#FFFFFF"
  ink: "#111111"
  primary: "#1E2BFA"
  accent: "#F59E0B"
---
# Brand
`;

describe('designIo', () => {
  it('validates an importable DESIGN.md', () => {
    const r = validateDesignImport(DESIGN);
    expect(r.ok).toBe(true);
    expect(r.colorCount).toBeGreaterThan(3);
  });

  it('rejects prose-only and color-less input', () => {
    expect(validateDesignImport('# Just prose').ok).toBe(false);
    expect(validateDesignImport('---\ntypography: {}\n---\n').error).toBe('no-colors');
  });

  it('rejects invalid colors', () => {
    const r = validateDesignImport('---\ncolors:\n  canvas: "not-a-color"\n---\n');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('invalid color');
  });

  it('converts colors to Tailwind and DTCG', () => {
    expect(designToTailwindCss({ ink: '#111111', canvas: '#FFFFFF' })).toBe(
      ':root {\n  --color-canvas: #FFFFFF;\n  --color-ink: #111111;\n}\n',
    );
    expect(JSON.parse(designToDtcgJson({ ink: '#111111' }))).toEqual({
      color: { ink: { $value: '#111111', $type: 'color' } },
    });
  });

  it('downloads through an anchor', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    try {
      downloadTextFile('tokens.css', ':root {}', 'text/css');
      expect(create).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith('blob:x');
    } finally {
      create.mockRestore();
      revoke.mockRestore();
      click.mockRestore();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
