import { z } from 'zod';
import { canonicalStringify } from '@/lib/json/canonical';

// sequence.json 계약(Refactor-Spec-v2 §5.2). 워크스페이스 1개 = 시퀀스 1개(D-029).
// V2는 노드 위치만 쓴다. 엣지·전환 편집과 교차 검증(static 신 trigger, 도달성)은 V6에서 이 스키마 위에 얹는다.

const sceneId = z.string().regex(/^scn_[A-Za-z0-9]+$/);

export const nodeSchema = z
  .object({
    sceneId,
    pos: z.object({ x: z.number(), y: z.number() }).strict(),
  })
  .strict();

export const transitionSchema = z
  .object({
    type: z.string().min(1),
    durationMs: z.number().int().min(0),
    easing: z.string(),
    params: z.record(z.string(), z.unknown()),
  })
  .strict();

export const edgeSchema = z
  .object({
    from: sceneId,
    to: sceneId,
    trigger: z.string().regex(/^(end|click|key:.+|timeout:\d+(\.\d+)?s|choice:.+)$/, 'invalid trigger'),
    transition: transitionSchema,
  })
  .strict();

export const sequenceSchema = z
  .object({
    version: z.literal(1),
    workspaceId: z.string().min(1),
    id: z.string().min(1),
    mode: z.enum(['linear', 'interactive']),
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
    start: sceneId.nullable(),
  })
  .strict()
  .superRefine((seq, ctx) => {
    const ids = new Set<string>();
    seq.nodes.forEach((n, i) => {
      if (ids.has(n.sceneId)) ctx.addIssue({ code: 'custom', path: ['nodes', i, 'sceneId'], message: `duplicate node ${n.sceneId}` });
      ids.add(n.sceneId);
    });
    seq.edges.forEach((e, i) => {
      if (!ids.has(e.from)) ctx.addIssue({ code: 'custom', path: ['edges', i, 'from'], message: `unknown node ${e.from}` });
      if (!ids.has(e.to)) ctx.addIssue({ code: 'custom', path: ['edges', i, 'to'], message: `unknown node ${e.to}` });
    });
    if (seq.start !== null && !ids.has(seq.start)) ctx.addIssue({ code: 'custom', path: ['start'], message: 'start must be a node' });
  });

export type Sequence = z.infer<typeof sequenceSchema>;
export type SequenceNode = z.infer<typeof nodeSchema>;

export const SEQUENCE_FILE = 'sequence.json';

export function newSequence(workspaceId: string): Sequence {
  return { version: 1, workspaceId, id: 'seq_main', mode: 'linear', nodes: [], edges: [], start: null };
}

export function parseSequence(text: string): Sequence {
  return sequenceSchema.parse(JSON.parse(text));
}

export function serializeSequence(seq: Sequence): string {
  return canonicalStringify(sequenceSchema.parse(seq));
}

const round = (n: number) => Math.round(n * 100) / 100;

/** 노드를 추가한다. 이미 있으면 그대로 둔다. 첫 노드는 start가 된다. */
export function addNode(seq: Sequence, id: string, pos: { x: number; y: number }): Sequence {
  if (seq.nodes.some((n) => n.sceneId === id)) return seq;
  return {
    ...seq,
    nodes: [...seq.nodes, { sceneId: id, pos: { x: round(pos.x), y: round(pos.y) } }],
    start: seq.start ?? id,
  };
}

export function moveNodes(seq: Sequence, positions: Record<string, { x: number; y: number }>): Sequence {
  return {
    ...seq,
    nodes: seq.nodes.map((n) => (positions[n.sceneId] ? { ...n, pos: { x: round(positions[n.sceneId].x), y: round(positions[n.sceneId].y) } } : n)),
  };
}

/** 노드와 그 노드에 닿는 엣지를 지운다. start였다면 남은 첫 노드로 옮긴다. */
export function removeNode(seq: Sequence, id: string): Sequence {
  const nodes = seq.nodes.filter((n) => n.sceneId !== id);
  return {
    ...seq,
    nodes,
    edges: seq.edges.filter((e) => e.from !== id && e.to !== id),
    start: seq.start === id ? (nodes[0]?.sceneId ?? null) : seq.start,
  };
}

/** 디스크의 신 목록과 노드 목록을 맞춘다: 없는 신의 노드는 빼고, 노드가 없는 신은 격자 위치로 추가한다. */
export function reconcile(seq: Sequence, sceneIds: string[]): Sequence {
  const known = new Set(sceneIds);
  let next = seq;
  for (const n of seq.nodes) if (!known.has(n.sceneId)) next = removeNode(next, n.sceneId);
  const have = new Set(next.nodes.map((n) => n.sceneId));
  let slot = next.nodes.length;
  for (const id of sceneIds) {
    if (have.has(id)) continue;
    next = addNode(next, id, { x: (slot % 4) * 300, y: Math.floor(slot / 4) * 300 });
    slot += 1;
  }
  return next;
}
