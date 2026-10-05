import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { applyNodeChanges, Panel, ReactFlowProvider, useReactFlow, type NodeChange, type Viewport } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceCanvas } from '@/components/canvas/WorkspaceCanvas';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { createScene, listScenes, type SceneEntry, type WorkspaceRef } from '@/lib/scene/files';
import { readSequence, writeSequence } from '@/lib/sequence/file';
import { addNode, moveNodes, reconcile, type Sequence } from '@/lib/sequence/schema';
import { projectPath } from '@/lib/workspace/files';
import { NewSceneDialog, type NewSceneValues } from './NewSceneDialog';
import { SceneNode, type SceneFlowNode } from './SceneNode';

const nodeTypes = { scene: SceneNode };

export interface SceneWorkspaceProps {
  root: string;
  workspace: WorkspaceRef;
  initialView?: Viewport;
  onViewChange?: (view: Viewport) => void;
}

interface Loaded {
  entries: SceneEntry[];
  sequence: Sequence;
}

function buildNodes(loaded: Loaded, onOpenFolder: (slug: string) => void): SceneFlowNode[] {
  const pos = new Map(loaded.sequence.nodes.map((n) => [n.sceneId, n.pos]));
  let broken = 0;
  return loaded.entries.map((e): SceneFlowNode => {
    const s = e.scene;
    if (!s) {
      // scene.json을 읽지 못한 폴더: id가 없어 시퀀스에 넣지 못하므로 아래 줄에 임시 배치한다.
      const position = { x: (broken++ % 4) * 300, y: 600 + Math.floor(broken / 4) * 300 };
      return { id: `slug:${e.slug}`, type: 'scene', position, draggable: false, data: { slug: e.slug, name: e.slug, type: 'static', status: 'draft', referenceCount: 0, error: e.error ?? 'invalid', onOpenFolder } };
    }
    return {
      id: s.id,
      type: 'scene',
      position: pos.get(s.id) ?? { x: 0, y: 0 },
      data: {
        slug: e.slug,
        name: s.name,
        type: s.type,
        status: s.status,
        duration: s.type === 'static' ? undefined : s.duration.seconds,
        referenceCount: s.references.length,
        onOpenFolder,
      },
    };
  });
}

function Inner({ root, workspace, initialView, onViewChange }: SceneWorkspaceProps) {
  const { t } = useLanguage();
  const rf = useReactFlow();
  const [nodes, setNodes] = useState<SceneFlowNode[]>([]);
  const [dialog, setDialog] = useState<{ x: number; y: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sequence = useRef<Sequence | null>(null);

  const openFolder = useCallback(
    (slug: string) => {
      void invoke('reveal_in_explorer', { path: projectPath(root, `scenes/${slug}`), workspaceRoot: root }).catch(() => undefined);
    },
    [root],
  );

  const fetchAll = useCallback(async (): Promise<Loaded> => {
    const entries = await listScenes(root);
    const current = await readSequence(root, workspace.id);
    const next = reconcile(
      current,
      entries.flatMap((e) => (e.scene ? [e.scene.id] : [])),
    );
    if (next !== current) await writeSequence(root, next);
    return { entries, sequence: next };
  }, [root, workspace.id]);

  const apply = useCallback(
    (loaded: Loaded) => {
      sequence.current = loaded.sequence;
      setNodes(buildNodes(loaded, openFolder));
      setLoadError(null);
    },
    [openFolder],
  );

  const fail = useCallback((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)), []);

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then((l) => !cancelled && apply(l))
      .catch((e: unknown) => !cancelled && fail(e));
    return () => {
      cancelled = true;
    };
  }, [fetchAll, apply, fail]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns) as SceneFlowNode[]), []);

  const onNodeDragStop = useCallback(
    (_: unknown, __: unknown, dragged: { id: string; position: { x: number; y: number } }[]) => {
      const seq = sequence.current;
      if (!seq) return;
      const next = moveNodes(seq, Object.fromEntries(dragged.map((n) => [n.id, n.position])));
      sequence.current = next;
      void writeSequence(root, next).catch(() => undefined);
    },
    [root],
  );

  async function onCreate(values: NewSceneValues) {
    const pos = dialog ?? { x: 0, y: 0 };
    const { scene } = await createScene(root, workspace, values);
    const seq = addNode(sequence.current ?? (await readSequence(root, workspace.id)), scene.id, pos);
    sequence.current = seq;
    await writeSequence(root, seq);
    apply(await fetchAll());
  }

  const centerPos = () => rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const view = useMemo(() => initialView, [initialView]);

  return (
    <>
      <WorkspaceCanvas
        nodes={nodes}
        nodeTypes={nodeTypes}
        initialView={view}
        onViewChange={onViewChange}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          setDialog(rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        }}
      >
        <Panel position="top-left">
          <Button size="sm" onClick={() => setDialog(centerPos())} aria-label={t('scene.add')}>
            <Plus className="mr-1 h-4 w-4" />
            {t('scene.add')}
          </Button>
        </Panel>
        {loadError && (
          <Panel position="top-center">
            <p role="alert" className="rounded bg-destructive/10 px-3 py-1 text-xs text-destructive">{`${t('scene.loadFailed')} (${loadError})`}</p>
          </Panel>
        )}
      </WorkspaceCanvas>
      <NewSceneDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)} onCreate={onCreate} />
    </>
  );
}

export function SceneWorkspace(props: SceneWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
