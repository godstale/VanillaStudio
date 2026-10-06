import { describe, expect, it } from 'vitest';
import { addNode, newSequence, type Sequence } from './schema';
import {
  buildTrigger,
  checkSavable,
  connectScenes,
  defaultTrigger,
  edgeId,
  edgeIndex,
  reconnectEdge,
  removeEdgeAt,
  setMode,
  setStart,
  triggerKind,
  triggerValue,
  updateEdge,
} from './edit';

const base = (): Sequence => ['scn_a', 'scn_b', 'scn_c'].reduce((s, id) => addNode(s, id, { x: 0, y: 0 }), newSequence('ws_1'));

describe('triggers', () => {
  it('classifies and builds triggers', () => {
    expect(['end', 'click', 'key:Enter', 'timeout:3s', 'choice:Yes'].map(triggerKind)).toEqual(['end', 'click', 'key', 'timeout', 'choice']);
    expect(triggerValue('key:ArrowRight')).toBe('ArrowRight');
    expect(triggerValue('choice:A:B')).toBe('A:B');
    expect(triggerValue('end')).toBe('');
    expect(buildTrigger('end')).toBe('end');
    expect(buildTrigger('key', ' Enter ')).toBe('key:Enter');
    expect(buildTrigger('timeout', '2.5')).toBe('timeout:2.5s');
    expect(buildTrigger('timeout', '0')).toBeNull();
    expect(buildTrigger('timeout', 'abc')).toBeNull();
    expect(buildTrigger('choice', '  ')).toBeNull();
    expect(buildTrigger('key', '')).toBeNull();
  });

  it('every trigger it builds passes the schema', () => {
    const seq = base();
    for (const t of ['end', 'click', 'key:ArrowRight', 'timeout:3s', 'timeout:0.5s', 'choice:Go']) {
      const s = { ...seq, edges: [{ from: 'scn_a', to: 'scn_b', trigger: t, transition: { type: 'cut', durationMs: 0, easing: '', params: {} } }] };
      expect(checkSavable(s), t).toBeNull();
    }
  });
});

describe('connectScenes', () => {
  it('first edge from a scene gets the type default: end for timed scenes, click for static', () => {
    expect(connectScenes(base(), 'scn_a', 'scn_b', 'motion', 'B')!.sequence.edges[0]).toMatchObject({ from: 'scn_a', to: 'scn_b', trigger: 'end' });
    expect(connectScenes(base(), 'scn_a', 'scn_b', 'static', 'B')!.sequence.edges[0].trigger).toBe('click');
    expect(connectScenes(base(), 'scn_a', 'scn_b', '3d', 'B')!.sequence.edges[0].transition).toEqual({ type: 'crossfade', durationMs: 600, easing: 'ease-in-out', params: {} });
  });

  it('later edges from the same scene become named choices (unique labels)', () => {
    const one = connectScenes(base(), 'scn_a', 'scn_b', 'motion', 'Next')!;
    const two = connectScenes(one.sequence, 'scn_a', 'scn_c', 'motion', 'Next')!;
    expect(two.sequence.edges[1].trigger).toBe('choice:Next');
    const three = connectScenes({ ...two.sequence, nodes: [...two.sequence.nodes, { sceneId: 'scn_d', pos: { x: 0, y: 0 } }] }, 'scn_a', 'scn_d', 'motion', 'Next')!;
    expect(three.sequence.edges[2].trigger).toBe('choice:Next 2');
    expect(defaultTrigger(base(), 'scn_a', 'motion', '')).toBe('end');
  });

  it('does not duplicate an existing connection and ignores unknown nodes', () => {
    const one = connectScenes(base(), 'scn_a', 'scn_b', 'motion', 'B')!;
    const again = connectScenes(one.sequence, 'scn_a', 'scn_b', 'motion', 'B')!;
    expect(again).toMatchObject({ created: false, index: 0 });
    expect(again.sequence).toBe(one.sequence);
    expect(connectScenes(base(), 'scn_a', 'scn_ghost', 'motion', 'x')).toBeNull();
    expect(connectScenes(base(), 'scn_ghost', 'scn_a', 'motion', 'x')).toBeNull();
  });

  it('the result is saveable', () => {
    expect(checkSavable(connectScenes(base(), 'scn_a', 'scn_b', 'motion', 'B')!.sequence)).toBeNull();
  });
});

describe('edit existing edges', () => {
  const seq = () => connectScenes(connectScenes(base(), 'scn_a', 'scn_b', 'motion', 'B')!.sequence, 'scn_b', 'scn_c', 'motion', 'C')!.sequence;

  it('removes by index and ignores bad indexes', () => {
    expect(removeEdgeAt(seq(), 0).edges.map((e) => e.from)).toEqual(['scn_b']);
    expect(removeEdgeAt(seq(), 9)).toEqual(seq());
    expect(removeEdgeAt(seq(), -1)).toEqual(seq());
  });

  it('updates trigger and transition', () => {
    const s = updateEdge(seq(), 1, { trigger: 'click', transition: { type: 'mask-wipe', durationMs: 800, easing: 'linear', params: { direction: 'left' } } });
    expect(s.edges[1]).toMatchObject({ trigger: 'click', transition: { type: 'mask-wipe', durationMs: 800 } });
    expect(s.edges[0]).toEqual(seq().edges[0]);
    expect(updateEdge(seq(), 5, { trigger: 'click' })).toEqual(seq());
  });

  it('reconnects an end, keeping trigger and transition; refuses duplicates and unknown nodes', () => {
    const moved = reconnectEdge(seq(), 0, { to: 'scn_c' });
    expect(moved.edges[0]).toMatchObject({ from: 'scn_a', to: 'scn_c', trigger: 'end' });
    expect(reconnectEdge(seq(), 0, { to: 'scn_ghost' })).toEqual(seq());
    const dup = reconnectEdge(seq(), 0, { from: 'scn_b', to: 'scn_c' }); // scn_b → scn_c already exists
    expect(dup).toEqual(seq());
    expect(reconnectEdge(seq(), 7, { to: 'scn_c' })).toEqual(seq());
  });

  it('sets the start scene and the mode', () => {
    expect(setStart(seq(), 'scn_c').start).toBe('scn_c');
    expect(setStart(seq(), 'scn_ghost').start).toBe('scn_a');
    expect(setMode(seq(), 'interactive').mode).toBe('interactive');
  });
});

describe('edge ids and savability', () => {
  it('round-trips ids', () => {
    expect(edgeIndex(edgeId(3))).toBe(3);
    expect(edgeIndex('x')).toBeNull();
    expect(edgeIndex('edge-1x')).toBeNull();
  });

  it('reports why a sequence cannot be saved', () => {
    const bad = updateEdge(connectScenes(base(), 'scn_a', 'scn_b', 'motion', 'B')!.sequence, 0, { trigger: 'auto' });
    expect(checkSavable(bad)).toMatch(/trigger/);
  });
});
