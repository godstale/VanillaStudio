// D-032: 정적 페이지는 사용자 입력(클릭·키·선택지)으로만 진행한다. 스텝 편집기가 쓰는 advance 문자열 변환.

export type AdvanceKind = 'click' | 'key' | 'choice';

export function parseAdvance(advance: string): { kind: AdvanceKind; arg: string } {
  if (advance.startsWith('key:')) return { kind: 'key', arg: advance.slice(4) };
  if (advance.startsWith('choice:')) return { kind: 'choice', arg: advance.slice(7) };
  return { kind: 'click', arg: '' };
}

export function buildAdvance(kind: AdvanceKind, arg: string): string {
  return kind === 'click' ? 'click' : `${kind}:${arg}`;
}
