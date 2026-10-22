import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureDom } from './domCapture';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('captureDom', () => {
  it('serializes the styled page into an SVG foreignObject and returns the canvas PNG', async () => {
    document.body.innerHTML = '<h1 style="color:rgb(255, 0, 0)">Hello</h1><canvas></canvas>';
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(320);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(180);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    const drawn: number[][] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: (_i: unknown, _x: number, _y: number, w: number, h: number) => drawn.push([w, h]) } as unknown as CanvasRenderingContext2D);
    let svgSrc = '';
    vi.stubGlobal(
      'Image',
      class {
        onload: () => void = () => undefined;
        set src(v: string) {
          svgSrc = decodeURIComponent(v.split(',')[1]!);
          queueMicrotask(() => this.onload());
        }
      },
    );
    const url = await captureDom(0.5);
    expect(url).toBe('data:image/png;base64,AAAA');
    expect(drawn).toEqual([[160, 90]]);
    expect(svgSrc).toContain('<foreignObject');
    expect(svgSrc).toContain('Hello');
    expect(svgSrc).toMatch(/color:\s*rgb\(255, 0, 0\)/);
  });

  it('rejects with a capture: error when the page has no size', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(0);
    await expect(captureDom(1)).rejects.toThrow(/^capture:/);
  });
});
