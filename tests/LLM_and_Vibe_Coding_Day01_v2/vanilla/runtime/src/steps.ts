// 정적 페이지(static)의 스텝 진행(D-032): 사용자 입력(클릭·키·선택지)이 있어야만 다음 스텝으로 간다. 타이머·자동 진행은 없다.
// `scene.json.steps[].advance`: `click` | `key:<Key>` | `choice:<label>`. 마지막 스텝에서 입력이 들어오면 `done`을 알린다
// (시퀀스 엣지의 trigger가 평가된다). 플레이그라운드 호스트는 Bridge `next`/`prev`로 입력을 위임할 수 있다.
import { useEffect, useRef, useState } from 'react';
import type { Bridge } from './bridge';
import { hostedBridge } from './hostedBridge';

export interface StepSpec {
  id: string;
  advance: string;
}

export type AdvanceInput = { kind: 'click' } | { kind: 'key'; key: string } | { kind: 'choice'; label: string };

export function matchesAdvance(advance: string, input: AdvanceInput): boolean {
  if (input.kind === 'click') return advance === 'click';
  if (input.kind === 'key') return advance === `key:${input.key}`;
  return advance === `choice:${input.label}`;
}

export interface StepController {
  readonly index: number;
  readonly total: number;
  readonly finished: boolean;
  /** 사용자 입력. 현재 스텝의 advance와 맞을 때만 진행한다. 진행했으면 true. */
  input(input: AdvanceInput): boolean;
  /** 호스트가 위임한 진행(Bridge `next`): 입력 종류와 무관하게 한 칸 간다. */
  next(): void;
  prev(): void;
}

export interface StepEvents {
  onStep?: (index: number, total: number) => void;
  onDone?: () => void;
  onChoice?: (label: string) => void;
}

export function createStepController(steps: readonly StepSpec[], events: StepEvents = {}): StepController {
  let index = 0;
  let finished = false;
  const total = Math.max(steps.length, 1); // 스크롤형 페이지는 스텝 1개로 본다
  const report = () => events.onStep?.(index, total);

  const advance = () => {
    if (finished) return;
    if (index < total - 1) {
      index += 1;
      report();
    } else {
      finished = true;
      events.onDone?.();
    }
  };

  /** 마지막 스텝의 진행 규칙. `finished` 뒤 재입력 매칭에도 쓴다. */
  const lastRule = (): string | null => {
    const step = steps[total - 1];
    if (step) return step.advance;
    return null; // 스크롤형 페이지(scroll): 아래 input()의 폴백 규칙과 같아야 한다
  };

  return {
    get index() {
      return index;
    },
    total,
    get finished() {
      return finished;
    },
    input(input) {
      if (finished) {
        // 끝난 뒤의 입력: 마지막 스텝 규칙과 맞을 때만 `done`을 다시 알린다.
        // 호스트가 엣지와 맞지 않는 입력으로 끝낸 경우(멈춤) 올바른 입력으로 복구할 수 있다.
        const rule = lastRule();
        const expected = rule ?? (input.kind === 'key' && (input.key === 'Enter' || input.key === ' ') ? `key:${input.key}` : 'click');
        if (!matchesAdvance(expected, input)) return false;
        if (input.kind === 'choice') events.onChoice?.(input.label);
        events.onDone?.();
        return true;
      }
      const step = steps[index];
      // 스텝이 없는 페이지(scroll)는 클릭과 Enter/Space를 입력으로 본다.
      const rule = step ? step.advance : input.kind === 'key' && (input.key === 'Enter' || input.key === ' ') ? `key:${input.key}` : 'click';
      if (!matchesAdvance(rule, input)) return false;
      if (input.kind === 'choice') events.onChoice?.(input.label);
      advance();
      return true;
    },
    next: advance,
    prev() {
      // 끝난 뒤의 prev는 마지막 스텝으로 되돌린다(호스트가 잘못된 입력으로 끝낸 경우의 복구).
      if (finished) {
        finished = false;
        report();
        return;
      }
      if (index === 0) return;
      index -= 1;
      report();
    },
  };
}

// 호스트(Bridge)가 위임하는 next/prev를 받을 현재 컨트롤러. 한 페이지에 하나다.
let hosted: StepController | null = null;
export const hostedSteps = (): StepController | null => hosted;

/**
 * 스텝 진행 훅: 창의 클릭·키 입력을 컨트롤러에 넣고, 진행 상황을 Bridge로 알린다.
 * 반환값은 컨트롤러이며, 렌더에는 `onStep` 콜백으로 현재 인덱스를 옮긴다.
 */
export function useSteps(steps: readonly StepSpec[], bridge?: Bridge | null, onStep?: (index: number) => void): StepController {
  const latest = useRef({ onStep, bridge: bridge ?? null });
  useEffect(() => {
    latest.current = { onStep, bridge: bridge ?? null };
  }, [onStep, bridge]);

  // 컨트롤러는 한 번만 만들고, 콜백은 항상 최신 onStep·bridge를 읽는다(렌더 중에는 ref를 읽지 않는다).
  // eslint-disable-next-line react-hooks/refs -- 아래 콜백은 렌더가 아니라 사용자 입력 때 실행된다
  const [controller] = useState(() =>
    createStepController(steps, {
      // `bridge`를 넘기지 않으면 마운트가 만든 호스트 Bridge를 쓴다(신 컴포넌트는 Bridge를 직접 얻을 방법이 없다).
      onStep: (i, total) => {
        latest.current.onStep?.(i);
        (latest.current.bridge ?? hostedBridge())?.step(i, total);
      },
      onDone: () => (latest.current.bridge ?? hostedBridge())?.done(),
      onChoice: (label) => (latest.current.bridge ?? hostedBridge())?.choice(label),
    }),
  );

  useEffect(() => {
    hosted = controller;
    const onClick = () => controller.input({ kind: 'click' });
    const onKey = (e: KeyboardEvent) => controller.input({ kind: 'key', key: e.key });
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
      if (hosted === controller) hosted = null;
    };
  }, [controller]);

  return controller;
}
