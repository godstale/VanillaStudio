import { describe, expect, it } from 'vitest';
import { edgeScore, pickBestFrame } from './frameScore';

function frame(w: number, h: number, fill: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  return data;
}

describe('edgeScore', () => {
  it('scores a flat frame as blank', () => {
    expect(edgeScore(frame(20, 20, () => [10, 10, 10]), 20, 20)).toBe(0);
  });

  it('keeps a smooth gradient near zero', () => {
    expect(edgeScore(frame(64, 64, (x) => [x * 2, x * 2, x * 2]), 64, 64)).toBe(0);
  });

  it('scores content on a background above the rich threshold', () => {
    const data = frame(40, 40, (x, y) => (x > 10 && x < 30 && y > 10 && y < 30 ? [255, 255, 255] : [0, 0, 0]));
    expect(edgeScore(data, 40, 40)).toBeGreaterThan(0.02);
  });
});

describe('pickBestFrame', () => {
  it('returns null without candidates', () => {
    expect(pickBestFrame([])).toBeNull();
  });

  it('prefers the earliest frame that is close to the richest one', () => {
    const frames = [
      { dataUrl: 'a', score: 0 },
      { dataUrl: 'b', score: 0.08 },
      { dataUrl: 'c', score: 0.1 },
    ];
    expect(pickBestFrame(frames)?.dataUrl).toBe('b');
  });

  it('falls back to the first frame when everything is blank', () => {
    expect(pickBestFrame([{ dataUrl: 'a', score: 0 }, { dataUrl: 'b', score: 0 }])?.dataUrl).toBe('a');
  });
});
