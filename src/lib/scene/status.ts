import type { GuideState } from '@/lib/guides/guideMd';
import type { Scene, SceneStatus } from './schema';

// 신 상태(draft · prompt-ready · generated · needs-revision)를 파일 상태에서 파생한다(Refactor-Spec-v2 §3.2, R-10).
// 변경 보고는 기존 파일 감시(watch.rs)가 루트 상대 경로 묶음으로 준다. 이 모듈은 순수 함수만 둔다.

const SCENE_PATH = /^scenes\/([a-z0-9][a-z0-9-]*)\/(.*)$/;

/** `scenes/<slug>/...` 경로의 slug. 신 폴더 밖이면 null. */
export function sceneSlugOf(path: string): string | null {
  return SCENE_PATH.exec(path.replace(/\\/g, '/'))?.[1] ?? null;
}

/** 변경 경로를 신 slug별로 묶는다. 신 폴더 밖 경로는 other에 둔다. */
export function groupChanges(paths: string[]): { bySlug: Map<string, string[]>; other: string[] } {
  const bySlug = new Map<string, string[]>();
  const other: string[] = [];
  for (const raw of paths) {
    const path = raw.replace(/\\/g, '/');
    const slug = sceneSlugOf(path);
    if (slug === null) other.push(path);
    else bySlug.set(slug, [...(bySlug.get(slug) ?? []), path]);
  }
  return { bySlug, other };
}

// 앱이 쓰는 워크스페이스 파일. 에이전트가 신 작업 중에 건드려도 경고하지 않는다.
const APP_OWNED = new Set(['workspace.json', 'sequence.json']);

/** 에이전트가 `activeSlug` 신에서 작업하는 동안 그 폴더 밖에서 일어난 쓰기(경고 대상). 터미널 실행(V4)에서 연결한다. */
export function outsideWrites(paths: string[], activeSlug: string): string[] {
  return paths.map((p) => p.replace(/\\/g, '/')).filter((p) => sceneSlugOf(p) !== activeSlug && !APP_OWNED.has(p));
}

export const isPromptReady = (scene: Scene): boolean => scene.userPrompt.trim() !== '' || scene.brief.subject.trim() !== '';

export interface StatusInput {
  scene: Scene;
  /** `src/index.html`이 있는가. */
  entryExists: boolean;
  /** 디스크 GUIDE.md와 현재 scene.json의 관계(checkGuide). */
  guide: GuideState;
}

/**
 * 파일 상태에서 본 신 상태. 현재 상태와 같으면 저장할 일이 없다.
 * - 엔트리가 있고 아직 생성 전(draft·prompt-ready)이면 generated.
 * - generated인데 scene.json이 GUIDE.md 렌더 이후 바뀌었으면(stale) needs-revision.
 * - needs-revision은 다시 생성(V4)할 때까지 유지한다.
 * - 엔트리가 없으면 generated·needs-revision은 입력 유무에 따라 prompt-ready·draft로 되돌린다.
 */
export function evaluateStatus({ scene, entryExists, guide }: StatusInput): SceneStatus {
  const cur = scene.status;
  if (entryExists) {
    if (cur === 'draft' || cur === 'prompt-ready') return 'generated';
    if (cur === 'generated' && guide === 'stale') return 'needs-revision';
    return cur;
  }
  if (cur === 'generated' || cur === 'needs-revision') return isPromptReady(scene) ? 'prompt-ready' : 'draft';
  if (cur === 'draft' && isPromptReady(scene)) return 'prompt-ready';
  if (cur === 'prompt-ready' && !isPromptReady(scene)) return 'draft';
  return cur;
}
