import { planCustom, type CustomTransition } from './transitions/custom';
import { customTransitionName, planBuiltin, type TransitionPlan, type TransitionSpec } from './transitions';
import { runTransition } from './transitions/run';
import type { IframeScene } from './iframeScene';
import type { SceneHandle, TransitionRunner } from '@/lib/sequence/manager';

// 시퀀스 매니저의 `TransitionRunner` 브라우저 구현: 엣지의 전환을 계획으로 바꿔 두 iframe 요소에 건다(PoC R-1 방식 ①).

/** 엣지 전환 → 계획. 알 수 없는 전환(정의 없는 `custom:`)은 null이고, 그러면 컷으로 처리한다. */
export function planFor(spec: TransitionSpec, custom: ReadonlyMap<string, CustomTransition>): TransitionPlan | null {
  const name = customTransitionName(spec.type);
  if (name !== null) {
    const def = custom.get(name);
    return def ? planCustom(def, spec) : null;
  }
  return planBuiltin(spec);
}

const isIframe = (h: SceneHandle): h is IframeScene => 'element' in h && 'setLayer' in h;

export function createTransitionRunner(custom: ReadonlyMap<string, CustomTransition>): TransitionRunner {
  return async (spec, from, to) => {
    if (!isIframe(from) || !isIframe(to)) return;
    const plan = planFor(spec, custom) ?? planBuiltin({ type: 'cut', durationMs: 0, easing: '', params: {} });
    if (!plan) return;
    // 나가는 신은 위, 들어오는 신은 그 아래에서 이미 재생 중이다.
    from.setLayer('top');
    to.setLayer('under');
    const run = runTransition(plan, from.element, to.element);
    await run.finished;
    // 들어오는 신에 건 효과는 끝 상태에서 지운다(나가는 신은 곧 사라진다).
    to.element.getAnimations?.().forEach((a) => a.cancel());
  };
}
