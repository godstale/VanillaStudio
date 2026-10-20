import { parse as parseYaml } from 'yaml';
import { DESIGN_PATH, readOptionalFile } from '@/lib/workspace/files';
import { splitFrontMatter } from './frontmatter';
import { parseDesignTokens, resolveDesign, type DesignTokens, type ParsedDesign } from './parse';
import { sceneDesignPath } from './workspaceDesign';

// 신 DESIGN.md의 상속(Technical-Design §4.5): front matter `extends: ../../DESIGN.md`가 있으면 워크스페이스 토큰을 기본으로 하고
// 신에 적힌 토큰만 덮어쓴다. 병합은 참조(`{colors.primary}`) 해석보다 먼저라서 신이 워크스페이스 토큰을 참조할 수 있다.

/** 상속 대상으로 허용하는 유일한 값(워크스페이스 DESIGN.md). 다른 경로는 거부한다(스코프 밖 읽기 방지). */
export const WORKSPACE_EXTENDS = '../../DESIGN.md';

/** front matter의 `extends` 값. 없거나 문자열이 아니면 null. */
export function readExtends(designText: string): string | null {
  const split = splitFrontMatter(designText);
  if (!split.hasFrontMatter) return null;
  try {
    const raw = parseYaml(split.yaml) as { extends?: unknown } | null;
    return typeof raw?.extends === 'string' ? raw.extends.trim() : null;
  } catch {
    return null;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 토큰 표 병합: 신 값이 우선, 표 안의 표(typography·components)는 키 단위로 병합한다. 배열은 신 값이 통째로 대체한다. */
function mergeDeep(base: unknown, over: unknown): unknown {
  if (!isRecord(base) || !isRecord(over)) return over === undefined ? base : over;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in base ? mergeDeep(base[k], v) : v;
  return out;
}

/** 워크스페이스 토큰 위에 신 토큰을 덮는다. `extends` 키 자체는 결과에서 뺀다(이미 해석됨). */
export function mergeTokens(base: DesignTokens, over: DesignTokens): DesignTokens {
  const merged = mergeDeep(base, over) as Record<string, unknown>;
  delete merged.extends;
  return merged as DesignTokens;
}

/**
 * 신 DESIGN.md를 해석한다. `baseText`는 워크스페이스 DESIGN.md(없으면 null).
 * `extends`가 없으면 신 문서만 해석한다. 허용되지 않는 `extends` 값이나 읽을 수 없는 기본은 issue로 남기고 신 문서만 쓴다.
 */
export function parseSceneDesign(sceneText: string, baseText: string | null): ParsedDesign {
  const scene = parseDesignTokens(sceneText);
  const ext = readExtends(sceneText);
  if (ext === null) return resolveDesign(scene.tokens, scene.issues);

  const issues = [...scene.issues];
  if (ext !== WORKSPACE_EXTENDS) {
    issues.push(`extends: only ${WORKSPACE_EXTENDS} is supported (got ${ext})`);
    return resolveDesign(scene.tokens, issues);
  }
  if (baseText === null) {
    issues.push('extends: the workspace DESIGN.md was not found');
    return resolveDesign(scene.tokens, issues);
  }
  const base = parseDesignTokens(baseText);
  issues.push(...base.issues.map((i) => `workspace DESIGN.md: ${i}`));
  return resolveDesign(mergeTokens(base.tokens, scene.tokens), issues);
}

/** 신의 DESIGN.md가 있으면 상속을 해석해 돌려주고, 없으면 워크스페이스 것을 그대로 해석한다. 둘 다 없으면 null. */
export async function loadSceneDesign(root: string, slug: string): Promise<ParsedDesign | null> {
  const [sceneText, baseText] = await Promise.all([readOptionalFile(root, sceneDesignPath(slug)), readOptionalFile(root, DESIGN_PATH)]);
  if (sceneText !== null) return parseSceneDesign(sceneText, baseText);
  return baseText === null ? null : parseSceneDesign(baseText, null);
}
