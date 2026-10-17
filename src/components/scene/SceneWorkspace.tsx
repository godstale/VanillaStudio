import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { applyNodeChanges, Panel, ReactFlowProvider, useReactFlow, type NodeChange, type Viewport } from '@xyflow/react';
import { MessageSquare, Plus, Share2, PackageOpen, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceCanvas } from '@/components/canvas/WorkspaceCanvas';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { usePreviewWatch } from '@/lib/review/watchClient';
import { createScene, deleteScene, listScenes, refreshStatuses, type SceneEntry, type WorkspaceRef } from '@/lib/scene/files';
import { TemplatesProvider } from '@/components/guides/TemplatesContext';
import { useTemplates } from '@/components/guides/templatesContextValue';
import { useSafeTerminals } from '@/components/terminal/terminalContextValue';
import { groupChanges, outsideWrites } from '@/lib/scene/status';
import { loadThumbnail } from '@/lib/scene/thumbnail';
import { readSequence, writeSequence } from '@/lib/sequence/file';
import { addNode, moveNodes, reconcile, removeNode, type Sequence } from '@/lib/sequence/schema';
import { checkSavable, setMode } from '@/lib/sequence/edit';
import { loadCustomTransitions } from '@/lib/playground/transitions/custom';
import { EdgeSection } from '@/components/inspector/EdgeSection';
import { SequenceIssues } from './SequenceIssues';
import { useSequenceEdges, type SceneInfo } from './useSequenceEdges';
import { ExportDialog, ImportDialog } from '@/components/package/PackageDialogs';
import { usedTemplateDirs } from '@/lib/package/manifest';
import { projectPath } from '@/lib/workspace/files';
import { NewSceneDialog, type NewSceneValues } from './NewSceneDialog';
import { CommentToolbox } from '@/components/comments/CommentToolbox';
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

function buildNodes(loaded: Loaded, onOpenFolder: (slug: string) => void, onPlay?: (slug: string) => void): SceneFlowNode[] {
  const pos = new Map(loaded.sequence.nodes.map((n) => [n.sceneId, n.pos]));
  let broken = 0;
  return loaded.entries.map((e): SceneFlowNode => {
    const s = e.scene;
    if (!s) {
      // scene.json을 읽지 못한 폴더: id가 없어 시퀀스에 넣지 못하므로 아래 줄에 임시 배치한다.
      const position = { x: (broken++ % 4) * 300, y: 600 + Math.floor(broken / 4) * 300 };
      return { id: `slug:${e.slug}`, type: 'scene', position, draggable: false, data: { slug: e.slug, name: e.slug, type: 'static', status: 'draft', referenceCount: 0, error: e.error ?? 'invalid', onOpenFolder, onPlay } };
    }
    return {
      id: s.id,
      type: 'scene',
      deletable: false, // 신은 폴더와 1:1이라 키보드로 지우지 않는다
      position: pos.get(s.id) ?? { x: 0, y: 0 },
      data: {
        slug: e.slug,
        name: s.name,
        type: s.type,
        status: s.status,
        duration: s.type === 'static' ? undefined : s.duration.seconds,
        referenceCount: s.references.length,
        onOpenFolder,
        onPlay,
      },
    };
  });
}

function Inner({ root, workspace: workspaceProp, initialView, onViewChange }: SceneWorkspaceProps) {
  // 부모가 매 렌더 새 객체를 넘겨도 콜백·효과가 다시 만들어지지 않게 값으로 고정한다.
  const workspace = useMemo(() => ({ id: workspaceProp.id, name: workspaceProp.name }), [workspaceProp.id, workspaceProp.name]);
  const { t } = useLanguage();
  const rf = useReactFlow();
  const { catalog, resolve, reload: reloadTemplates } = useTemplates();
  const [packageDialog, setPackageDialog] = useState<'export' | 'import' | null>(null);
  const [nodes, setNodes] = useState<SceneFlowNode[]>([]);
  const [entries, setEntries] = useState<SceneEntry[]>([]);
  const [dialog, setDialog] = useState<{ x: number; y: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sequence = useRef<Sequence | null>(null);
  const [seq, setSeq] = useState<Sequence | null>(null);
  const [seqError, setSeqError] = useState<string | null>(null);
  const [customNames, setCustomNames] = useState<ReadonlySet<string>>(new Set());
  const entriesRef = useRef<SceneEntry[]>([]);
  const [outside, setOutside] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const terminals = useSafeTerminals();
  const sessionsRef = useRef(terminals?.sessions);
  useEffect(() => {
    sessionsRef.current = terminals?.sessions;
  }, [terminals?.sessions]);
  const reloadRef = useRef<() => void>(() => undefined);
  const navigate = useNavigate();
  // 재생 버튼은 신 화면으로 이동해 거기서 디자인·동작·재생을 확인한다.
  const onPlay = useCallback(
    (slug: string) => {
      const id = entriesRef.current.find((e) => e.slug === slug)?.scene?.id;
      if (id) navigate(`/scenes?scene=${encodeURIComponent(id)}`);
    },
    [navigate],
  );

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
      setSeq(loaded.sequence);
      entriesRef.current = loaded.entries;
      setEntries(loaded.entries);
      // 선택 상태는 다시 읽어도 유지한다.
      setNodes((prev) => {
        const selected = new Set(prev.filter((n) => n.selected).map((n) => n.id));
        return buildNodes(loaded, openFolder, onPlay).map((n) => (selected.has(n.id) ? { ...n, selected: true } : n));
      });
      setLoadError(null);
    },
    [openFolder, onPlay],
  );

  const fail = useCallback((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)), []);

  useEffect(() => {
    reloadRef.current = () => void fetchAll().then(apply).catch(fail);
  }, [fetchAll, apply, fail]);

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then((l) => !cancelled && apply(l))
      .catch((e: unknown) => !cancelled && fail(e));
    return () => {
      cancelled = true;
    };
  }, [fetchAll, apply, fail]);

  // 저장된 썸네일은 신이 목록에 들어올 때 한 번 읽는다(이후 갱신은 미리보기가 onThumbnail로 알린다).
  useEffect(() => {
    let cancelled = false;
    for (const e of entries) {
      if (thumbs[e.slug] || !e.scene) continue;
      loadThumbnail(root, e.slug)
        .then((url) => url && !cancelled && setThumbs((m) => (m[e.slug] ? m : { ...m, [e.slug]: url })))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [entries, root, thumbs]);

  const startId = seq?.start ?? null;
  const viewNodes = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, thumbnail: thumbs[n.data.slug] ?? n.data.thumbnail, isStart: n.id === startId } })), [nodes, thumbs, startId]);

  // 신 폴더 안의 파일이 바뀌면(에이전트·사용자 편집) 짧게 모아서 다시 읽는다.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  usePreviewWatch(root, {
    onBatch: (paths) => {
      if (paths.some((p) => p.replace(/\\/g, '/').startsWith('transitions/'))) loadCustomRef.current();
      // 에이전트가 도는 동안 그 신 폴더 밖에서 일어난 쓰기는 경고한다(R-10, AGENTS.md §4-8). 실행 중인 신이 여럿이면 어느 신에도 속하지 않는 경로만.
      const active = [...new Set((sessionsRef.current ?? []).filter((s) => s.status === 'running' || s.status === 'starting').map((s) => s.sceneSlug))];
      if (active.length > 0) {
        const stray = active.map((slug) => outsideWrites(paths, slug)).reduce((acc, list) => acc.filter((p) => list.includes(p)));
        if (stray.length > 0) setOutside((prev) => [...new Set([...prev, ...stray])].slice(-20));
      }
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
      const current = sequence.current;
      if (!current) return;
      const next = moveNodes(current, Object.fromEntries(dragged.map((n) => [n.id, n.position])));
      sequence.current = next;
      setSeq(next);
      void writeSequence(root, next).catch(() => undefined);
    },
    [root],
  );

  async function onCreate(values: NewSceneValues) {
    const pos = dialog ?? { x: 0, y: 0 };
    const { scene } = await createScene(root, workspace, values);
    const added = addNode(sequence.current ?? (await readSequence(root, workspace.id)), scene.id, pos);
    sequence.current = added;
    setSeq(added);
    await writeSequence(root, added);
    apply(await fetchAll());
  }

  const selected = nodes.find((n) => n.selected && !n.data.error);
  const selectedEntry = selected ? entries.find((e) => e.scene?.id === selected.id) : undefined;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 선택한 신을 폴더째 휴지통으로 옮기고 시퀀스에서도 뺀다.
  const deleteSelected = useCallback(async () => {
    if (!selectedEntry?.scene) return;
    setDeleteError(null);
    try {
      await deleteScene(root, selectedEntry.slug);
      const current = sequence.current;
      if (current) {
        const next = removeNode(current, selectedEntry.scene.id);
        sequence.current = next;
        setSeq(next);
        await writeSequence(root, next);
      }
      setConfirmDelete(false);
      apply(await fetchAll());
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    }
  }, [selectedEntry, root, apply, fetchAll]);

  // 코멘트 툴박스에 넘길 신 목록(참조가 바뀌지 않게 고정해 불필요한 다시 읽기를 막는다).
  const commentScenes = useMemo(
    () => entries.flatMap((e) => (e.scene ? [{ slug: e.slug, sceneId: e.scene.id, name: e.scene.name }] : [])),
    [entries],
  );
  const [commentsOpen, setCommentsOpen] = useState(true);

  // 시퀀스 편집(T6.2): 저장할 수 없는 값은 파일에 쓰지 않고 이유를 보여 준다.
  const commitSequence = useCallback(
    (next: Sequence): boolean => {
      const why = checkSavable(next);
      setSeqError(why);
      if (why) return false;
      sequence.current = next;
      setSeq(next);
      void writeSequence(root, next).catch((e: unknown) => setSeqError(e instanceof Error ? e.message : String(e)));
      return true;
    },
    [root],
  );
  const sceneInfos = useMemo(() => new Map<string, SceneInfo>(entries.flatMap((e) => (e.scene ? [[e.scene.id, { type: e.scene.type, name: e.scene.name }] as const] : []))), [entries]);
  const deselectNodes = useCallback(() => setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n))), []);
  const seqEdges = useSequenceEdges({ sequence: seq, workspaceId: workspace.id, scenes: sceneInfos, customTransitions: customNames, commit: commitSequence, onEdgeSelected: deselectNodes });
  const edgeSelected = seqEdges.selectedEdge !== null && seq?.edges[seqEdges.selectedEdge] ? seq.edges[seqEdges.selectedEdge] : null;
  const edgeIssues = useMemo(() => seqEdges.issues.filter((i) => i.edge === seqEdges.selectedEdge), [seqEdges.issues, seqEdges.selectedEdge]);

  // 선언형 사용자 전환(`transitions/*.json`)은 처음과 그 폴더가 바뀔 때 다시 읽는다.
  const loadCustom = useCallback(() => {
    void loadCustomTransitions(root).then((r) => setCustomNames(new Set(r.defs.keys())), () => undefined);
  }, [root]);
  useEffect(loadCustom, [loadCustom]);
  const loadCustomRef = useRef(loadCustom);
  useEffect(() => {
    loadCustomRef.current = loadCustom;
  }, [loadCustom]);

  // 저장하면 파일 감시가 다시 읽어 노드에 반영한다. 여기서는 파일만 쓴다.
  const centerPos = () => rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const view = useMemo(() => initialView, [initialView]);

  return (
    <>
      <WorkspaceCanvas
        nodes={viewNodes}
        edges={seqEdges.edges}
        onConnect={seqEdges.onConnect}
        onEdgesChange={seqEdges.onEdgesChange}
        onReconnect={seqEdges.onReconnect}
        onPaneClick={seqEdges.clearEdge}
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
        <Panel position="top-left" className="flex items-center gap-2">
          <Button size="sm" onClick={() => setDialog(centerPos())} aria-label={t('scene.add')}>
            <Plus className="mr-1 h-4 w-4" />
            {t('scene.add')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPackageDialog('export')} aria-label={t('package.menu.export')}>
            <Share2 className="mr-1 h-4 w-4" />
            {t('package.menu.export')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPackageDialog('import')} aria-label={t('package.menu.import')}>
            <PackageOpen className="mr-1 h-4 w-4" />
            {t('package.menu.import')}
          </Button>
          {seq && (
            <select
              aria-label={t('sequence.mode')}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={seq.mode}
              onChange={(e) => commitSequence(setMode(seq, e.target.value as Sequence['mode']))}
            >
              <option value="linear">{t('sequence.mode.linear')}</option>
              <option value="interactive">{t('sequence.mode.interactive')}</option>
            </select>
          )}
        </Panel>
        {(seqEdges.issues.length > 0 || seqError) && (
          <Panel position="bottom-right">
            <SequenceIssues issues={seqEdges.issues} saveError={seqError} />
          </Panel>
        )}
        {outside.length > 0 && (
          <Panel position="bottom-left">
            <div role="alert" data-testid="outside-writes" className="max-w-sm rounded bg-warning/15 px-3 py-2 text-xs text-warning">
              <p className="font-medium">{t('scene.outsideWrites')}</p>
              <ul className="mt-1 list-disc pl-4 break-all">
                {outside.slice(-5).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <button type="button" className="mt-1 underline" onClick={() => setOutside([])}>
                {t('scene.outsideWritesDismiss')}
              </button>
            </div>
          </Panel>
        )}
        {edgeSelected && seq && (
          <Panel position="top-center">
            <div className="w-80 rounded-lg border border-border bg-card p-2 text-xs shadow-lg" data-testid="edge-panel">
              <EdgeSection
                key={seqEdges.selectedEdge}
                edge={edgeSelected}
                fromName={sceneInfos.get(edgeSelected.from)?.name ?? edgeSelected.from}
                toName={sceneInfos.get(edgeSelected.to)?.name ?? edgeSelected.to}
                fromType={sceneInfos.get(edgeSelected.from)?.type ?? 'motion'}
                customTransitions={[...customNames]}
                issues={edgeIssues}
                onChange={seqEdges.updateSelected}
                onDelete={seqEdges.deleteSelected}
              />
            </div>
          </Panel>
        )}
        {!loadError && (
          <Panel position="top-right">
            {commentsOpen ? (
              <div className="flex max-h-[60vh] w-72 flex-col rounded-lg border border-border bg-card p-2 shadow-lg">
                <button
                  type="button"
                  aria-label={t('float.close')}
                  onClick={() => setCommentsOpen(false)}
                  className="self-end rounded p-0.5 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <CommentToolbox root={root} scenes={commentScenes} />
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setCommentsOpen(true)}>
                <MessageSquare className="mr-1 h-3.5 w-3.5" />
                {t('comments.title')}
              </Button>
            )}
          </Panel>
        )}
        {selectedEntry?.scene && (
          <Panel position="bottom-center">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-lg" data-testid="scene-actions">
              {confirmDelete ? (
                <>
                  <span className="max-w-64 truncate">{t('scene.deleteConfirm', { name: selectedEntry.scene.name })}</span>
                  <Button size="sm" variant="destructive" onClick={() => void deleteSelected()}>
                    {t('scene.confirmDelete')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    {t('scene.cancel')}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {t('scene.delete')}
                </Button>
              )}
              {deleteError && (
                <span role="alert" className="text-destructive">{t('scene.deleteFailed', { reason: deleteError })}</span>
              )}
            </div>
          </Panel>
        )}
        {loadError && (
          <Panel position="top-center">
            <p role="alert" className="rounded bg-destructive/10 px-3 py-1 text-xs text-destructive">{`${t('scene.loadFailed')} (${loadError})`}</p>
          </Panel>
        )}
      </WorkspaceCanvas>
      <ExportDialog
        open={packageDialog === 'export'}
        onOpenChange={(o) => !o && setPackageDialog(null)}
        root={root}
        workspaceName={workspace.name}
        selected={selectedEntry?.scene ? { slug: selectedEntry.slug, name: selectedEntry.scene.name } : null}
        templates={(scope) => usedTemplateDirs((scope === 'scene' && selectedEntry?.scene ? [selectedEntry.scene] : entries.flatMap((e) => (e.scene ? [e.scene] : []))), (dir) => catalog.get(dir.slice('guide-templates/'.length))?.source === 'workspace')}
      />
      <ImportDialog
        open={packageDialog === 'import'}
        onOpenChange={(o) => !o && setPackageDialog(null)}
        root={root}
        workspace={workspace}
        resolverAfterTemplates={async () => {
          const fresh = await reloadTemplates();
          return (scene) => fresh.get(scene.template)?.template ?? null;
        }}
        onImported={() => reloadRef.current()}
      />
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
