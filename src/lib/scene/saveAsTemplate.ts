import { configurableFields } from '@/lib/guides/merge';
import { duplicateDraft, saveDraft, validateDraft, type TemplateDraft } from '@/lib/guides/templateEditor';
import type { GuideTemplate } from '@/lib/guides/template';
import type { Scene } from './schema';

// 신 템플릿으로 저장(T7.3, D-031): 지금 신의 "구조"를 사용자 정의 가이드 템플릿의 기본값으로 남기고 내용은 비운다. 가이드(규칙·체크리스트·프롬프트)는
// 부모 템플릿을 그대로 확장(`extends`)해서 유지한다. 새 신을 만들 때 이 템플릿을 고르면 같은 구조로 시작한다(`applyTemplateDefaults`).

/** 내용(그 신만의 이야기)이라서 기본값으로 남기지 않는 필드. */
export const CONTENT_FIELDS = new Set(['brief', 'userPrompt', 'references', 'copy', 'identity', 'audio']);

const blank = <T extends Record<string, unknown>>(item: T, keys: string[]): T => ({ ...item, ...Object.fromEntries(keys.map((k) => [k, typeof item[k] === 'string' ? '' : Array.isArray(item[k]) ? [] : item[k]])) });

/**
 * 신에서 구조만 뽑은 기본값. 내용 필드는 빼고, 시간 구조(beats)·정적 단계(steps)는 뼈대(id·시간·역할·입력)만 남기고 문구를 비운다.
 * 반환값은 `scene.json`의 해당 필드 값이라 같은 스키마 검증을 통과해야 한다.
 */
export function structuralDefaults(scene: Scene): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const s = scene as unknown as Record<string, unknown>;
  for (const field of configurableFields(scene.type)) {
    if (CONTENT_FIELDS.has(field) || !(field in s)) continue;
    out[field] = s[field];
  }
  if (Array.isArray(out.beats)) out.beats = (out.beats as Record<string, unknown>[]).map((b) => blank(b, ['copy', 'visual', 'notes']));
  if (Array.isArray(out.steps)) out.steps = (out.steps as Record<string, unknown>[]).map((st) => blank(st, ['title', 'copy']));
  if (out.endCard && typeof out.endCard === 'object') out.endCard = { ...(out.endCard as object), elements: [] };
  return JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
}

export interface SaveAsTemplateResult {
  draft: TemplateDraft;
  template: GuideTemplate;
}

/** `name`에서 템플릿 id(소문자·숫자·`-`)를 만든다. 비면 `scene-template`. */
export function templateIdFromName(name: string): string {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return id || 'scene-template';
}

/**
 * 신 → 템플릿 초안과 검증된 병합 템플릿. `parent`는 이 신이 쓰는 해석 끝난 템플릿이다.
 * 검증에 실패하면 이유와 함께 던진다(저장하지 않는다).
 */
export function buildSceneTemplate(scene: Scene, parent: GuideTemplate, name: string, id: string = templateIdFromName(name)): SaveAsTemplateResult {
  const label = name.trim();
  if (!label) throw new Error('name-required');
  const draft = { ...duplicateDraft(parent, id, { ko: label, en: label }), defaults: structuralDefaults(scene) };
  const checked = validateDraft(draft, parent);
  if (!checked.ok) throw new Error(checked.error);
  return { draft, template: checked.template };
}

/** 검증한 뒤 워크스페이스 `guide-templates/<id>@1/`에 저장한다. 같은 id가 이미 있으면 거부한다(덮어쓰지 않는다). */
export async function saveSceneAsTemplate(root: string, scene: Scene, parent: GuideTemplate, name: string, exists: (ref: string) => boolean): Promise<SaveAsTemplateResult> {
  const result = buildSceneTemplate(scene, parent, name);
  const ref = `${result.draft.id}@${result.draft.version}`;
  if (exists(ref)) throw new Error('template-exists');
  await saveDraft(root, result.draft);
  return result;
}
