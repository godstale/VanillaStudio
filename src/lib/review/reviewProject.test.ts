import { describe, expect, it } from 'vitest';
import { DEFAULT_REVIEW_PROJECT, timeKindOf } from './reviewProject';

describe('timeKindOf', () => {
  it('animates timeline types on the clock and runs web types free (D-011)', () => {
    expect(timeKindOf('video')).toBe('clock');
    expect(timeKindOf('image')).toBe('clock');
    expect(timeKindOf('slides')).toBe('clock');
    expect(timeKindOf('web')).toBe('free');
    expect(timeKindOf('interactive')).toBe('free');
  });

  it('falls back to a 1080p web project', () => {
    expect(DEFAULT_REVIEW_PROJECT).toEqual({ outputType: 'web', format: { width: 1920, height: 1080 }, fps: 30 });
  });
});
