import { safeParseDesign } from '@/components/design/safeParseDesign';
import { CORE_ROLES, contrastReport } from '@/lib/design/roles';
import type { ParsedDesign } from '@/lib/design/parse';

export interface ContrastRow {
  pair: string;
  ratio: number;
  min: number;
  ok: boolean;
}

export interface DesignCheck {
  parsed: ParsedDesign;
  /** 구조·토큰 참조·필수 색 역할·색 형식 문제 */
  issues: string[];
  /** 필수 색 역할이 모두 있을 때만 계산한다. */
  contrast: ContrastRow[];
  /** 대비 기준을 넘지 못한 쌍의 수 */
  contrastFailures: number;
}

/** 디자인 탭의 "검사 결과": 파서 이슈 + 텍스트/배경 역할 쌍의 WCAG 대비. */
export function checkDesign(text: string): DesignCheck {
  const parsed = safeParseDesign(text);
  const hasCore = CORE_ROLES.every((r) => Boolean(parsed.tokens.colors[r]));
  let contrast: ContrastRow[] = [];
  if (hasCore) {
    try {
      contrast = contrastReport(parsed.colors);
    } catch {
      // A color that fails to parse is already listed in `issues`.
      contrast = [];
    }
  }
  return {
    parsed,
    issues: parsed.issues,
    contrast,
    contrastFailures: contrast.filter((r) => !r.ok).length,
  };
}
