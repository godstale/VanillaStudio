import { describe, expect, it } from 'vitest';
import { ANALYSIS_BEGIN, ANALYSIS_END, isAnalysisEmpty, readAnalysis, writeAnalysis } from './analysis';
import { mergeTokens, parseSceneDesign, readExtends, WORKSPACE_EXTENDS } from './extends';
import { parseDesign, parseDesignTokens } from './parse';
import { outsideMarkers } from '@/lib/guides/markers';

const WORKSPACE = `---
name: Workspace
colors:
  canvas: "#101010"
  ink: "#f5f5f5"
  primary: "#3366ff"
  accent: "#ff8800"
typography:
  display:
    fontFamily: Inter
    fontSize: 48
  body:
    fontFamily: Inter
    fontSize: 16
mood: [calm, minimal]
---

# Workspace design

Prose that belongs to the user.
`;

const SCENE = (extra = '') => `---
extends: ${WORKSPACE_EXTENDS}
colors:
  primary: "#00aa88"
  highlight: "{colors.accent}"
typography:
  display:
    fontSize: 72
${extra}---

# Scene overrides
`;

describe('extends', () => {
  it('reads the extends declaration', () => {
    expect(readExtends(SCENE())).toBe(WORKSPACE_EXTENDS);
    expect(readExtends(WORKSPACE)).toBeNull();
    expect(readExtends('no front matter')).toBeNull();
    expect(readExtends('---\nextends: [a]\n---\n')).toBeNull();
  });

  it('scene tokens override workspace tokens, the rest is inherited', () => {
    const d = parseSceneDesign(SCENE(), WORKSPACE);
    expect(d.issues).toEqual([]);
    expect(d.tokens.colors.primary).toBe('#00aa88'); // override
    expect(d.tokens.colors.ink).toBe('#f5f5f5'); // inherited
    expect(d.tokens.colors.canvas).toBe('#101010');
    expect(d.tokens.typography.display).toEqual({ fontFamily: 'Inter', fontSize: 72 }); // key-level merge
    expect(d.tokens.typography.body).toEqual({ fontFamily: 'Inter', fontSize: 16 });
    expect(d.tokens.mood).toEqual(['calm', 'minimal']);
    expect('extends' in d.tokens).toBe(false);
  });

  it('a scene can reference workspace tokens (merge happens before reference resolution)', () => {
    const d = parseSceneDesign(SCENE(), WORKSPACE);
    expect(d.tokens.colors.highlight).toBe('#ff8800');
    // the same scene file alone cannot resolve it
    expect(parseDesign(SCENE()).issues.some((i) => i.includes('broken reference'))).toBe(true);
  });

  it('a scene mood replaces the inherited one', () => {
    const d = parseSceneDesign(SCENE('mood: [warm]\n'), WORKSPACE);
    expect(d.tokens.mood).toEqual(['warm']);
  });

  it('derived roles are computed from the merged colors', () => {
    const d = parseSceneDesign(SCENE(), WORKSPACE);
    expect(d.colors.primary).toBe('#00aa88');
    expect(d.colors.ink).toBe('#f5f5f5');
  });

  it('without extends only the scene file counts', () => {
    const d = parseSceneDesign(WORKSPACE, null);
    expect(d.tokens.colors.primary).toBe('#3366ff');
    expect(d.issues).toEqual([]);
  });

  it('rejects other extends paths and a missing workspace file without reading anything', () => {
    const other = parseSceneDesign(SCENE().replace(WORKSPACE_EXTENDS, '../../../secret.md'), WORKSPACE);
    expect(other.issues.some((i) => i.includes('only ../../DESIGN.md'))).toBe(true);
    expect(other.tokens.colors.ink).toBeUndefined(); // nothing inherited
    const missing = parseSceneDesign(SCENE(), null);
    expect(missing.issues.some((i) => i.includes('not found'))).toBe(true);
  });

  it('mergeTokens does not mutate its inputs', () => {
    const base = parseDesignTokens(WORKSPACE).tokens;
    const over = parseDesignTokens(SCENE()).tokens;
    const before = JSON.stringify([base, over]);
    mergeTokens(base, over);
    expect(JSON.stringify([base, over])).toBe(before);
  });
});

describe('analysis section', () => {
  const doc = `${WORKSPACE}\nMore user prose.\n`;

  it('creates the section at the end and leaves everything before it byte-identical', () => {
    const out = writeAnalysis(doc, '- calm palette\n- slow pacing');
    expect(out.startsWith(doc)).toBe(true);
    expect(readAnalysis(out)).toBe('- calm palette\n- slow pacing');
    expect(outsideMarkers(out).startsWith(doc)).toBe(true);
  });

  it('replaces only the inside of an existing section', () => {
    const first = writeAnalysis(doc, 'v1');
    const withTail = `${first}\nUser notes added after.\n`;
    const second = writeAnalysis(withTail, 'v2');
    expect(readAnalysis(second)).toBe('v2');
    expect(second.replace(/<!-- vanilla:begin:analysis -->[\s\S]*?<!-- vanilla:end:analysis -->/, 'X')).toBe(withTail.replace(/<!-- vanilla:begin:analysis -->[\s\S]*?<!-- vanilla:end:analysis -->/, 'X'));
  });

  it('round trip: writing the same body again changes nothing', () => {
    const once = writeAnalysis(doc, 'same');
    expect(writeAnalysis(once, 'same')).toBe(once);
  });

  it('preserves CRLF files byte for byte outside the section', () => {
    const crlf = doc.replace(/\n/g, '\r\n');
    const out = writeAnalysis(crlf, 'a\nb');
    expect(out.startsWith(crlf)).toBe(true);
    expect(out).not.toMatch(/[^\r]\n/); // every line break is still CRLF
    expect(readAnalysis(out)).toBe('a\nb');
    const again = writeAnalysis(out, 'c');
    expect(again.replace(/\r\n/g, '\n')).toContain('c');
    expect(again).not.toMatch(/[^\r]\n/);
  });

  it('refuses unbalanced markers instead of corrupting the file', () => {
    expect(() => writeAnalysis(`${doc}\n${ANALYSIS_BEGIN}\nhalf`, 'x')).toThrow(/Unbalanced/);
    expect(() => writeAnalysis(`${doc}\n${ANALYSIS_END}\n${ANALYSIS_BEGIN}\n`, 'x')).toThrow(/before begin/);
  });

  it('rejects a body that tries to inject markers', () => {
    expect(() => writeAnalysis(doc, '<!-- vanilla:begin:other -->')).toThrow(/must not contain markers/);
  });

  it('empty state', () => {
    expect(readAnalysis(doc)).toBeNull();
    expect(isAnalysisEmpty(doc)).toBe(true);
    expect(isAnalysisEmpty(writeAnalysis(doc, '  '))).toBe(true);
    expect(isAnalysisEmpty(writeAnalysis(doc, 'x'))).toBe(false);
  });
});
