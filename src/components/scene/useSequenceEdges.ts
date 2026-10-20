import { useCallback, useMemo, useState } from 'react';
import { MarkerType, type Connection, type Edge, type EdgeChange } from '@xyflow/react';
import type { SceneType } from '@/lib/scene/schema';
import { connectScenes, edgeId, edgeIndex, reconnectEdge, removeEdgeAt, triggerKind, updateEdge, type SeqEdge } from '@/lib/sequence/edit';
import type { Sequence } from '@/lib/sequence/schema';
import { validateSequence, type SequenceIssue } from '@/lib/sequence/validate';

// 캔버스의 엣지 편집(T6.2): 시퀀스 → xyflow 엣지, 연결·삭제·재연결·선택 → 시퀀스 연산, 시퀀스 검증 결과.

export interface SceneInfo {
  type: SceneType;
  name: string;
}

export interface UseSequenceEdgesArgs {
  sequence: Sequence | null;
  workspaceId: string;
  scenes: ReadonlyMap<string, SceneInfo>;
  customTransitions: ReadonlySet<string>;
  /** 새 시퀀스를 저장한다. 저장할 수 없으면 false. */
  commit: (next: Sequence) => boolean;
  /** 엣지를 고르면 노드 선택을 풀기 위해 알린다. */
  onEdgeSelected?: () => void;
}

const triggerLabel = (trigger: string): string => (triggerKind(trigger) === 'choice' ? trigger.slice('choice:'.length) : trigger);

export function useSequenceEdges({ sequence, workspaceId, scenes, customTransitions, commit, onEdgeSelected }: UseSequenceEdgesArgs) {
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);

  const issues = useMemo<SequenceIssue[]>(() => (sequence ? validateSequence(sequence, { workspaceId, scenes, customTransitions }) : []), [sequence, workspaceId, scenes, customTransitions]);

  const edges = useMemo<Edge[]>(() => {
    if (!sequence) return [];
    const nodeIds = new Set(sequence.nodes.map((n) => n.sceneId));
    const errorEdges = new Set(issues.filter((i) => i.severity === 'error' && i.edge !== undefined).map((i) => i.edge));
    return sequence.edges.flatMap((e, i): Edge[] => {
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) return [];
      const bad = errorEdges.has(i);
      return [
        {
          id: edgeId(i),
          source: e.from,
          target: e.to,
          label: triggerLabel(e.trigger),
          selected: selectedEdge === i,
          // 시간이 지나면 저절로 넘어가는 엣지는 움직이는 점선으로 구분한다.
          animated: e.trigger === 'end' || e.trigger.startsWith('timeout:'),
          markerEnd: { type: MarkerType.ArrowClosed },
          className: bad ? 'vs-edge-error' : undefined,
          data: { error: bad },
          interactionWidth: 24,
        },
      ];
    });
  }, [sequence, issues, selectedEdge]);

  const select = useCallback(
    (index: number | null) => {
      setSelectedEdge(index);
      if (index !== null) onEdgeSelected?.();
    },
    [onEdgeSelected],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!sequence || !c.source || !c.target || c.source === c.target) return;
      const from = scenes.get(c.source);
      const to = scenes.get(c.target);
      if (!from || !to) return;
      const r = connectScenes(sequence, c.source, c.target, from.type, to.name);
      if (!r) return;
      if (r.created && !commit(r.sequence)) return;
      select(r.index);
    },
    [sequence, scenes, commit, select],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!sequence) return;
      const removed = changes.flatMap((c) => (c.type === 'remove' ? [edgeIndex(c.id)] : [])).filter((i): i is number => i !== null);
      if (removed.length > 0) {
        // 뒤에서부터 지워야 앞쪽 인덱스가 밀리지 않는다.
        const next = [...new Set(removed)].sort((a, b) => b - a).reduce((s, i) => removeEdgeAt(s, i), sequence);
        if (commit(next)) setSelectedEdge(null);
        return;
      }
      for (const c of changes) {
        if (c.type !== 'select') continue;
        const i = edgeIndex(c.id);
        if (i === null) continue;
        if (c.selected) select(i);
        else setSelectedEdge((cur) => (cur === i ? null : cur));
      }
    },
    [sequence, commit, select],
  );

  const onReconnect = useCallback(
    (old: Edge, c: Connection) => {
      const i = edgeIndex(old.id);
      if (!sequence || i === null || !c.source || !c.target || c.source === c.target) return;
      const next = reconnectEdge(sequence, i, { from: c.source, to: c.target });
      if (next !== sequence) commit(next);
    },
    [sequence, commit],
  );

  const updateSelected = useCallback(
    (patch: Partial<Pick<SeqEdge, 'trigger' | 'transition'>>) => {
      if (sequence && selectedEdge !== null) commit(updateEdge(sequence, selectedEdge, patch));
    },
    [sequence, selectedEdge, commit],
  );

  const deleteSelected = useCallback(() => {
    if (sequence && selectedEdge !== null && commit(removeEdgeAt(sequence, selectedEdge))) setSelectedEdge(null);
  }, [sequence, selectedEdge, commit]);

  return { edges, issues, selectedEdge, clearEdge: () => setSelectedEdge(null), onConnect, onEdgesChange, onReconnect, updateSelected, deleteSelected };
}
