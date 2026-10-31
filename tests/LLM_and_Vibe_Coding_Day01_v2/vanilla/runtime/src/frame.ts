// 화면 규격(해상도·fps)은 워크스페이스 전역이다(D-030, `workspace.json.canvas`). 신은 값을 가정하지 않고 이 저장소에서 읽는다.
// 호스트가 Bridge `init`의 `canvas`로 주입하거나, 페이지를 직접 열 때는 `?w=&h=&fps=`로 준다. 둘 다 없으면 1920×1080@30.
import { useSyncExternalStore } from 'react';

export interface Frame {
  width: number;
  height: number;
  fps: number;
}

export const DEFAULT_FRAME: Frame = { width: 1920, height: 1080, fps: 30 };

let current: Frame = DEFAULT_FRAME;
const listeners = new Set<() => void>();

const int = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** 검증을 통과한 값만 받는다. 하나라도 틀리면 null(현재 값 유지). */
export function parseFrame(input: { width?: unknown; height?: unknown; fps?: unknown }): Frame | null {
  const width = int(input.width, 16, 7680);
  const height = int(input.height, 16, 7680);
  const fps = int(input.fps, 1, 120);
  return width !== null && height !== null && fps !== null ? { width, height, fps } : null;
}

/** `?w=1080&h=1920&fps=60`. 없거나 잘못되면 null. */
export function frameFromSearch(search: string): Frame | null {
  const p = new URLSearchParams(search);
  return parseFrame({ width: p.get('w'), height: p.get('h'), fps: p.get('fps') });
}

export function getFrame(): Frame {
  return current;
}

export function setFrame(frame: Frame): void {
  if (frame.width === current.width && frame.height === current.height && frame.fps === current.fps) return;
  current = frame;
  for (const l of listeners) l();
}

/** 테스트·재마운트용: 기본값으로 되돌린다. */
export function resetFrame(): void {
  setFrame(DEFAULT_FRAME);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** 화면 규격을 읽는 훅. 호스트가 규격을 바꾸면 다시 그린다. */
export function useFrame(): Frame {
  return useSyncExternalStore(subscribe, getFrame, getFrame);
}
