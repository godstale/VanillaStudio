// 마운트가 만든 호스트 Bridge를 신 컴포넌트가 쓸 수 있게 두는 자리. 한 페이지에 하나다(`mountVanilla`가 설정·해제한다).
import type { Bridge } from './bridge';

let current: Bridge | null = null;

export const hostedBridge = (): Bridge | null => current;

/** 마운트가 Bridge를 만들면 등록하고, 정리할 때 자기 것이면 해제한다. */
export function setHostedBridge(bridge: Bridge | null): void {
  current = bridge;
}
