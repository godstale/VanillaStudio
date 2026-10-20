import { describe, expect, it, vi } from 'vitest';
import { createTransitionRunner, planFor } from './sceneTransitions';
import { SAMPLE_CUSTOM_TRANSITION, customTransitionSchema } from './transitions/custom';
import type { IframeScene } from './iframeScene';
import type { SceneHandle } from '@/lib/sequence/manager';

const spec = (type: string, durationMs = 600) => ({ type, durationMs, easing: 'ease-in-out', params: {} });
const custom = new Map([['iris-blur', customTransitionSchema.parse(SAMPLE_CUSTOM_TRANSITION)]]);

function fakeScene() {
  const animate = vi.fn(() => ({ finished: Promise.resolve({} as Animation), cancel: vi.fn() }));
  const cancelAll = vi.fn();
  const element = { animate, getAnimations: () => [{ cancel: cancelAll }] } as unknown as HTMLIFrameElement;
  return { scene: { element, setLayer: vi.fn() } as unknown as IframeScene, animate, cancelAll };
}

describe('planFor', () => {
  it('builtin, custom and unknown transitions', () => {
    expect(planFor(spec('crossfade'), custom)?.durationMs).toBe(600);
    expect(planFor(spec('custom:iris-blur', 900), custom)).toMatchObject({ durationMs: 900 });
    expect(planFor(spec('custom:ghost'), custom)).toBeNull();
    expect(planFor(spec('match-cut'), custom)).toBeNull();
  });
});

describe('createTransitionRunner', () => {
  it('layers the scenes, animates the outgoing one and clears effects on the incoming one', async () => {
    const run = createTransitionRunner(custom);
    const from = fakeScene();
    const to = fakeScene();
    await run(spec('slide-left'), from.scene, to.scene);
    expect(from.scene.setLayer).toHaveBeenCalledWith('top');
    expect(to.scene.setLayer).toHaveBeenCalledWith('under');
    expect(from.animate).toHaveBeenCalledWith([{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }], { duration: 600, easing: 'ease-in-out', fill: 'forwards' });
    expect(to.cancelAll).toHaveBeenCalled();
  });

  it('an undefined custom transition falls back to a cut instead of failing', async () => {
    const run = createTransitionRunner(custom);
    const from = fakeScene();
    const to = fakeScene();
    await run(spec('custom:ghost'), from.scene, to.scene);
    expect(from.animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' });
  });

  it('does nothing for handles that are not iframes', async () => {
    const run = createTransitionRunner(custom);
    const plain = { sceneId: 'x' } as SceneHandle;
    await expect(run(spec('crossfade'), plain, plain)).resolves.toBeUndefined();
  });
});
