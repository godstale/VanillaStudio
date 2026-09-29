import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClockProvider, createClock, type ClockMode } from './clock';
import { canvasSettings } from './canvasSettings';

const fiber = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
  advance: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: Record<string, unknown>) => {
    fiber.props = props;
    return null;
  },
  advance: fiber.advance,
  invalidate: fiber.invalidate,
}));

import { VanillaCanvas, type VanillaCanvasProps } from './canvas';

function mount(mode: ClockMode, props: VanillaCanvasProps = {}) {
  const clock = createClock({ mode });
  const view = render(
    <ClockProvider clock={clock}>
      <VanillaCanvas {...props} />
    </ClockProvider>,
  );
  return { clock, ...view };
}

const gl = () => fiber.props?.gl as Record<string, unknown>;

beforeEach(() => {
  fiber.props = null;
  fiber.advance.mockClear();
  fiber.invalidate.mockClear();
});

describe('canvasSettings', () => {
  it('maps clock modes to R3F settings', () => {
    expect(canvasSettings({ mode: 'render' })).toMatchObject({ frameloop: 'never', preserveDrawingBuffer: true, dpr: 1, drive: 'advance' });
    expect(canvasSettings({ mode: 'preview', frameloop: 'always' })).toMatchObject({ frameloop: 'demand', preserveDrawingBuffer: false, drive: 'invalidate' });
    expect(canvasSettings({ mode: 'live' })).toMatchObject({ frameloop: 'always', drive: 'none' });
    expect(canvasSettings({ mode: 'live', frameloop: 'demand' }).frameloop).toBe('demand');
  });
});

describe('<VanillaCanvas>', () => {
  it('render: frameloop never, drawing buffer preserved, fixed dpr, advance(t*1000) per seek', () => {
    const { clock } = mount('render');
    expect(fiber.props?.frameloop).toBe('never');
    expect(fiber.props?.dpr).toBe(1);
    expect(gl().preserveDrawingBuffer).toBe(true);
    clock.seek(1.5);
    clock.seek(1.5);
    expect(fiber.advance.mock.calls).toEqual([[1500], [1500]]);
    expect(fiber.invalidate).not.toHaveBeenCalled();
  });

  it('preview: demand loop, invalidate per seek, buffer not preserved by default', () => {
    const { clock } = mount('preview');
    expect(fiber.props?.frameloop).toBe('demand');
    expect(gl().preserveDrawingBuffer).toBe(false);
    clock.seek(2);
    expect(fiber.invalidate).toHaveBeenCalledTimes(1);
    expect(fiber.advance).not.toHaveBeenCalled();
  });

  it('preserveDrawingBuffer option overrides the mode default and other gl options are kept', () => {
    mount('preview', { preserveDrawingBuffer: true, gl: { alpha: true } });
    expect(gl()).toMatchObject({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  });

  it('preview ignores a frameloop override (clock contract)', () => {
    mount('preview', { frameloop: 'always' });
    expect(fiber.props?.frameloop).toBe('demand');
  });

  it('live: honours frameloop and does not follow the clock', () => {
    const { clock } = mount('live', { frameloop: 'demand' });
    expect(fiber.props?.frameloop).toBe('demand');
    clock.pause();
    clock.redraw();
    expect(fiber.advance).not.toHaveBeenCalled();
    expect(fiber.invalidate).not.toHaveBeenCalled();
  });

  it('onCreated paints the current time once and forwards to the user callback', () => {
    const onCreated = vi.fn();
    const { clock } = mount('render', { onCreated });
    clock.seek(3);
    fiber.advance.mockClear();
    (fiber.props?.onCreated as (s: unknown) => void)({ marker: 1 });
    expect(fiber.advance).toHaveBeenCalledWith(3000);
    expect(onCreated).toHaveBeenCalledWith({ marker: 1 });
  });

  it('stops following the clock after unmount', () => {
    const { clock, unmount } = mount('render');
    unmount();
    clock.seek(1);
    expect(fiber.advance).not.toHaveBeenCalled();
  });
});
