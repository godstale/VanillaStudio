import { describe, expect, it } from 'vitest';
import { formatTime, layoutTimeline, segmentIndexAt } from './timeline';

describe('layoutTimeline', () => {
  it('lays timed scenes back to back and clamps to the total', () => {
    const tl = layoutTimeline(
      [
        { id: 'a', duration: 4 },
        { id: 'b', duration: 3 },
      ],
      7,
    );
    expect(tl.segments).toEqual([
      { id: 'a', start: 0, end: 4 },
      { id: 'b', start: 4, end: 7 },
    ]);
    expect(tl.length).toBe(7);
    expect(tl.stepped).toBe(false);
  });

  it('gives untimed scenes one step each', () => {
    const tl = layoutTimeline([{ id: 's1' }, { id: 's2' }, { id: 's3' }]);
    expect(tl.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
    expect(tl.length).toBe(3);
    expect(tl.stepped).toBe(true);
  });
});

describe('segmentIndexAt', () => {
  const segments = [
    { id: 'a', start: 0, end: 4 },
    { id: 'b', start: 4, end: 7 },
  ];
  it('finds the segment playing at t, holding the last one past the end', () => {
    expect(segmentIndexAt(segments, 0)).toBe(0);
    expect(segmentIndexAt(segments, 3.99)).toBe(0);
    expect(segmentIndexAt(segments, 4)).toBe(1);
    expect(segmentIndexAt(segments, 99)).toBe(1);
  });
});

describe('formatTime', () => {
  it('renders m:ss:ff at the given fps', () => {
    expect(formatTime(0, 30)).toBe('0:00:00');
    expect(formatTime(4.2, 30)).toBe('0:04:06');
    expect(formatTime(65.5, 25)).toBe('1:05:13');
    expect(formatTime(-3, 30)).toBe('0:00:00');
  });
});
