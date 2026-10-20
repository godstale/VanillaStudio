import { applyMarkersKeepEol, beginMarker, endMarker, readSection } from '@/lib/guides/markers';

// DESIGN.md의 레퍼런스 분석 구간(D-016, D-026). 에이전트가 갱신할 수 있는 본문의 유일한 구간이고, 그 밖은 사용자 소유라 바이트(줄바꿈 포함)를 보존한다.
// 마커는 저장소의 다른 구간(mood·AGENTS.md)과 같은 형식이다: `<!-- vanilla:begin:analysis -->` … `<!-- vanilla:end:analysis -->`.

export const ANALYSIS_ID = 'analysis';
export const ANALYSIS_BEGIN = beginMarker(ANALYSIS_ID);
export const ANALYSIS_END = endMarker(ANALYSIS_ID);

/** 분석 구간의 본문. 구간이 없으면 null. 마커가 짝이 맞지 않으면 던진다. */
export function readAnalysis(designText: string): string | null {
  return readSection(designText, ANALYSIS_ID);
}

/** 분석 구간을 `body`로 바꾼다(없으면 파일 끝에 만든다). 구간 밖은 그대로다. */
export function writeAnalysis(designText: string, body: string): string {
  return applyMarkersKeepEol(designText, [{ id: ANALYSIS_ID, body: body.replace(/\r\n/g, '\n') }]);
}

/** 구간이 있으면 비우지 않고 그대로 두는 것이 안전한 경우를 위해: 구간이 비었는가. */
export function isAnalysisEmpty(designText: string): boolean {
  const body = readAnalysis(designText);
  return body === null || body.trim() === '';
}
