import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { MessageSquare, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingPanel } from '@/components/layout/FloatingPanel';
import { Onboarding } from '@/components/workspace/Onboarding';
import { SceneInspector } from '@/components/inspector/SceneInspector';
import { DiffDialog } from '@/components/scene/DiffDialog';
import { PreviewPanel } from '@/components/scene/PreviewPanel';
import { useRunReview } from '@/components/scene/useRunReview';
import { CommentToolbox } from '@/components/comments/CommentToolbox';
import { TemplatesProvider } from '@/components/guides/TemplatesContext';
import { useTemplates } from '@/components/guides/templatesContextValue';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { listScenes, renameScene, writeScene, type SceneEntry } from '@/lib/scene/files';
import { loadSceneThumbnail } from '@/lib/scene/thumbnail';
import { readSequence, writeSequence } from '@/lib/sequence/file';
import { setStart, checkSavable } from '@/lib/sequence/edit';
import type { Sequence } from '@/lib/sequence/schema';
import { saveSceneAsTemplate } from '@/lib/scene/saveAsTemplate';
import { changedFields } from '@/lib/guides/writeback';
import { readWorkspace } from '@/lib/workspace/file';
import { projectPath } from '@/lib/workspace/files';
import { recordStudioChange } from '@/lib/workspace/workOrder';
import { cn } from '@/lib/utils';

interface LoadedWorkspace {
  id: string;
  name: string;
  canvas: { width: number; height: number; fps: number };
  defaultAgent?: string;
}

/** 신 화면: 왼쪽 신 목록, 가운데 디자인·동작·재생 확인 + 코멘트, 인스펙터는 플로팅 박스. */
function Inner({ root }: { root: string }) {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const { catalog, resolve, reload: reloadTemplates } = useTemplates();
  const [workspace, setWorkspace] = useState<LoadedWorkspace | null>(null);
  const [entries, setEntries] = useState<SceneEntry[]>([]);
  const [seq, setSeq] = useState<Sequence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // 코멘트는 기본 닫힘. 마지막 상태를 기억한다(뷰어 역할).
  const [commentsOpen, setCommentsOpen] = useState(() => {
    try {
      return localStorage.getItem(`vs_comments_open:${root}`) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`vs_comments_open:${root}`, commentsOpen ? '1' : '0');
    } catch {
      // ignore
    }
  }, [commentsOpen, root]);
  const [menu, setMenu] = useState<{ x: number; y: number; slug: string } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const fetchAll = useCallback(async () => {
    const ws = await readWorkspace(root);
    const [entries, seq] = await Promise.all([listScenes(root), readSequence(root, ws.workspaceId).catch(() => null)]);
    return { ws, entries, seq };
  }, [root]);

  const apply = useCallback((loaded: { ws: { workspaceId: string; name: string; canvas: LoadedWorkspace['canvas']; defaultAgent?: string }; entries: SceneEntry[]; seq: Sequence | null }) => {
    setWorkspace({ id: loaded.ws.workspaceId, name: loaded.ws.name, canvas: loaded.ws.canvas, defaultAgent: loaded.ws.defaultAgent });
    setEntries(loaded.entries);
    setSeq(loaded.seq);
    setError(null);
  }, []);

  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), []);

  const reload = useCallback(() => {
    void fetchAll()
      .then(apply)
      .catch(fail);
  }, [fetchAll, apply, fail]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    for (const e of entries) {
      if (thumbs[e.slug] || !e.scene) continue;
      loadSceneThumbnail(root, e.slug)
        .then((url) => url && !cancelled && setThumbs((m) => (m[e.slug] ? m : { ...m, [e.slug]: url })))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [entries, root, thumbs]);

  const valid = useMemo(() => entries.filter((e) => e.scene), [entries]);
  const selected = useMemo(() => {
    const id = params.get('scene');
    return valid.find((e) => e.scene!.id === id) ?? valid[0];
  }, [valid, params]);
  const selectedStepsTotal = useMemo(() => {
    const s = selected?.scene;
    if (!s || s.type !== 'static') return null;
    return s.mode === 'steps' ? s.steps.length : 1;
  }, [selected]);

  const workspaceRef = useMemo(() => ({ id: workspace?.id ?? '', name: workspace?.name ?? '' }), [workspace]);
  const review = useRunReview({ root, workspace: workspaceRef, resolve, terminals: null, onApplied: () => reload() });

  const commentScenes = useMemo(
    () => (selected?.scene ? [{ slug: selected.slug, sceneId: selected.scene.id, name: selected.scene.name }] : []),
    [selected],
  );

  const openFolder = useCallback(
    (slug: string) => {
      void invoke('reveal_in_explorer', { path: projectPath(root, `scenes/${slug}`), workspaceRoot: root }).catch(() => undefined);
    },
    [root],
  );

  const setStartScene = useCallback(
    (sceneId: string) => {
      setSeq((prev) => {
        if (!prev) return prev;
        const next = setStart(prev, sceneId);
        if (!checkSavable(next)) {
          void writeSequence(root, next).catch(() => undefined);
          return next;
        }
        return prev;
      });
    },
    [root],
  );

  const openMenuScene = useCallback(
    (slug: string) => {
      const id = entries.find((e) => e.slug === slug)?.scene?.id;
      if (id) setParams({ scene: id });
    },
    [entries, setParams],
  );

  if (error) {
    return (
      <p role="alert" className="p-8 text-sm text-destructive">
        {t('scene.loadFailed')} ({error})
      </p>
    );
  }

  // 오른쪽 콘텐츠 영역은 신 스크린이 전부 차지하고, 제목·조작 버튼·코멘트는 플로팅으로 띄운다.
  return (
    <div className="relative flex h-full min-h-0" onClick={() => setMenu(null)}>
      <aside aria-label={t('scenes.list')} className="flex w-56 shrink-0 flex-col border-r border-border bg-card/40">
        <h2 className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">{t('scenes.list')}</h2>
        <ul className="min-h-0 flex-1 space-y-1 overflow-auto p-2" data-allow-context>
          {valid.map((e) => {
            const active = e.scene!.id === selected?.scene?.id;
            return (
              <li key={e.scene!.id}>
                <button
                  type="button"
                  onClick={() => setParams({ scene: e.scene!.id })}
                  onContextMenu={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    setMenu({ x: ev.clientX, y: ev.clientY, slug: e.slug });
                  }}
                  aria-current={active}
                  className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent', active && 'bg-accent')}
                >
                  {thumbs[e.slug] ? (
                    <img src={thumbs[e.slug]} alt="" className="h-8 w-12 shrink-0 rounded border border-border object-cover" />
                  ) : (
                    <span aria-hidden className="h-8 w-12 shrink-0 rounded bg-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.scene!.name}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {t(`scene.type.${e.scene!.type}`)} · {t(`scene.status.${e.scene!.status}`)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {valid.length === 0 && <p className="p-3 text-xs text-muted-foreground">{t('scenes.empty')}</p>}
      </aside>

      <div className="relative min-w-0 flex-1 overflow-hidden">
        {!selected?.scene ? (
          <p className="p-4 text-xs text-muted-foreground">{t('scenes.selectHint')}</p>
        ) : (
          <div className="absolute inset-0">
            {workspace && (
              <PreviewPanel
                root={root}
                slug={selected.slug}
                sceneType={selected.scene.type}
                canvas={workspace.canvas}
                entry={selected.scene.runtime.entry}
                stepsTotal={selectedStepsTotal}
                onThumbnail={(slug, url) => setThumbs((m) => ({ ...m, [slug]: url }))}
              />
            )}
          </div>
        )}

        {selected?.scene && (
          <>
            <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-24rem)] flex-wrap items-baseline gap-2 rounded-lg border border-border bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur">
              <h1 className="truncate text-base font-semibold">{selected.scene.name}</h1>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t(`scene.type.${selected.scene.type}`)} · {t(`scene.status.${selected.scene.status}`)}
              </span>
            </div>
            <div className="absolute right-4 top-4 z-10 flex gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
            <Button size="sm" variant="outline" onClick={() => setInspectorOpen(true)}>
              <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
              {t('scenes.openInspector')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCommentsOpen((v) => !v)} aria-pressed={commentsOpen}>
              <MessageSquare className="mr-1 h-3.5 w-3.5" />
              {t('comments.title')}
            </Button>
            </div>
          </>
        )}
      </div>

      {commentsOpen && selected?.scene && (
        <FloatingPanel
          title={t('comments.title')}
          onClose={() => setCommentsOpen(false)}
          draggable
          className="right-4 top-20 z-20"
          style={{ width: 320, height: 420 }}
          testId="scene-comments-float"
        >
          <div className="h-full p-2">
            <CommentToolbox root={root} scenes={commentScenes} defaultSlug={selected.slug} />
          </div>
        </FloatingPanel>
      )}

      {menu && (
        <div
          role="menu"
          data-allow-context
          data-testid="scene-context-menu"
          className="fixed z-50 w-48 rounded-md border border-border bg-card p-1 text-xs shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {(() => {
            const entry = entries.find((e) => e.slug === menu.slug);
            const id = entry?.scene?.id;
            if (!id) return null;
            return (
              <>
                <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent" onClick={() => { openMenuScene(menu.slug); setMenu(null); }}>
                  {t('scenes.menu.open')}
                </button>
                <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent" onClick={() => { openMenuScene(menu.slug); setInspectorOpen(true); setMenu(null); }}>
                  {t('scenes.menu.editGuide')}
                </button>
                <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent" onClick={() => { openFolder(menu.slug); setMenu(null); }}>
                  {t('scenes.menu.reveal')}
                </button>
                {seq && (
                  <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50" disabled={seq.start === id} onClick={() => { setStartScene(id); setMenu(null); }}>
                    {t('scenes.menu.setStart')}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {inspectorOpen && selected?.scene && workspace && (
        <FloatingPanel
          title={t('scenes.inspectorTitle')}
          onClose={() => setInspectorOpen(false)}
          draggable
          className="bottom-4 right-4 top-4"
          style={{ width: 420, height: 'auto' }}
          testId="scene-inspector-float"
        >
          <SceneInspector
            key={selected.scene.id}
            workspace={workspaceRef}
            root={root}
            slug={selected.slug}
            scene={selected.scene}
            template={resolve(selected.scene)}
            templateError={catalog.get(selected.scene.template)?.error}
            canvas={workspace.canvas}
            onSave={async (scene) => {
              const prev = selected.scene!;
              const fields = changedFields(prev, scene);
              await writeScene(root, selected.slug, workspaceRef, scene, resolve);
              if (fields.length > 0) {
                void recordStudioChange(root, {
                  scope: 'scene',
                  targetId: scene.id,
                  targetName: `scenes/${selected.slug} (${scene.name})`,
                  summary: '인스펙터에서 신 가이드/파라미터 설정 수정',
                  fields,
                });
              }
              reload();
            }}
            onRename={async (name) => {
              const prevName = selected.scene!.name;
              const res = await renameScene(root, workspaceRef, selected.slug, name, resolve);
              void recordStudioChange(root, {
                scope: 'scene',
                targetId: res.scene.id,
                targetName: `scenes/${res.slug} (${res.scene.name})`,
                summary: `신 이름 변경: "${prevName}" → "${res.scene.name}"`,
                fields: ['name'],
              });
              reload();
            }}
            isStart={seq?.start === selected.scene.id}
            onSetStart={
              seq
                ? () => {
                    const next = setStart(seq, selected.scene!.id);
                    if (!checkSavable(next)) {
                      setSeq(next);
                      void writeSequence(root, next).catch(() => undefined);
                      void recordStudioChange(root, {
                        scope: 'sequence',
                        targetId: next.id,
                        targetName: 'sequence.json',
                        summary: `시퀀스 시작 신을 "${selected.scene!.name}"(${selected.scene!.id})로 변경`,
                        fields: ['start'],
                      });
                    }
                  }
                : undefined
            }
            onSaveAsTemplate={async (name) => {
              const parent = resolve(selected.scene!);
              if (!parent) throw new Error('template-unavailable');
              const r = await saveSceneAsTemplate(root, selected.scene!, parent, name, (ref) => catalog.get(ref) !== null);
              await reloadTemplates();
              return { ref: r.template.ref };
            }}
          />
        </FloatingPanel>
      )}

      <DiffDialog
        open={review.current !== null}
        sceneName={review.current?.sceneName ?? ''}
        review={review.current?.review ?? null}
        analysis={review.current?.analysis ?? null}
        onApprove={() => void review.approve()}
        onRevertDisallowed={() => void review.revertDisallowed()}
        onRevertAll={() => void review.revertAll()}
        onClose={review.dismiss}
      />
    </div>
  );
}

export function Scenes() {
  const { workspaceRoot } = useWorkspace();
  if (!workspaceRoot) return <Onboarding />;
  return (
    <TemplatesProvider root={workspaceRoot}>
      <Inner key={workspaceRoot} root={workspaceRoot} />
    </TemplatesProvider>
  );
}

export default Scenes;
