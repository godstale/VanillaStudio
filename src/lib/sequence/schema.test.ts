import { describe, expect, it } from 'vitest';
import { addNode, moveNodes, newSequence, parseSequence, reconcile, removeNode, sequenceSchema, serializeSequence } from './schema';

const empty = () => newSequence('ws_1');
const edge = (from: string, to: string) => ({
  from,
  to,
  trigger: 'click',
  transition: { type: 'crossfade', durationMs: 600, easing: 'ease-in-out', params: {} },
});

describe('sequence', () => {
  it('round-trips canonically', () => {
    const s = addNode(addNode(empty(), 'scn_a', { x: 1.239, y: 2 }), 'scn_b', { x: 300, y: 0 });
    const text = serializeSequence({ ...s, edges: [edge('scn_a', 'scn_b')] });
    expect(serializeSequence(parseSequence(text))).toBe(text);
    expect(text.indexOf('"workspaceId"')).toBeLessThan(text.indexOf('"nodes"'));
  });

  it('first node becomes start; adding twice is a no-op', () => {
    const s = addNode(empty(), 'scn_a', { x: 0, y: 0 });
    expect(s.start).toBe('scn_a');
    expect(addNode(s, 'scn_a', { x: 9, y: 9 })).toBe(s);
    expect(addNode(s, 'scn_b', { x: 9, y: 9 }).start).toBe('scn_a');
  });

  it('moves and rounds positions', () => {
    const s = moveNodes(addNode(empty(), 'scn_a', { x: 0, y: 0 }), { scn_a: { x: 10.126, y: -3.333 }, scn_zzz: { x: 1, y: 1 } });
    expect(s.nodes).toEqual([{ sceneId: 'scn_a', pos: { x: 10.13, y: -3.33 } }]);
  });

  it('removing a node drops its edges and moves start', () => {
    let s = addNode(addNode(empty(), 'scn_a', { x: 0, y: 0 }), 'scn_b', { x: 1, y: 1 });
    s = { ...s, edges: [edge('scn_a', 'scn_b')] };
    const r = removeNode(s, 'scn_a');
    expect(r.edges).toEqual([]);
    expect(r.start).toBe('scn_b');
    expect(removeNode(r, 'scn_b').start).toBeNull();
  });

  it('rejects dangling edges, bad start, duplicate nodes and bad triggers', () => {
    const a = addNode(empty(), 'scn_a', { x: 0, y: 0 });
    expect(sequenceSchema.safeParse({ ...a, edges: [edge('scn_a', 'scn_x')] }).success).toBe(false);
    expect(sequenceSchema.safeParse({ ...a, start: 'scn_x' }).success).toBe(false);
    expect(sequenceSchema.safeParse({ ...a, nodes: [...a.nodes, ...a.nodes] }).success).toBe(false);
    const b = addNode(a, 'scn_b', { x: 1, y: 1 });
    expect(sequenceSchema.safeParse({ ...b, edges: [{ ...edge('scn_a', 'scn_b'), trigger: 'auto' }] }).success).toBe(false);
  });

  it('reconcile drops missing scenes and places new ones on a grid', () => {
    const base = addNode(addNode(empty(), 'scn_a', { x: 5, y: 5 }), 'scn_gone', { x: 6, y: 6 });
    const r = reconcile(base, ['scn_a', 'scn_new']);
    expect(r.nodes.map((n) => n.sceneId)).toEqual(['scn_a', 'scn_new']);
    expect(r.nodes[0].pos).toEqual({ x: 5, y: 5 });
    expect(sequenceSchema.safeParse(r).success).toBe(true);
  });
});
