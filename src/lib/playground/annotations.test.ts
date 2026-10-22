import { describe, expect, it } from 'vitest';
import { eraseStrokes, strokeToPath, type AnnotStroke } from './annotations';

const stroke = (id: number, points: Array<[number, number]>): AnnotStroke => ({
  id,
  color: '#ff3b30',
  width: 6,
  points: points.map(([x, y]) => ({ x, y })),
});

describe('annotations', () => {
  it('builds an SVG path from canvas points', () => {
    expect(strokeToPath(stroke(1, [[0, 0], [10, 20]]))).toBe('M0.0 0.0 L10.0 20.0');
  });

  it('erases only the stroke the eraser touches', () => {
    const strokes = [stroke(1, [[0, 0], [100, 0]]), stroke(2, [[0, 500], [100, 500]])];
    const next = eraseStrokes(strokes, { x: 50, y: 8 }, 32);
    expect(next.map((s) => s.id)).toEqual([2]);
  });

  it('keeps every stroke when the eraser touches nothing', () => {
    const strokes = [stroke(1, [[0, 0], [100, 0]])];
    expect(eraseStrokes(strokes, { x: 500, y: 500 }, 32)).toHaveLength(1);
  });
});
