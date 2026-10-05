import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FRAME, frameFromSearch, getFrame, parseFrame, resetFrame, setFrame } from './frame';

afterEach(() => resetFrame());

describe('frame', () => {
  it('defaults to 1920x1080 at 30 fps', () => {
    expect(getFrame()).toEqual(DEFAULT_FRAME);
  });

  it('parses valid values and rejects anything out of range or non-integer', () => {
    expect(parseFrame({ width: 1080, height: 1920, fps: 60 })).toEqual({ width: 1080, height: 1920, fps: 60 });
    expect(parseFrame({ width: '1080', height: '1920', fps: '24' })).toEqual({ width: 1080, height: 1920, fps: 24 });
    for (const bad of [
      { width: 8, height: 1080, fps: 30 },
      { width: 1920, height: 99999, fps: 30 },
      { width: 1920, height: 1080, fps: 0 },
      { width: 1920, height: 1080, fps: 121 },
      { width: 19.5, height: 1080, fps: 30 },
      { width: 'x', height: 1080, fps: 30 },
      { height: 1080, fps: 30 },
    ]) {
      expect(parseFrame(bad)).toBeNull();
    }
  });

  it('reads ?w=&h=&fps= from the URL; partial or invalid input is ignored', () => {
    expect(frameFromSearch('?w=1080&h=1920&fps=60')).toEqual({ width: 1080, height: 1920, fps: 60 });
    expect(frameFromSearch('?w=1080&h=1920')).toBeNull();
    expect(frameFromSearch('?mode=preview')).toBeNull();
  });

  it('setFrame updates the value and resetFrame restores the default', () => {
    setFrame({ width: 1080, height: 1080, fps: 24 });
    expect(getFrame()).toEqual({ width: 1080, height: 1080, fps: 24 });
    resetFrame();
    expect(getFrame()).toEqual(DEFAULT_FRAME);
  });

  it('setting identical values keeps the same object (no needless re-render)', () => {
    const before = getFrame();
    setFrame({ ...before });
    expect(getFrame()).toBe(before);
  });
});
