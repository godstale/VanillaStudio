import { describe, expect, it } from 'vitest';
import {
  emptyBrief,
  parseBrief,
  serializeBrief,
  uniqueFileName,
  validateBrief,
  type Brief,
} from './brief';

const full: Brief = {
  purpose: 'Launch video for the studio.\nSecond line.',
  audience: 'Design-minded founders',
  keyMessage: 'Code makes beautiful things',
  tone: ['warm', 'editorial'],
  brandColors: ['#F1EE2E', '#1B2566'],
  brandFonts: ['Georgia'],
  mustInclude: ['logo', 'tagline'],
  mustAvoid: ['stock photos'],
  references: ['https://example.com/ref'],
  materials: [
    { file: 'logo.png', license: 'CC0', source: 'https://example.com/logo' },
    { file: 'notes.txt', license: '', source: '' },
  ],
  notes: 'Free text.\n\n\nWith gaps.',
};

describe('brief.md', () => {
  it('round-trips a full brief', () => {
    expect(parseBrief(serializeBrief(full))).toEqual(full);
  });

  it('round-trips an empty brief and is stable', () => {
    const text = serializeBrief(emptyBrief());
    expect(parseBrief(text)).toEqual(emptyBrief());
    expect(serializeBrief(parseBrief(text))).toBe(text);
  });

  it('writes fixed English headings regardless of UI language', () => {
    const text = serializeBrief(full);
    for (const h of ['## Purpose', '## Audience', '## Key message', '## Tone', '## Brand colors', '## Materials', '## Notes']) {
      expect(text).toContain(h);
    }
  });

  it('escapes heading-like lines in free text', () => {
    const brief = { ...emptyBrief(), purpose: 'intro\n## Audience\nnot a heading', notes: '\\# literal' };
    const parsed = parseBrief(serializeBrief(brief));
    expect(parsed.purpose).toBe(brief.purpose);
    expect(parsed.audience).toBe('');
    expect(parsed.notes).toBe(brief.notes);
  });

  it('keeps license and source on one line', () => {
    const brief = {
      ...emptyBrief(),
      materials: [{ file: 'a.png', license: 'CC | BY\n4.0', source: 'x' }],
    };
    expect(parseBrief(serializeBrief(brief)).materials).toEqual([
      { file: 'a.png', license: 'CC / BY 4.0', source: 'x' },
    ]);
  });

  it('reads hand-edited files: CRLF, missing and unknown sections', () => {
    const parsed = parseBrief('# Brief\r\n\r\n## Purpose\r\n\r\nHello\r\n\r\n## Whatever\r\n\r\nx\r\n\r\n## Tone\r\n\r\n- calm\r\n');
    expect(parsed.purpose).toBe('Hello');
    expect(parsed.tone).toEqual(['calm']);
    expect(parsed.materials).toEqual([]);
  });

  it('validates purpose and hex brand colors', () => {
    expect(validateBrief(emptyBrief())).toEqual([{ field: 'purpose' }]);
    const issues = validateBrief({ ...full, brandColors: ['#FFF', 'red', '#12'] });
    expect(issues.map((i) => i.value)).toEqual(['red', '#12']);
    expect(validateBrief(full)).toEqual([]);
  });

  it('numbers duplicate material names', () => {
    expect(uniqueFileName('a.png', [])).toBe('a.png');
    expect(uniqueFileName('a.png', ['A.PNG'])).toBe('a-2.png');
    expect(uniqueFileName('a.png', ['a.png', 'a-2.png'])).toBe('a-3.png');
    expect(uniqueFileName('README', ['README'])).toBe('README-2');
  });
});
