import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { applyNodeChanges, Panel, ReactFlowProvider, useReactFlow, type NodeChange, type Viewport } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceCanvas } from '@/components/canvas/WorkspaceCanvas';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { usePreviewWatch } from '@/lib/review/watchClient';
import { createScene, listScenes, refreshStatuses, renameScene, writeScene, type SceneEntry, type WorkspaceRef } from '@/lib/scene/files';
import type { Scene } from '@/lib/scene/schema';
import { SlotPortal } from '@/components/layout/AppShell';
import { SceneInspector } from '@/components/inspector/SceneInspector';
import { TemplatesProvider } from '@/components/guides/TemplatesContext';
import { useTemplates } from '@/components/guides/templatesContextValue';
import { groupChanges } from '@/lib/scene/status';
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

function Inner({ root, workspace: workspaceProp, initialView, onViewChange }: SceneWorkspaceProps) {
  // 부모가 매 렌더 새 객체를 넘겨도 콜백·효과가 다시 만들어지지 않게 값으로 고정한다.
  const workspace = useMemo(() => ({ id: workspaceProp.id, name: workspaceProp.name }), [workspaceProp.id, workspaceProp.name]);
  const { t } = useLanguage();
  const rf = useReactFlow();
  const { catalog, resolve } = useTemplates();
  const [nodes, setNodes] = useState<SceneFlowNode[]>([]);
  const [entries, setEntries] = useState<SceneEntry[]>([]);
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
    let entries = await listScenes(root);
    // 파일 상태(엔트리 유무·GUIDE.md 일치)로 신 상태를 맞춘다. 바뀐 신이 있으면 목록을 다시 읽는다.
    if (await refreshStatuses(root, workspace, entries, resolve)) entries = await listScenes(root);
    const current = await readSequence(root, workspace.id);
    const next = reconcile(
      current,
      entries.flatMap((e) => (e.scene ? [e.scene.id] : [])),
    );
    if (next !== current) await writeSequence(root, next);
    return { entries, sequence: next };
  }, [root, workspace, resolve]);

  const apply = useCallback(
    (loaded: Loaded) => {
      sequence.current = loaded.sequence;
      setEntries(loaded.entries);
      // 선택 상태는 다시 읽어도 유지한다.
      setNodes((prev) => {
        const selected = new Set(prev.filter((n) => n.selected).map((n) => n.id));
        return buildNodes(loaded, openFolder).map((n) => (selected.has(n.id) ? { ...n, selected: true } : n));
      });
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

  // 신 폴더 안의 파일이 바뀌면(에이전트·사용자 편집) 짧게 모아서 다시 읽는다.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  usePreviewWatch(root, {
    onBatch: (paths) => {
      if (groupChanges(paths).bySlug.size === 0) return;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        fetchAll().then(apply).catch(fail);
      }, 300);
    },
  });
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

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

  const selected = nodes.find((n) => n.selected && !n.data.error);
  const selectedEntry = selected ? entries.find((e) => e.scene?.id === selected.id) : undefined;

  // 저장하면 파일 감시가 다시 읽어 노드·인스펙터에 반영한다. 여기서는 파일만 쓴다.
  const saveScene = useCallback(
    async (scene: Scene) => {
      const slug = entries.find((e) => e.scene?.id === scene.id)?.slug;
      if (slug) await writeScene(root, slug, workspace, scene, resolve);
    },
    [entries, root, workspace, resolve],
  );

  const renameSelected = useCallback(
    async (name: string) => {
      if (!selectedEntry) return;
      await renameScene(root, workspace, selectedEntry.slug, name, resolve);
      apply(await fetchAll());
    },
    [selectedEntry, root, workspace, resolve, apply, fetchAll],
  );

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
      {selectedEntry?.scene && (
        <SlotPortal name="inspector">
          <SceneInspector
            key={selectedEntry.scene.id}
            workspace={workspace}
            root={root}
            slug={selectedEntry.slug}
            scene={selectedEntry.scene}
            template={resolve(selectedEntry.scene)}
            templateError={catalog.get(selectedEntry.scene.template)?.error}
            onSave={saveScene}
            onRename={renameSelected}
          />
        </SlotPortal>
      )}
      <NewSceneDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)} onCreate={onCreate} />
    </>
  );
}

export function SceneWorkspace(props: SceneWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <TemplatesProvider root={props.root}>
        <Inner {...props} />
      </TemplatesProvider>
    </ReactFlowProvider>
  );
}
