import type { Scene, SceneType } from '@/lib/scene/schema';

// 에이전트가 scene.json에서 되쓸 수 있는 필드 화이트리스트(Refactor-Spec-v2 §7-4). 신 AGENTS.md·프롬프트·되쓰기 검증이 같은 목록을 쓴다.
// 사용자 입력·불변 필드(id·name·type·template·brief·userPrompt·references·runtime·copy)는 목록에 없다.

const SHARED_TIMED = [
  'duration',
  'creativeMode',
  'structure',
  'adStructure',
  'brandVoice',
  'visualStyle',
  'motionVocabulary',
  'beats',
  'identity',
  'endCard',
  'audio',
  'constraints',
] as const;

const FIELDS: Record<SceneType, readonly string[]> = {
  static: ['mode', 'steps', 'sections', 'layout', 'breakpoints', 'accessibility', 'status'],
  motion: [...SHARED_TIMED, 'status'],
  '3d': [...SHARED_TIMED, 'composition', 'materials', 'lighting', 'cameraPath', 'performanceBudget', 'status'],
};

export function agentWritableFields(type: SceneType): readonly string[] {
  return FIELDS[type];
}

/** 두 scene.json 사이에서 바뀐 최상위 필드 이름(깊은 비교). */
export function changedFields(before: Scene, after: Scene): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const a = before as unknown as Record<string, unknown>;
  const b = after as unknown as Record<string, unknown>;
  return [...keys].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
}

/** 화이트리스트 밖에서 바뀐 필드(경고 대상). */
export function disallowedChanges(before: Scene, after: Scene): string[] {
  const allowed = new Set(agentWritableFields(after.type));
  return changedFields(before, after).filter((k) => !allowed.has(k));
}
