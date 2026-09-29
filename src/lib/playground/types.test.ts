import { describe, expect, it } from 'vitest';
import { isPlaygroundKind, makePlaygroundId, normalizeTags, playgroundItemSchema } from './types';

describe('playground types', () => {
  it('accepts the five export kinds only', () => {
    expect(isPlaygroundKind('video')).toBe(true);
    expect(isPlaygroundKind('pdf')).toBe(false);
  });

  it('parses a valid item and defaults tags', () => {
    const r = playgroundItemSchema.safeParse({
      id: 'pg-1',
      title: 'Intro',
      kind: 'video',
      dirPath: 'C:/x/out',
      sourceProject: null,
      createdAt: '2026-09-30T00:00:00.000Z',
      updatedAt: '2026-09-30T00:00:00.000Z',
    });
    expect(r.success && r.data.tags).toEqual([]);
  });

  it('rejects an empty title', () => {
    const r = playgroundItemSchema.safeParse({
      id: 'pg-1',
      title: '  ',
      kind: 'image',
      dirPath: 'C:/x',
      sourceProject: null,
      createdAt: 't',
      updatedAt: 't',
    });
    expect(r.success).toBe(false);
  });

  it('builds deterministic ids when seeded', () => {
    expect(makePlaygroundId(1000, 0.5)).toBe('pg-1000-500000');
  });

  it('normalizes tags', () => {
    expect(normalizeTags(['  A ', '', 'a', 'B '])).toEqual(['A', 'B']);
  });
});
