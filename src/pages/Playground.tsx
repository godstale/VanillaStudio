import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyScreen } from '@/components/layout/EmptyScreen';
import { FloatingPanel } from '@/components/layout/FloatingPanel';
import { SequencePlayer } from '@/components/playground/SequencePlayer';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { loadCustomTransitions, type CustomTransition } from '@/lib/playground/transitions/custom';
import { previewOriginOf } from '@/lib/review/bridgeProtocol';
import { usePreviewServer } from '@/lib/review/previewServer';
import { listScenes } from '@/lib/scene/files';
import { loadSceneThumbnail } from '@/lib/scene/thumbnail';
import { readSequence } from '@/lib/sequence/file';
import type { Sequence } from '@/lib/sequence/schema';
import { hasErrors, validateSequence } from '@/lib/sequence/validate';
import { readWorkspace } from '@/lib/workspace/file';
import type { Workspace } from '@/lib/workspace/schema';

type SceneRow = { type: 'static' | 'motion' | '3d'; name: string; slug: string; entry: string; status: string };

interface Loaded {
  root: string;
  workspace: Workspace;
  sequence: Sequence;
  scenes: Map<string, SceneRow>;
  custom: Map<string, CustomTransition>;
}

/** 플레이그라운드: 시퀀스 단위로 등록된 최종 결과물 + 우측 하단 플로팅 시퀀스 재생. 온라인 탐색·등록은 추후 지원. */
export function Playground() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | { root: string; error: string } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  // 시퀀스 재생은 우측 하단 플로팅 화면에서만 보여 준다. 항목·썸네일 클릭이 이 화면을 연다.
  const [floatOpen, setFloatOpen] = useState(true);
  const [floatScene, setFloatScene] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceRoot) return;
    let cancelled = false;
    (async () => {
      const workspace = await readWorkspace(workspaceRoot);
      const [sequence, entries, custom] = await Promise.all([readSequence(workspaceRoot, workspace.workspaceId), listScenes(workspaceRoot), loadCustomTransitions(workspaceRoot)]);
      const scenes = new Map<string, SceneRow>(
        entries.flatMap((e) => (e.scene ? [[e.scene.id, { type: e.scene.type, name: e.scene.name, slug: e.slug, entry: e.scene.runtime.entry, status: e.scene.status }] as const] : [])),
      );
      if (!cancelled) setLoaded({ root: workspaceRoot, workspace, sequence, scenes, custom: custom.defs });
    })().catch((e: unknown) => {
      if (!cancelled) setLoaded({ root: workspaceRoot, error: e instanceof Error ? e.message : String(e) });
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot]);

  const ready = loaded && loaded.root === workspaceRoot && !('error' in loaded) ? loaded : null;
  const { state: server, retry } = usePreviewServer(ready ? ready.root : null);
  const serverUrl = server.phase === 'running' ? server.url : null;
  const issues = useMemo(() => (ready ? validateSequence(ready.sequence, { workspaceId: ready.workspace.workspaceId, scenes: ready.scenes, customTransitions: new Set(ready.custom.keys()) }) : []), [ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    for (const [, s] of ready.scenes) {
      if (thumbs[s.slug]) continue;
      loadSceneThumbnail(ready.root, s.slug)
        .then((url) => url && !cancelled && setThumbs((m) => (m[s.slug] ? m : { ...m, [s.slug]: url })))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [ready, thumbs]);

  if (!workspaceRoot) return <EmptyScreen title={t('shell.nav.playground')}>{t('player.noWorkspace')}</EmptyScreen>;
  if (!loaded || loaded.root !== workspaceRoot) return null;
  if ('error' in loaded) {
    return (
      <p role="alert" className="p-8 text-sm text-destructive">
        {t('player.loadFailed', { error: loaded.error })}
      </p>
    );
  }

  // 시퀀스 단위 등록: 워크스페이스 1개 = 시퀀스 1개. 카드는 첫 번째 신 하나만 보여 주고, 클릭하면 플로팅 화면에서 재생한다.
  const orderedScenes = loaded.sequence.nodes.flatMap((n) => {
    const s = loaded.scenes.get(n.sceneId);
    return s ? [{ id: n.sceneId, ...s }] : [];
  });
  const firstScene = orderedScenes[0] ?? null;
  const origin = previewOriginOf(serverUrl);
  const playable = loaded.sequence.nodes.length > 0 && !hasErrors(issues);
  const floatTitle = floatScene && loaded.scenes.get(floatScene) ? `${loaded.scenes.get(floatScene)!.name} — ${t('gallery.player')}` : `${loaded.workspace.name} — ${t('gallery.player')}`;

  const openFrom = (sceneId: string | null) => {
    setFloatScene(sceneId);
    setFloatOpen(true);
  };

  return (
    <div className="relative flex h-full flex-col gap-4 overflow-auto p-4">
      <div>
        <h1 className="text-base font-semibold">{t('shell.nav.playground')}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t('gallery.subtitle')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('gallery.savedSequence')}</p>
      </div>

      {loaded.sequence.nodes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('player.emptySequence')}</p>
      ) : (
        <section aria-label={t('gallery.sequenceTitle')}>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="sequence-gallery">
            <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-xs shadow-sm">
              <div className="flex items-center gap-2">
                <b className="min-w-0 flex-1 truncate text-sm">{loaded.workspace.name}</b>
                <span className="text-muted-foreground">{t('gallery.sceneCount', { count: orderedScenes.length })}</span>
                <span className="text-muted-foreground">{t(`sequence.mode.${loaded.sequence.mode}`)}</span>
              </div>
              {hasErrors(issues) && (
                <div className="flex flex-col gap-1">
                  <p className="text-muted-foreground">{t('player.fixFirst')}</p>
                  <ul role="alert" className="list-disc space-y-0.5 pl-5 text-destructive">
                    {issues
                      .filter((i) => i.severity === 'error')
                      .map((i, n) => (
                        <li key={n}>{i.message}</li>
                      ))}
                  </ul>
                </div>
              )}
              {orderedScenes.length === 0 || !firstScene ? (
                <p className="text-muted-foreground">{t('gallery.empty')}</p>
              ) : (
                <div className="flex max-w-xs flex-col gap-1 rounded-md border border-border p-1.5">
                  <button
                    type="button"
                    onClick={() => openFrom(firstScene.id)}
                    aria-label={t('gallery.floatPlayer', { name: firstScene.name })}
                    className="flex w-full flex-col gap-1 rounded text-left hover:bg-accent"
                  >
                    <span className="flex h-20 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
                      {thumbs[firstScene.slug] ? <img src={thumbs[firstScene.slug]} alt="" className="h-full w-full object-cover" /> : t('scene.noThumbnail')}
                    </span>
                    <b className="truncate text-xs">{firstScene.name}</b>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/scenes?scene=${encodeURIComponent(firstScene.id)}`)}
                    aria-label={t('gallery.openScene', { name: firstScene.name })}
                    className="self-end rounded border border-border px-2 py-0.5 text-[11px] hover:bg-accent"
                  >
                    {t('gallery.openScenePage')}
                  </button>
                </div>
              )}
              {!floatOpen && playable && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setFloatOpen(true)}>
                    {t('gallery.openPlayer')}
                  </Button>
                </div>
              )}
            </li>
          </ul>
        </section>
      )}
      <p className="text-xs text-muted-foreground">{t('gallery.onlineLater')}</p>

      {server.phase === 'failed' && (
        <p role="alert" className="text-xs text-destructive">
          {server.error === 'not-installed' ? t('preview.notInstalled') : t('preview.serverFailed')}{' '}
          <button type="button" className="underline" onClick={retry}>
            {t('preview.retry')}
          </button>
        </p>
      )}

      {floatOpen && loaded.sequence.nodes.length > 0 && (
        <FloatingPanel
          title={floatTitle}
          onClose={() => setFloatOpen(false)}
          draggable
          className="bottom-4 right-4 z-40"
          style={{ width: 'min(520px, 36vw)', height: 'min(420px, 40vh)', minWidth: 300, minHeight: 280 }}
          testId="playground-float-player"
        >
          <div className="h-full p-2">
            {hasErrors(issues) ? (
              <p className="text-xs text-muted-foreground">{t('player.fixFirst')}</p>
            ) : !serverUrl || !origin ? (
              <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('preview.starting')}
              </p>
            ) : (
              <SequencePlayer
                sequence={loaded.sequence}
                workspaceId={loaded.workspace.workspaceId}
                scenes={loaded.scenes}
                serverUrl={serverUrl}
                hostOrigin={window.location.origin}
                canvas={loaded.workspace.canvas}
                customTransitions={loaded.custom}
                initialSceneId={floatScene}
              />
            )}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}

export default Playground;
