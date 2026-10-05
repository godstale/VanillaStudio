import { describe, expect, it } from 'vitest';
import { checkBeats } from '@/lib/scene/schema';
import { buildAdvance, parseAdvance } from './advance';
import { distribute, newBeat, type Beat } from './beats';

const beat = (id: string, start: number, end: number): Beat => ({ id, start, end, role: '', copy: '', visual: '', motion: [], camera: '', transitionOut: '', notes: '' });

describe('beats helpers', () => {
  it('a new beat continues from the last end, capped by the duration', () => {
    expect(newBeat([], 10)).toMatchObject({ id: 'b1', start: 0, end: 2 });
    expect(newBeat([beat('b1', 0, 2)], 10)).toMatchObject({ id: 'b2', start: 2, end: 4 });
    expect(newBeat([beat('b1', 0, 9.5)], 10)).toMatchObject({ start: 9.5, end: 10 });
  });

  it('picks an unused id', () => {
    expect(newBeat([beat('b2', 0, 1), beat('b1', 1, 2)], 10).id).toBe('b3');
    expect(newBeat([beat('b2', 0, 1)], 10).id).toBe('b3');
  });

  it('distributes the duration evenly and ends exactly at the duration', () => {
    const d = distribute([beat('a', 0, 1), beat('b', 1, 2), beat('c', 2, 3)], 10);
    expect(d.map((b) => [b.start, b.end])).toEqual([[0, 3.333], [3.333, 6.667], [6.667, 10]]);
    expect(checkBeats({ duration: { seconds: 10 }, beats: d })).toEqual([]);
  });
});

describe('advance strings', () => {
  it('round-trips click, key and choice', () => {
    for (const a of ['click', 'key:ArrowRight', 'choice:Yes please']) {
      const { kind, arg } = parseAdvance(a);
      expect(buildAdvance(kind, arg)).toBe(a);
    }
  });

  it('anything else is treated as click', () => {
    expect(parseAdvance('timer:3')).toEqual({ kind: 'click', arg: '' });
  });
});
