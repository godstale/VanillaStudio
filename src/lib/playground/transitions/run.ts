import type { TransitionPlan } from './index';

// 계획을 실제 iframe 요소에 재생한다(호스트 전용). `fill: 'forwards'`로 끝 상태를 유지하고, 재생이 끝나면 호출자가 요소를 정리한다.

/** 테스트에서 가짜 요소를 쓸 수 있도록 필요한 부분만 정의한다. */
export interface Animatable {
  animate(keyframes: Keyframe[], options: KeyframeAnimationOptions): Pick<Animation, 'finished' | 'cancel'>;
}

export interface RunningTransition {
  /** 끝까지 재생되면 true, 중간에 취소되면 false. */
  finished: Promise<boolean>;
  /** 진행 중이면 멈추고 효과를 제거한다. */
  cancel: () => void;
}

export function runTransition(plan: TransitionPlan, from: Animatable, to: Animatable | null): RunningTransition {
  if (plan.durationMs === 0) {
    // cut: 애니메이션 없이 바로 나가는 신을 숨긴다.
    const hide = from.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' });
    return { finished: Promise.resolve(true), cancel: () => hide.cancel() };
  }
  const options: KeyframeAnimationOptions = { duration: plan.durationMs, easing: plan.easing, fill: 'forwards' };
  const anims = [from.animate(plan.from, options), ...(to && plan.to ? [to.animate(plan.to, options)] : [])];
  const finished = Promise.all(anims.map((a) => a.finished)).then(
    () => true,
    () => false, // cancel()은 finished를 AbortError로 거부한다
  );
  return { finished, cancel: () => anims.forEach((a) => a.cancel()) };
}
