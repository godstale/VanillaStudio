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
import type { InspectorTab } from '@/components/inspector/inspectorTabs';
import { TemplatesProvider } from '@/components/guides/TemplatesContext';
import { useTemplates } from '@/components/guides/templatesContextValue';
import { useSafeTerminals } from '@/components/terminal/terminalContextValue';
import { promptForAnalysis, promptForScene } from '@/lib/agents/clipboard';
import { groupChanges, outsideWrites } from '@/lib/scene/status';
import { loadThumbnail } from '@/lib/scene/thumbnail';
import { changedSinceSettled } from '@/lib/scene/revision';
import { readSequence, writeSequence } from '@/lib/sequence/file';
import { addNode, moveNodes, reconcile, type Sequence } from '@/lib/sequence/schema';
import { projectPath } from '@/lib/workspace/files';
import { DiffDialog } from './DiffDialog';
import { NewSceneDialog, type NewSceneValues } from './NewSceneDialog';
import { useRunReview } from './useRunReview';
import { SceneNode, type SceneFlowNode } from './SceneNode';

const nodeTypes = { scene: SceneNode };

export interface SceneWorkspaceProps {
  root: string;
  workspace: WorkspaceRef;
  initialView?: Viewport;
  onViewChange?: (view: Viewport) => void;
  /** workspace.json의 기본 에이전트 id. */
  defaultAgent?: string;
  /** workspace.json.canvas. 미리보기에 주입한다. */
  canvas?: { width: number; height: number; fps: number };
}

interface Loaded {
  entries: SceneEntry[];
  sequence: Sequence;
}

function buildNodes(loaded: Loaded, onOpenFolder: (slug: string) => void, onRunAgent?: (slug: string) => void, onPlay?: (slug: string) => void): SceneFlowNode[] {
  const pos = new Map(loaded.sequence.nodes.map((n) => [n.sceneId, n.pos]));
  let broken = 0;
  return loaded.entries.map((e): SceneFlowNode => {
    const s = e.scene;
    if (!s) {
      // scene.json을 읽지 못한 폴더: id가 없어 시퀀스에 넣지 못하므로 아래 줄에 임시 배치한다.
      const position = { x: (broken++ % 4) * 300, y: 600 + Math.floor(broken / 4) * 300 };
      return { id: `slug:${e.slug}`, type: 'scene', position, draggable: false, data: { slug: e.slug, name: e.slug, type: 'static', status: 'draft', referenceCount: 0, error: e.error ?? 'invalid', onOpenFolder, onRunAgent, onPlay } };
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
        onRunAgent,
        onPlay,
      },
    };
  });
}

function Inner({ root, workspace: workspaceProp, initialView, onViewChange, defaultAgent, canvas }: SceneWorkspaceProps) {
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
  const entriesRef = useRef<SceneEntry[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [outside, setOutside] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const onThumbnail = useCallback((slug: string, dataUrl: string) => setThumbs((m) => ({ ...m, [slug]: dataUrl })), []);
  const terminals = useSafeTerminals();
  const hasTerminals = terminals !== null;
  const sessionsRef = useRef(terminals?.sessions);
  useEffect(() => {
    sessionsRef.current = terminals?.sessions;
  }, [terminals?.sessions]);
  const reloadRef = useRef<() => void>(() => undefined);
  const onApplied = useCallback(() => reloadRef.current(), []);
  const review = useRunReview({ root, workspace, resolve, terminals, onApplied });
  const beginReview = review.begin;
  const runRef = useRef<(slug: string) => void>(() => undefined);
  const analyzeRef = useRef<(slug: string) => void>(() => undefined);
  // 노드에 넘기는 콜백은 참조가 바뀌지 않게 고정하고, 최신 동작은 ref로 읽는다(터미널 상태가 바뀔 때마다 노드를 다시 만들지 않기 위해).
  const onRunAgent = useCallback((slug: string) => runRef.current(slug), []);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const playRef = useRef<(slug: string) => void>(() => undefined);
  const onPlay = useCallback((slug: string) => playRef.current(slug), []);

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
      entriesRef.current = loaded.entries;
      setEntries(loaded.entries);
      // 선택 상태는 다시 읽어도 유지한다.
      setNodes((prev) => {
        const selected = new Set(prev.filter((n) => n.selected).map((n) => n.id));
        return buildNodes(loaded, openFolder, hasTerminals ? onRunAgent : undefined, canvas ? onPlay : undefined).map((n) => (selected.has(n.id) ? { ...n, selected: true } : n));
      });
      setLoadError(null);
    },
    [openFolder, hasTerminals, onRunAgent, canvas, onPlay],
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

  const viewNodes = useMemo(() => nodes.map((n) => (thumbs[n.data.slug] ? { ...n, data: { ...n.data, thumbnail: thumbs[n.data.slug] } } : n)), [nodes, thumbs]);

  // 신 폴더 안의 파일이 바뀌면(에이전트·사용자 편집) 짧게 모아서 다시 읽는다.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  usePreviewWatch(root, {
    onBatch: (paths) => {
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

  useEffect(() => {
      runRef.current = (slug: string) => {
      const scene = entriesRef.current.find((e) => e.slug === slug)?.scene;
      if (!terminals || !scene) return;
      setRunError(null);
      const template = resolve(scene);
      // 템플릿을 쓸 수 없으면 프롬프트를 만들 수 없다(사용 거부). 클립보드 전달 없이 터미널만 연다.
      beginReview(slug, scene);
      // 수정 필요 상태면 revise 프롬프트에 바뀐 필드를 싣는다(T4.10). 이력을 못 읽어도 실행은 막지 않는다.
      const changed = scene.status === 'needs-revision' ? changedSinceSettled(root, slug, scene).catch(() => []) : Promise.resolve([]);
      changed
        .then((fields) => {
          const prompt = template ? promptForScene({ workspace, scene, template }, fields).text : undefined;
          return terminals.runAgent({ workspaceId: workspace.id, sceneId: scene.id, sceneSlug: slug, sceneName: scene.name, preferredAgentId: defaultAgent, prompt });
        })
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          setRunError(message === 'no-enabled-agent' ? t('scene.noAgent') : t('scene.runFailed', { error: message }));
        });
    };
  }, [terminals, workspace, resolve, defaultAgent, t, beginReview, root]);

  // 레퍼런스 분석 실행(D-026): 분석 프롬프트로 같은 에이전트 터미널을 연다. 결과는 실행 후 검토(diff)를 거친다.
  useEffect(() => {
    analyzeRef.current = (slug: string) => {
      const scene = entriesRef.current.find((e) => e.slug === slug)?.scene;
      if (!terminals || !scene) return;
      const template = resolve(scene);
      if (!template) return;
      setRunError(null);
      beginReview(slug, scene);
      terminals
        .runAgent({ workspaceId: workspace.id, sceneId: scene.id, sceneSlug: slug, sceneName: scene.name, preferredAgentId: defaultAgent, prompt: promptForAnalysis({ workspace, scene, template }) })
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          setRunError(message === 'no-enabled-agent' ? t('scene.noAgent') : t('scene.runFailed', { error: message }));
        });
    };
  }, [terminals, workspace, resolve, defaultAgent, t, beginReview]);
  const onAnalyze = useCallback((slug: string) => analyzeRef.current(slug), []);

  // 노드의 재생 버튼: 그 신을 선택하고 인스펙터의 미리보기 탭을 연다.
  useEffect(() => {
    playRef.current = (slug: string) => {
      const id = entriesRef.current.find((e) => e.slug === slug)?.scene?.id;
      if (!id) return;
      setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
      setInspectorTab('preview');
    };
  }, []);

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
        nodes={viewNodes}
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
        {runError && (
          <Panel position="bottom-center">
            <p role="alert" className="rounded bg-destructive/10 px-3 py-1 text-xs text-destructive">{runError}</p>
          </Panel>
        )}
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
            canvas={canvas}
            tab={inspectorTab}
            onTabChange={setInspectorTab}
            onSave={saveScene}
            onRename={renameSelected}
            onThumbnail={onThumbnail}
            onAnalyze={hasTerminals ? onAnalyze : undefined}
          />
        </SlotPortal>
      )}
      <DiffDialog
        open={review.current !== null}
        sceneName={review.current?.sceneName ?? ''}
        review={review.current?.review ?? null}
        onApprove={() => void review.approve()}
        onRevertDisallowed={() => void review.revertDisallowed()}
        onRevertAll={() => void review.revertAll()}
        onClose={review.dismiss}
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
