import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { addNode, newSequence, type Sequence } from '@/lib/sequence/schema';
import { useSequenceEdges, type SceneInfo } from './useSequenceEdges';

const scenes = new Map<string, SceneInfo>([
  ['scn_a', { type: 'motion', name: 'Intro' }],
  ['scn_b', { type: 'static', name: 'Page' }],
  ['scn_c', { type: '3d', name: 'Globe' }],
]);
const seq0 = (): Sequence => ['scn_a', 'scn_b', 'scn_c'].reduce<Sequence>((s, id) => addNode(s, id, { x: 0, y: 0 }), { ...newSequence('ws_1'), mode: 'interactive' });

function setup(initial: Sequence = seq0(), extra: { onEdgeSelected?: () => void } = {}) {
  let current = initial;
  const commit = vi.fn((next: Sequence) => {
    current = next;
    hook.rerender();
    return true;
  });
  const hook = renderHook(() => useSequenceEdges({ sequence: current, workspaceId: 'ws_1', scenes, customTransitions: new Set(), commit, ...extra }));
  return { hook, commit, get seq() { return current; } };
}

const conn = (source: string, target: string) => ({ source, target, sourceHandle: null, targetHandle: null });

describe('useSequenceEdges', () => {
  it('connecting two scenes adds an edge with a default trigger and selects it', () => {
    const onEdgeSelected = vi.fn();
    const s = setup(seq0(), { onEdgeSelected });
    act(() => s.hook.result.current.onConnect(conn('scn_a', 'scn_b')));
    expect(s.seq.edges).toHaveLength(1);
    expect(s.seq.edges[0]).toMatchObject({ from: 'scn_a', to: 'scn_b', trigger: 'end' });
    expect(s.hook.result.current.selectedEdge).toBe(0);
    expect(onEdgeSelected).toHaveBeenCalled();
    expect(s.hook.result.current.edges).toMatchObject([{ id: 'edge-0', source: 'scn_a', target: 'scn_b', label: 'end', animated: true, selected: true }]);
  });

  it('a static scene gets click, later branches become named choices (shown by label)', () => {
    const s = setup();
    act(() => s.hook.result.current.onConnect(conn('scn_b', 'scn_a')));
    act(() => s.hook.result.current.onConnect(conn('scn_b', 'scn_c')));
    expect(s.seq.edges.map((e) => e.trigger)).toEqual(['click', 'choice:Globe']);
    expect(s.hook.result.current.edges.map((e) => e.label)).toEqual(['click', 'Globe']);
    expect(s.hook.result.current.edges[0].animated).toBe(false);
  });

  it('ignores self connections, unknown scenes and duplicates', () => {
    const s = setup();
    act(() => s.hook.result.current.onConnect(conn('scn_a', 'scn_a')));
    act(() => s.hook.result.current.onConnect(conn('scn_a', 'scn_ghost')));
    expect(s.commit).not.toHaveBeenCalled();
    act(() => s.hook.result.current.onConnect(conn('scn_a', 'scn_b')));
    act(() => s.hook.result.current.onConnect(conn('scn_a', 'scn_b')));
    expect(s.commit).toHaveBeenCalledTimes(1);
    expect(s.hook.result.current.selectedEdge).toBe(0);
  });

  it('deleting removes the edge (several at once, from the back) and clears the selection', () => {
    const s = setup();
    act(() => s.hook.result.current.onConnect(conn('scn_a', 'scn_b')));
    act(() => s.hook.result.current.onConnect(conn('scn_b', 'scn_c')));
    act(() => s.hook.result.current.onConnect(conn('scn_c', 'scn_a')));
    act(() => s.hook.result.current.onEdgesChange([{ type: 'remove', id: 'edge-0' }, { type: 'remove', id: 'edge-1' }]));
    expect(s.seq.edges.map((e) => e.from)).toEqual(['scn_c']);
    expect(s.hook.result.current.selectedEdge).toBeNull();
  });

  it('selection changes follow xyflow', () => {
    const s = setup();
    act(() => s.hook.result.current.onConnect(conn('scn_a', 'scn_b')));
    act(() => s.hook.result.current.clearEdge());
    expect(s.hook.result.current.selectedEdge).toBeNull();
    act(() => s.hook.result.current.onEdgesChange([{ type: 'select', id: 'edge-0', selected: true }]));
    expect(s.hook.result.current.selectedEdge).toBe(0);
    act(() => s.hook.result.current.onEdgesChange([{ type: 'select', id: 'edge-0', selected: false }]));
    expect(s.hook.result.current.selectedEdge).toBeNull();
  });

  it('reconnect moves an end; the edge keeps its trigger', () => {
    const s = setup();
    act(() => s.hook.result.current.onConnect(conn('scn_a', 'scn_b')));
    act(() => s.hook.result.current.onReconnect({ id: 'edge-0', source: 'scn_a', target: 'scn_b' }, conn('scn_a', 'scn_c')));
    expect(s.seq.edges[0]).toMatchObject({ from: 'scn_a', to: 'scn_c', trigger: 'end' });
  });

  it('update and delete the selected edge from the inspector', () => {
    const s = setup();
    act(() => s.hook.result.current.onConnect(conn('scn_a', 'scn_b')));
    act(() => s.hook.result.current.updateSelected({ trigger: 'click' }));
    expect(s.seq.edges[0].trigger).toBe('click');
    act(() => s.hook.result.current.deleteSelected());
    expect(s.seq.edges).toEqual([]);
    expect(s.hook.result.current.selectedEdge).toBeNull();
  });

  it('validation errors mark the edge and are listed', () => {
    const s = setup();
    act(() => s.hook.result.current.onConnect(conn('scn_b', 'scn_a'))); // static → click: fine
    act(() => s.hook.result.current.updateSelected({ trigger: 'end' })); // static + auto: error
    const issues = s.hook.result.current.issues;
    expect(issues.some((i) => i.code === 'static-auto-trigger' && i.edge === 0)).toBe(true);
    expect(s.hook.result.current.edges[0]).toMatchObject({ className: 'vs-edge-error', data: { error: true } });
  });

  it('a commit that is refused keeps the old state', () => {
    let current = seq0();
    const commit = vi.fn(() => false);
    const hook = renderHook(() => useSequenceEdges({ sequence: current, workspaceId: 'ws_1', scenes, customTransitions: new Set(), commit }));
    act(() => hook.result.current.onConnect(conn('scn_a', 'scn_b')));
    expect(commit).toHaveBeenCalledOnce();
    expect(hook.result.current.selectedEdge).toBeNull();
    expect(current.edges).toEqual([]);
    current = seq0();
  });
});
