import { describe, expect, it } from 'vitest';
import { applyMarkers, outsideMarkers, readSection } from './markers';

const s = (id: string, body: string) => ({ id, body });

describe('applyMarkers', () => {
  it('creates a new file from sections', () => {
    expect(applyMarkers(null, [s('a', 'one'), s('b', 'two')])).toBe(
      '<!-- vanilla:begin:a -->\none\n<!-- vanilla:end:a -->\n\n<!-- vanilla:begin:b -->\ntwo\n<!-- vanilla:end:b -->\n',
    );
  });

  it('replaces only inside the markers and keeps the rest byte for byte', () => {
    const first = applyMarkers(null, [s('a', 'old')]);
    const edited = `# My notes\n\nkeep me  \n${first}\ntrailing user text`;
    const next = applyMarkers(edited, [s('a', 'new body\nline 2')]);
    expect(readSection(next, 'a')).toBe('new body\nline 2');
    expect(outsideMarkers(next)).toBe(outsideMarkers(edited));
    expect(next.startsWith('# My notes\n\nkeep me  \n')).toBe(true);
    expect(next.endsWith('trailing user text')).toBe(true);
  });

  it('appends sections that are not in the file yet', () => {
    const next = applyMarkers('user text', [s('a', 'x')]);
    expect(next.startsWith('user text\n')).toBe(true);
    expect(readSection(next, 'a')).toBe('x');
  });

  it('is deterministic and idempotent', () => {
    const sections = [s('a', 'x'), s('b', 'y')];
    const once = applyMarkers(null, sections);
    expect(applyMarkers(null, sections)).toBe(once);
    expect(applyMarkers(once, sections)).toBe(once);
  });

  it('normalizes CRLF in existing files', () => {
    const next = applyMarkers('hello\r\nworld\r\n', [s('a', 'x')]);
    expect(next).not.toContain('\r');
  });

  it('refuses broken or ambiguous markers instead of damaging the file', () => {
    expect(() => applyMarkers('<!-- vanilla:begin:a -->\nx', [s('a', 'y')])).toThrow(/Unbalanced/);
    expect(() => applyMarkers('<!-- vanilla:end:a -->\n<!-- vanilla:begin:a -->', [s('a', 'y')])).toThrow(/before begin/);
    const dup = applyMarkers(null, [s('a', 'x')]);
    expect(() => applyMarkers(`${dup}\n${dup}`, [s('a', 'y')])).toThrow(/Duplicate/);
  });

  it('rejects bad ids, nested markers and duplicate sections', () => {
    expect(() => applyMarkers(null, [s('Bad Id', 'x')])).toThrow();
    expect(() => applyMarkers(null, [s('a', '<!-- vanilla:end:a -->')])).toThrow();
    expect(() => applyMarkers(null, [s('a', 'x'), s('a', 'y')])).toThrow();
  });
});
