import { applyMarkers, readSection } from '@/lib/guides/markers';

// DESIGN.md 본문의 "분위기(mood)" 규약 구간(Refactor-Spec-v2 §5.3): `<!-- vanilla:begin:mood -->` 안의 `- 키워드` 목록.
// 앱은 이 구간만 쓰고 본문의 나머지 바이트는 보존한다(AGENTS.md §4-6).

const ID = 'mood';

export function readMood(designText: string): string[] {
  const body = readSection(designText, ID);
  if (body === null) return [];
  return body
    .split('\n')
    .map((l) => /^\s*[-*]\s+(.*\S)\s*$/.exec(l)?.[1])
    .filter((v): v is string => Boolean(v));
}

/** 키워드 목록을 mood 구간에 쓴다. 구간이 없으면 본문 끝에 `## Mood`와 함께 덧붙인다. */
export function writeMood(designText: string, keywords: readonly string[]): string {
  const list = keywords.map((k) => k.trim()).filter(Boolean);
  const body = `## Mood\n\n${list.length ? list.map((k) => `- ${k}`).join('\n') : '_(none)_'}`;
  return applyMarkers(designText, [{ id: ID, body }]);
}
