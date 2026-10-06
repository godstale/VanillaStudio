import { describe, expect, it, vi } from 'vitest';
import { getBuiltinTemplate } from '@/lib/guides/template';
import { findTerm } from '@/lib/guides/glossary';
import {
  BUILTIN_TRANSITIONS,
  clampDuration,
  customTransitionName,
  isKnownTransition,
  MAX_TRANSITION_MS,
  planBuiltin,
  safeEasing,
  TRANSITION_GLOSSARY_ID,
  type TransitionSpec,
} from './index';
import { runTransition, type Animatable } from './run';

const spec = (type: string, params: Record<string, unknown> = {}, over: Partial<TransitionSpec> = {}): TransitionSpec => ({ type, durationMs: 600, easing: 'ease-in-out', params, ...over });

describe('planBuiltin', () => {
  it('plans every builtin transition with from keyframes and the requested timing', () => {
    for (const type of BUILTIN_TRANSITIONS) {
      const plan = planBuiltin(spec(type));
      expect(plan, type).not.toBeNull();
      expect(plan!.from.length, type).toBe(2);
      expect(plan!.easing).toBe('ease-in-out');
      expect(plan!.durationMs).toBe(type === 'cut' ? 0 : 600);
    }
  });

  it('crossfade fades the outgoing scene out', () => {
    expect(planBuiltin(spec('crossfade'))!.from).toEqual([{ opacity: 1 }, { opacity: 0 }]);
  });

  it('slide directions move the outgoing scene off screen', () => {
    expect(planBuiltin(spec('slide-left'))!.from[1]).toEqual({ transform: 'translateX(-100%)' });
    expect(planBuiltin(spec('slide-right'))!.from[1]).toEqual({ transform: 'translateX(100%)' });
    expect(planBuiltin(spec('slide-up'))!.from[1]).toEqual({ transform: 'translateY(-100%)' });
    expect(planBuiltin(spec('slide-down'))!.from[1]).toEqual({ transform: 'translateY(100%)' });
  });

  it('mask-wipe direction and circular-reveal center come from params, clamped', () => {
    expect(planBuiltin(spec('mask-wipe', { direction: 'down' }))!.from[1]).toEqual({ clipPath: 'inset(100% 0 0 0)' });
    expect(planBuiltin(spec('mask-wipe', { direction: 'sideways' }))!.from[1]).toEqual({ clipPath: 'inset(0 0 0 100%)' }); // unknown → default left
    expect(planBuiltin(spec('circular-reveal', { x: 20, y: 80 }))!.from).toEqual([{ clipPath: 'circle(75% at 20% 80%)' }, { clipPath: 'circle(0% at 20% 80%)' }]);
    expect(planBuiltin(spec('circular-reveal', { x: 999, y: -5 }))!.from[0]).toEqual({ clipPath: 'circle(75% at 100% 0%)' });
  });

  it('zoom-through scale is bounded', () => {
    expect(planBuiltin(spec('zoom-through'))!.from[1]).toEqual({ transform: 'scale(2.2)', opacity: 0 });
    expect(planBuiltin(spec('zoom-through', { scale: 50 }))!.from[1]).toMatchObject({ transform: 'scale(6)' });
    expect(planBuiltin(spec('zoom-through', { scale: 'big' }))!.from[1]).toMatchObject({ transform: 'scale(2.2)' });
  });

  it('cut has no duration; other durations and easings are sanitised', () => {
    expect(planBuiltin(spec('cut'))!.durationMs).toBe(0);
    expect(planBuiltin(spec('crossfade', {}, { durationMs: 999999 }))!.durationMs).toBe(MAX_TRANSITION_MS);
    expect(planBuiltin(spec('crossfade', {}, { easing: 'url(javascript:alert(1))' }))!.easing).toBe('ease-in-out');
    expect(clampDuration(-5)).toBe(0);
    expect(clampDuration(Number.NaN)).toBe(0);
    expect(safeEasing('cubic-bezier(0.4, 0, 0.2, 1)')).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(safeEasing('steps(4)')).toBe('ease-in-out');
  });

  it('unknown types are not planned', () => {
    expect(planBuiltin(spec('match-cut'))).toBeNull();
    expect(planBuiltin(spec('custom:swirl'))).toBeNull();
  });
});

describe('known transitions', () => {
  it('builtin ids and custom:<name> declared in the workspace', () => {
    expect(isKnownTransition('crossfade')).toBe(true);
    expect(isKnownTransition('match-cut')).toBe(false); // v2.0 excluded (PoC R-1)
    expect(isKnownTransition('custom:swirl')).toBe(false);
    expect(isKnownTransition('custom:swirl', new Set(['swirl']))).toBe(true);
    expect(customTransitionName('custom:swirl')).toBe('swirl');
    expect(customTransitionName('custom:../x')).toBeNull();
    expect(customTransitionName('custom:')).toBeNull();
  });

  it('every builtin transition has a term in each guide glossary (same source as the list)', () => {
    for (const ref of ['commercial@1', 'three-scene@1']) {
      const glossary = getBuiltinTemplate(ref)!.glossary;
      for (const type of BUILTIN_TRANSITIONS) {
        expect(findTerm(glossary, 'transition', TRANSITION_GLOSSARY_ID[type]), `${ref}: ${type}`).toBeDefined();
      }
    }
  });
});

describe('runTransition', () => {
  const fake = () => {
    const cancel = vi.fn();
    let resolve: () => void = () => undefined;
    let reject: (e: Error) => void = () => undefined;
    const finished = new Promise<Animation>((res, rej) => {
      resolve = () => res({} as Animation);
      reject = rej;
    });
    const el: Animatable = { animate: vi.fn(() => ({ finished, cancel })) };
    return { el, cancel, resolve, reject };
  };

  it('animates the outgoing scene with the plan options and resolves true when done', async () => {
    const out = fake();
    const plan = planBuiltin(spec('crossfade'))!;
    const run = runTransition(plan, out.el, null);
    expect(out.el.animate).toHaveBeenCalledWith(plan.from, { duration: 600, easing: 'ease-in-out', fill: 'forwards' });
    out.resolve();
    expect(await run.finished).toBe(true);
  });

  it('cancel aborts and resolves false', async () => {
    const out = fake();
    const run = runTransition(planBuiltin(spec('slide-left'))!, out.el, null);
    run.cancel();
    expect(out.cancel).toHaveBeenCalled();
    out.reject(new DOMException('aborted', 'AbortError'));
    expect(await run.finished).toBe(false);
  });

  it('animates the incoming scene too when the plan has keyframes for it', async () => {
    const out = fake();
    const inc = fake();
    const plan = { durationMs: 300, easing: 'linear', from: [{ opacity: 1 }, { opacity: 0 }], to: [{ opacity: 0 }, { opacity: 1 }] };
    const run = runTransition(plan, out.el, inc.el);
    expect(inc.el.animate).toHaveBeenCalledWith(plan.to, { duration: 300, easing: 'linear', fill: 'forwards' });
    out.resolve();
    inc.resolve();
    expect(await run.finished).toBe(true);
  });

  it('a cut hides the outgoing scene at once', async () => {
    const out = fake();
    const run = runTransition(planBuiltin(spec('cut'))!, out.el, null);
    expect(out.el.animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' });
    expect(await run.finished).toBe(true);
  });
});
