import { describe, expect, it } from 'vitest';
import { outsideMarkers } from '@/lib/guides/markers';
import { readMood, writeMood } from './mood';
import { BUILT_IN_PALETTES } from './palettes';
import { parseDesign } from './parse';
import { applyPalette } from './workspaceDesign';

const TRAILING = '  '; // markdown line break: two trailing spaces must survive
const DESIGN = `---
version: alpha
name: Test
colors:
  canvas: "#FAF7F0"
  ink: "#1F2430"
  primary: "#E8A93B"
  accent: "#C8553D"
typography:
  body:
    fontFamily: Arial
    fontSize: 24px
---

# Test design

The primary color is #E8A93B and the canvas is #FAF7F0.

Hand-written rule: keep the logo clear.${TRAILING}
`;

describe('mood section', () => {
  it('reads nothing from a design without the section', () => {
    expect(readMood(DESIGN)).toEqual([]);
  });

  it('writes the section and keeps every other byte', () => {
    const next = writeMood(DESIGN, ['warm', ' confident ', '']);
    expect(readMood(next)).toEqual(['warm', 'confident']);
    expect(next.startsWith(DESIGN.trimEnd())).toBe(true);
    expect(outsideMarkers(next).trimEnd()).toBe(DESIGN.trimEnd());
    expect(next).toContain('## Mood');
  });

  it('updates only inside the markers on a second write and is idempotent', () => {
    const once = writeMood(DESIGN, ['warm']);
    const edited = `${once}\nUser footer line.\n`;
    const twice = writeMood(edited, ['calm', 'quiet']);
    expect(readMood(twice)).toEqual(['calm', 'quiet']);
    expect(outsideMarkers(twice)).toBe(outsideMarkers(edited));
    expect(writeMood(twice, ['calm', 'quiet'])).toBe(twice);
  });

  it('an empty list leaves a readable placeholder and reads back empty', () => {
    expect(readMood(writeMood(DESIGN, []))).toEqual([]);
  });
});

describe('applyPalette', () => {
  const palette = BUILT_IN_PALETTES.find((p) => p.id === 'forest-mist') ?? BUILT_IN_PALETTES[0];

  it('replaces colors, keeps typography and the hand-written body, updates old hex values in prose', () => {
    const { text, bodyReplacements } = applyPalette(DESIGN, palette);
    const before = parseDesign(DESIGN);
    const after = parseDesign(text);
    expect(after.colors.primary).not.toBe(before.colors.primary);
    expect(after.tokens.typography).toEqual(before.tokens.typography);
    expect(text).toContain('Hand-written rule: keep the logo clear.  \n'); // trailing spaces preserved
    expect(bodyReplacements).toBeGreaterThan(0);
    expect(text).not.toContain('#E8A93B');
  });

  it('applying the same palette twice changes nothing more', () => {
    const once = applyPalette(DESIGN, palette).text;
    expect(applyPalette(once, palette).text).toBe(once);
  });

  it('mood survives a palette change', () => {
    const withMood = writeMood(DESIGN, ['warm']);
    expect(readMood(applyPalette(withMood, palette).text)).toEqual(['warm']);
  });
});
