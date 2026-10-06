import type { SceneType } from '@/lib/scene/schema';
import type { Sequence } from './schema';

// 시퀀스 교차 검증(T6.1, D-025·D-032). 스키마(schema.ts)가 형태와 노드·엣지 참조를 본다면, 여기서는 신 정보와 그래프 성질을 본다:
// workspaceId 일치, 노드가 실제 신인가, static 신의 사용자 입력 전용 trigger, 모호한 분기, 입력 없는 순환, 모드별 규칙, 시작 신 도달성.
// 오류(error)가 있으면 재생·저장을 막고, 경고(warning)는 표시만 한다.

export type IssueCode =
  | 'workspace-mismatch'
  | 'unknown-scene'
  | 'static-auto-trigger'
  | 'duplicate-trigger'
  | 'auto-cycle'
  | 'linear-branch'
  | 'linear-choice'
  | 'no-start'
  | 'unreachable';

export interface SequenceIssue {
  code: IssueCode;
  severity: 'error' | 'warning';
  message: string;
  /** 관련 엣지(`edges[]` 인덱스). */
  edge?: number;
  /** 관련 노드(sceneId). */
  scene?: string;
}

export interface SceneRef {
  type: SceneType;
  name: string;
}

export interface ValidateContext {
  /** `workspace.json.workspaceId`. */
  workspaceId: string;
  /** 디스크에 있는 신(sceneId → 정보). */
  scenes: ReadonlyMap<string, SceneRef>;
}

/** 시간이 흐르면 저절로 일어나는 trigger. 나머지는 사용자 입력(click·key·choice)이다. */
export const isAutoTrigger = (trigger: string): boolean => trigger === 'end' || trigger.startsWith('timeout:');

/** 사용자 입력 trigger만 허용하는 신 타입(D-032). */
export const requiresUserInput = (type: SceneType): boolean => type === 'static';

/** 자동 엣지만으로 이루어진 순환에 속하는 노드. 입력이 한 번도 필요 없어 영원히 도는 경우다. */
function autoCycleNodes(seq: Sequence): Set<string> {
  const next = new Map<string, string[]>();
  for (const e of seq.edges) if (isAutoTrigger(e.trigger)) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  const state = new Map<string, 'visiting' | 'done'>();
  const onCycle = new Set<string>();
  const stack: string[] = [];
  const visit = (id: string) => {
    state.set(id, 'visiting');
    stack.push(id);
    for (const to of next.get(id) ?? []) {
      if (state.get(to) === 'visiting') for (const n of stack.slice(stack.indexOf(to))) onCycle.add(n);
      else if (!state.has(to)) visit(to);
    }
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of next.keys()) if (!state.has(id)) visit(id);
  return onCycle;
}

function reachableFrom(seq: Sequence, start: string): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const e of seq.edges) {
      if (e.from === cur && !seen.has(e.to)) {
        seen.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return seen;
}

export function validateSequence(seq: Sequence, ctx: ValidateContext): SequenceIssue[] {
  const issues: SequenceIssue[] = [];
  const add = (i: SequenceIssue) => issues.push(i);
  const label = (id: string) => ctx.scenes.get(id)?.name ?? id;

  if (seq.workspaceId !== ctx.workspaceId) {
    add({ code: 'workspace-mismatch', severity: 'error', message: `sequence.json belongs to workspace ${seq.workspaceId}, not ${ctx.workspaceId}` });
  }

  for (const n of seq.nodes) {
    if (!ctx.scenes.has(n.sceneId)) add({ code: 'unknown-scene', severity: 'error', scene: n.sceneId, message: `node ${n.sceneId} has no scene folder` });
  }

  seq.edges.forEach((e, i) => {
    const from = ctx.scenes.get(e.from);
    if (from && requiresUserInput(from.type) && isAutoTrigger(e.trigger)) {
      add({ code: 'static-auto-trigger', severity: 'error', edge: i, scene: e.from, message: `${label(e.from)} is a static page: it can only move on by user input (click, key or choice), not "${e.trigger}"` });
    }
    if (seq.mode === 'linear' && e.trigger.startsWith('choice:')) {
      add({ code: 'linear-choice', severity: 'error', edge: i, scene: e.from, message: `choice triggers need the interactive mode (${label(e.from)} → ${label(e.to)})` });
    }
  });

  // 같은 신에서 같은 trigger로 나가는 엣지가 둘이면 어디로 갈지 알 수 없다.
  const seen = new Map<string, number>();
  seq.edges.forEach((e, i) => {
    const key = `${e.from}\u0000${e.trigger}`;
    if (seen.has(key)) add({ code: 'duplicate-trigger', severity: 'error', edge: i, scene: e.from, message: `${label(e.from)} has two edges with the trigger "${e.trigger}"` });
    else seen.set(key, i);
  });

  if (seq.mode === 'linear') {
    const out = new Map<string, number>();
    for (const e of seq.edges) out.set(e.from, (out.get(e.from) ?? 0) + 1);
    for (const [id, count] of out) {
      if (count > 1) add({ code: 'linear-branch', severity: 'error', scene: id, message: `${label(id)} has ${count} outgoing edges; a linear sequence allows one (use the interactive mode to branch)` });
    }
  }

  for (const id of autoCycleNodes(seq)) {
    add({ code: 'auto-cycle', severity: 'error', scene: id, message: `${label(id)} is in a loop that never waits for input and would play forever` });
  }

  if (seq.nodes.length > 0) {
    if (seq.start === null) {
      add({ code: 'no-start', severity: 'error', message: 'the sequence has scenes but no start scene' });
    } else {
      const reach = reachableFrom(seq, seq.start);
      for (const n of seq.nodes) {
        if (!reach.has(n.sceneId)) add({ code: 'unreachable', severity: 'warning', scene: n.sceneId, message: `${label(n.sceneId)} cannot be reached from the start scene` });
      }
    }
  }
  return issues;
}

export const hasErrors = (issues: readonly SequenceIssue[]): boolean => issues.some((i) => i.severity === 'error');
