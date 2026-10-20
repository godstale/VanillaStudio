import { changedFields } from '@/lib/guides/writeback';
import type { Scene } from './schema';
import { listSnapshots, readSnapshot } from './writeback';

// 재생성(revise) 흐름(T4.10): 마지막으로 승인·되돌려 확정한 scene.json과 지금 scene.json을 비교해 "바뀐 필드"를 revise 프롬프트에 싣는다.

/** 실행 결과로 확정한 스냅샷 라벨(승인·되돌림). `before-run`은 확정본이 아니다. */
const SETTLED = /^(approved|reverted|reverted-partial)$/;

/** 상태는 파생값이라 비교에서 뺀다. */
const IGNORED = new Set(['status']);

/** 마지막 확정본 대비 바뀐 최상위 필드. 확정본이 없으면 빈 목록(에이전트가 직접 diff). */
export async function changedSinceSettled(root: string, slug: string, scene: Scene): Promise<string[]> {
  const settled = (await listSnapshots(root, slug)).find((s) => SETTLED.test(s.label));
  if (!settled) return [];
  const base = await readSnapshot(root, slug, settled.name).catch(() => null);
  return base ? changedFields(base, scene).filter((f) => !IGNORED.has(f)) : [];
}
