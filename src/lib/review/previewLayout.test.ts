import { describe, expect, it } from 'vitest';
import { computePreviewLayout, nextZoom } from './previewLayout';

const container = { width: 800, height: 600 };
const format = { width: 1920, height: 1080 };

describe('computePreviewLayout', () => {
  it('keeps the native frame size and scales it to fit', () => {
    const l = computePreviewLayout({ container, format, zoom: 'fit', deviceWidth: null });
    expect(l.frame).toEqual({ width: 1920, height: 1080 });
    expect(l.scale).toBeCloseTo(Math.min((800 - 32) / 1920, (600 - 32) / 1080), 6);
    expect(l.box.width).toBe(Math.round(1920 * l.scale));
  });

  it('uses a fixed zoom when given', () => {
    const l = computePreviewLayout({ container, format, zoom: 1, deviceWidth: null });
    expect(l.scale).toBe(1);
    expect(l.box).toEqual({ width: 1920, height: 1080 });
  });

  it('uses the device width for web previews and fills the pane height', () => {
    const l = computePreviewLayout({ container, format, zoom: 'fit', deviceWidth: 390 });
    expect(l.frame.width).toBe(390);
    expect(l.frame.height).toBe(600 - 32);
  });
});

describe('nextZoom', () => {
  it('steps through fixed zoom stops', () => {
    expect(nextZoom(1, 1)).toBe(1.5);
    expect(nextZoom(1, -1)).toBe(0.75);
    expect(nextZoom(2, 1)).toBe(2);
    expect(nextZoom(0.25, -1)).toBe(0.25);
    expect(nextZoom(0.9, 1)).toBe(1);
  });
});
