// 신 사이 전환 라이브러리(T6.3, PoC R-1 결론): 두 신 iframe을 겹쳐 두고 호스트가 "나가는 신" iframe 요소에 Web Animations를 건다.
// 신은 전환을 알 필요가 없다(서로 다른 origin이라 서로의 DOM도 못 본다). 이 모듈은 `sequence.json`의 transition을 키프레임 계획으로 바꾸는 순수 함수만 둔다.
// 실제 재생은 run.ts. `match-cut`은 v2.0에서 제외했고(요소 단위 합성 불가), `custom`은 선언형 JSON이다(custom.ts, 코드 실행 없음).

export const BUILTIN_TRANSITIONS = ['cut', 'crossfade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'mask-wipe', 'circular-reveal', 'zoom-through'] as const;
export type BuiltinTransition = (typeof BUILTIN_TRANSITIONS)[number];

/** 전환 id → 용어집(`transition` 카테고리) 용어 id. 용어집과 같은 소스를 쓰기 위한 대응표다. */
export const TRANSITION_GLOSSARY_ID: Record<BuiltinTransition, string> = {
  cut: 'hard-cut',
  crossfade: 'crossfade',
  'slide-left': 'slide-left',
  'slide-right': 'slide-right',
  'slide-up': 'slide-up',
  'slide-down': 'slide-down',
  'mask-wipe': 'mask-wipe',
  'circular-reveal': 'circular-reveal',
  'zoom-through': 'zoom-through',
};

export const MAX_TRANSITION_MS = 5000;
export const DEFAULT_EASING = 'ease-in-out';
const EASING = /^(linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\(\s*-?\d*\.?\d+\s*(,\s*-?\d*\.?\d+\s*){3}\))$/;

export interface TransitionSpec {
  type: string;
  durationMs: number;
  easing: string;
  params: Record<string, unknown>;
}

export interface TransitionPlan {
  durationMs: number;
  easing: string;
  /** 나가는 신 iframe 요소에 적용할 키프레임. */
  from: Keyframe[];
  /** 들어오는 신 iframe 요소에 적용할 키프레임(없으면 가만히 둔다). */
  to: Keyframe[] | null;
}

export const isBuiltinTransition = (type: string): type is BuiltinTransition => (BUILTIN_TRANSITIONS as readonly string[]).includes(type);

/** `custom:<name>`처럼 선언형 사용자 전환을 가리키는 type인가(정의는 `transitions/<name>.json`). */
export const customTransitionName = (type: string): string | null => /^custom:([a-z0-9][a-z0-9-]{0,40})$/.exec(type)?.[1] ?? null;

export const isKnownTransition = (type: string, customNames: ReadonlySet<string> = new Set()): boolean => {
  if (isBuiltinTransition(type)) return true;
  const name = customTransitionName(type);
  return name !== null && customNames.has(name);
};

export const clampDuration = (ms: number): number => (Number.isFinite(ms) ? Math.min(MAX_TRANSITION_MS, Math.max(0, Math.round(ms))) : 0);
export const safeEasing = (easing: string): string => (EASING.test(easing.trim()) ? easing.trim() : DEFAULT_EASING);

const num = (v: unknown, fallback: number, min: number, max: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);

const DIRECTIONS = ['left', 'right', 'up', 'down'] as const;

/** 와이프가 지나가는 방향: 나가는 신이 그 방향으로 걷혀 나간다. */
function wipeInset(direction: (typeof DIRECTIONS)[number]): string {
  switch (direction) {
    case 'left':
      return 'inset(0 0 0 100%)'; // 오른쪽에서 왼쪽으로 걷힌다
    case 'right':
      return 'inset(0 100% 0 0)';
    case 'up':
      return 'inset(0 0 100% 0)';
    case 'down':
      return 'inset(100% 0 0 0)';
  }
}

/** 내장 전환 하나의 계획. 알 수 없는 type이면 null. 파라미터는 범위로 고정한다(에이전트·사용자 입력은 신뢰하지 않는다). */
export function planBuiltin(spec: TransitionSpec): TransitionPlan | null {
  if (!isBuiltinTransition(spec.type)) return null;
  const easing = safeEasing(spec.easing);
  const durationMs = spec.type === 'cut' ? 0 : clampDuration(spec.durationMs);
  const p = spec.params;
  const base = { durationMs, easing, to: null };
  switch (spec.type) {
    case 'cut':
      return { ...base, from: [{ opacity: 1 }, { opacity: 0 }] };
    case 'crossfade':
      return { ...base, from: [{ opacity: 1 }, { opacity: 0 }] };
    case 'slide-left':
      return { ...base, from: [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }] };
    case 'slide-right':
      return { ...base, from: [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }] };
    case 'slide-up':
      return { ...base, from: [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }] };
    case 'slide-down':
      return { ...base, from: [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }] };
    case 'mask-wipe':
      return { ...base, from: [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: wipeInset(pick(p.direction, DIRECTIONS, 'left')) }] };
    case 'circular-reveal': {
      const at = `${num(p.x, 50, 0, 100)}% ${num(p.y, 50, 0, 100)}%`;
      return { ...base, from: [{ clipPath: `circle(75% at ${at})` }, { clipPath: `circle(0% at ${at})` }] };
    }
    case 'zoom-through':
      return { ...base, from: [{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${num(p.scale, 2.2, 1.1, 6)})`, opacity: 0 }] };
  }
}
