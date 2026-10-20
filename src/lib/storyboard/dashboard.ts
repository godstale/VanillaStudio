import type { Scene } from '@/lib/scene/schema';
import type { Sequence } from '@/lib/sequence/schema';

/** edge 식별자 목록을 `값 ×횟수` 요약 문자열로 묶는다. trigger·transition.type 같은 ID라 번역하지 않는다. */
export function summarizeValues(values: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([v, n]) => (n > 1 ? `${v} ×${n}` : v)).join(' · ');
}

/** 시퀀스 엣지의 trigger 분포 요약. 엣지가 없으면 빈 문자열. */
export function triggerSummary(sequence: Sequence | null): string {
  if (!sequence || sequence.edges.length === 0) return '';
  return summarizeValues(sequence.edges.map((e) => e.trigger));
}

/** 시퀀스 엣지의 전이 분포 요약. 엣지가 없으면 빈 문자열. */
export function transitionSummary(sequence: Sequence | null): string {
  if (!sequence || sequence.edges.length === 0) return '';
  return summarizeValues(sequence.edges.map((e) => e.transition.type));
}

/** 시퀀스 노드 순서(0-based). 시퀀스가 없거나 포함되지 않으면 -1. */
export function sceneOrder(sequence: Sequence | null, sceneId: string): number {
  if (!sequence) return -1;
  return sequence.nodes.findIndex((n) => n.sceneId === sceneId);
}

export interface SceneEdgeInfo {
  order: number;
  /** 들어오는 엣지 `전이 · 트리거` 목록. */
  incoming: string[];
  /** 나가는 엣지 `전이 · 트리거` 목록. */
  outgoing: string[];
}

/** 신 하나에 이어진 엣지를 진입·진출로 나눈다. */
export function sceneEdges(sequence: Sequence | null, sceneId: string): SceneEdgeInfo {
  if (!sequence) return { order: -1, incoming: [], outgoing: [] };
  const label = (trigger: string, type: string) => `${type} · ${trigger}`;
  return {
    order: sceneOrder(sequence, sceneId),
    incoming: sequence.edges.filter((e) => e.to === sceneId).map((e) => label(e.trigger, e.transition.type)),
    outgoing: sequence.edges.filter((e) => e.from === sceneId).map((e) => label(e.trigger, e.transition.type)),
  };
}

/** static은 스텝 수(scroll은 1페이지라 1), motion·3d는 비트 수. */
export function stepCountOf(scene: Scene): number {
  if (scene.type === 'static') return scene.mode === 'steps' ? scene.steps.length : 1;
  return scene.beats.length;
}
