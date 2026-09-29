import { parseDesign, type ParsedDesign } from '@/lib/design/parse';

/** DESIGN.md 텍스트를 안전하게 파싱한다(YAML 오류는 issues로 돌려준다). */
export function safeParseDesign(text: string): ParsedDesign {
  try {
    return parseDesign(text);
  } catch (e) {
    return {
      tokens: { colors: {}, typography: {}, spacing: {}, rounded: {}, components: {} },
      colors: {},
      issues: [e instanceof Error ? e.message : String(e)],
    };
  }
}
