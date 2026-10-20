import type { SceneType } from '@/lib/scene/schema';
import { sequenceSchema, type Sequence } from './schema';

// 시퀀스 편집 연산(T6.2): 캔버스에서 엣지를 잇고 지우고 다시 연결하고, 엣지·시작 신을 바꾼다. 모두 순수 함수이며 결과는 스키마를 통과해야 저장한다.

export type SeqEdge = Sequence['edges'][number];
export type Trigger = SeqEdge['trigger'];

export const DEFAULT_TRANSITION: SeqEdge['transition'] = { type: 'crossfade', durationMs: 600, easing: 'ease-in-out', params: {} };

/** xyflow 엣지 id ↔ 인덱스. 시퀀스의 엣지는 자체 id가 없고 순서가 곧 신원이다. */
export const edgeId = (index: number): string => `edge-${index}`;
export const edgeIndex = (id: string): number | null => {
  const m = /^edge-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
};

export type TriggerKind = 'end' | 'click' | 'key' | 'timeout' | 'choice';

export function triggerKind(trigger: string): TriggerKind {
  if (trigger === 'end' || trigger === 'click') return trigger;
  if (trigger.startsWith('key:')) return 'key';
  if (trigger.startsWith('timeout:')) return 'timeout';
  return 'choice';
}

export const triggerValue = (trigger: string): string => {
  const i = trigger.indexOf(':');
  return i === -1 ? '' : trigger.slice(i + 1);
};

/** 종류와 값으로 trigger 문자열을 만든다. 값이 비면 null(저장할 수 없다). */
export function buildTrigger(kind: TriggerKind, value = ''): Trigger | null {
  const v = value.trim();
  switch (kind) {
    case 'end':
    case 'click':
      return kind;
    case 'key':
      return v ? `key:${v}` : null;
    case 'timeout': {
      const s = Number(v);
      return Number.isFinite(s) && s > 0 ? `timeout:${s}s` : null;
    }
    case 'choice':
      return v ? `choice:${v}` : null;
  }
}

const outgoing = (seq: Sequence, from: string) => seq.edges.filter((e) => e.from === from);

/**
 * 새 엣지의 기본 trigger. 그 신에서 처음 나가는 엣지면 신 타입에 맞는 기본(static=click, 그 밖=end),
 * 이미 쓰였으면 도착 신 이름으로 분기(`choice:<이름>`)한다. 이름도 겹치면 번호를 붙인다.
 */
export function defaultTrigger(seq: Sequence, from: string, fromType: SceneType, toName: string): Trigger {
  const used = new Set(outgoing(seq, from).map((e) => e.trigger));
  const base: Trigger = fromType === 'static' ? 'click' : 'end';
  if (!used.has(base)) return base;
  const label = toName.trim() || 'Next';
  let candidate = `choice:${label}`;
  for (let n = 2; used.has(candidate); n += 1) candidate = `choice:${label} ${n}`;
  return candidate;
}

export interface ConnectResult {
  sequence: Sequence;
  /** 새 엣지의 인덱스. 이미 같은 연결이 있으면 그 엣지. */
  index: number;
  created: boolean;
}

/** 두 신을 잇는다. 같은 from→to가 이미 있으면 새로 만들지 않는다. 노드가 없으면 null. */
export function connectScenes(seq: Sequence, from: string, to: string, fromType: SceneType, toName: string): ConnectResult | null {
  const ids = new Set(seq.nodes.map((n) => n.sceneId));
  if (!ids.has(from) || !ids.has(to)) return null;
  const existing = seq.edges.findIndex((e) => e.from === from && e.to === to);
  if (existing !== -1) return { sequence: seq, index: existing, created: false };
  const edge: SeqEdge = { from, to, trigger: defaultTrigger(seq, from, fromType, toName), transition: { ...DEFAULT_TRANSITION } };
  return { sequence: { ...seq, edges: [...seq.edges, edge] }, index: seq.edges.length, created: true };
}

export function removeEdgeAt(seq: Sequence, index: number): Sequence {
  if (index < 0 || index >= seq.edges.length) return seq;
  return { ...seq, edges: seq.edges.filter((_, i) => i !== index) };
}

export function updateEdge(seq: Sequence, index: number, patch: Partial<Pick<SeqEdge, 'trigger' | 'transition'>>): Sequence {
  if (index < 0 || index >= seq.edges.length) return seq;
  return { ...seq, edges: seq.edges.map((e, i) => (i === index ? { ...e, ...patch } : e)) };
}

/** 엣지의 한쪽 끝을 다른 신으로 옮긴다(trigger·전환은 유지). 같은 from→to가 이미 있거나 노드가 없으면 그대로. */
export function reconnectEdge(seq: Sequence, index: number, ends: { from?: string; to?: string }): Sequence {
  const cur = seq.edges[index];
  if (!cur) return seq;
  const from = ends.from ?? cur.from;
  const to = ends.to ?? cur.to;
  const ids = new Set(seq.nodes.map((n) => n.sceneId));
  if (!ids.has(from) || !ids.has(to)) return seq;
  if (seq.edges.some((e, i) => i !== index && e.from === from && e.to === to)) return seq;
  return { ...seq, edges: seq.edges.map((e, i) => (i === index ? { ...e, from, to } : e)) };
}

export function setStart(seq: Sequence, sceneId: string): Sequence {
  return seq.nodes.some((n) => n.sceneId === sceneId) ? { ...seq, start: sceneId } : seq;
}

export function setMode(seq: Sequence, mode: Sequence['mode']): Sequence {
  return { ...seq, mode };
}

/** 저장해도 되는가(스키마 통과). 안 되면 첫 이유. 시퀀스 의미 검증(validate.ts)과는 별개다. */
export function checkSavable(seq: Sequence): string | null {
  const r = sequenceSchema.safeParse(seq);
  if (r.success) return null;
  const issue = r.error.issues[0];
  return `${issue.path.join('.')} ${issue.message}`.trim();
}
