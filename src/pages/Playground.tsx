import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { EmptyScreen } from '@/components/layout/EmptyScreen';
import { SequencePlayer } from '@/components/playground/SequencePlayer';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { loadCustomTransitions, type CustomTransition } from '@/lib/playground/transitions/custom';
import { previewOriginOf } from '@/lib/review/bridgeProtocol';
import { usePreviewServer } from '@/lib/review/previewServer';
import { listScenes } from '@/lib/scene/files';
import { loadThumbnail } from '@/lib/scene/thumbnail';
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

/** 플레이그라운드: 작업한 신 갤러리 + 이 워크스페이스의 시퀀스 재생. 온라인 탐색·등록은 추후 지원. */
export function Playground() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | { root: string; error: string } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

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
      loadThumbnail(ready.root, s.slug)
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

  const sceneList = [...loaded.scenes];
  const origin = previewOriginOf(serverUrl);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div>
        <h1 className="text-base font-semibold">{t('shell.nav.playground')}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t('gallery.subtitle')}</p>
      </div>

      {sceneList.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('gallery.empty')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" data-testid="scene-gallery">
          {sceneList.map(([id, s]) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => navigate(`/scenes?scene=${encodeURIComponent(id)}`)}
                aria-label={t('gallery.openScene', { name: s.name })}
                className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-2 text-left text-xs hover:bg-accent"
              >
                <span className="flex h-24 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
                  {thumbs[s.slug] ? <img src={thumbs[s.slug]} alt="" className="h-full w-full object-cover" /> : t('scene.noThumbnail')}
                </span>
                <b className="truncate text-sm">{s.name}</b>
                <span className="text-[11px] text-muted-foreground">
                  {t(`scene.type.${s.type}`)} · {t(`scene.status.${s.status}`)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t('gallery.onlineLater')}</p>

      <h2 className="text-sm font-semibold">{t('gallery.player')}</h2>
      {loaded.sequence.nodes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('player.emptySequence')}</p>
      ) : hasErrors(issues) ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-xs text-muted-foreground">{t('player.fixFirst')}</p>
          <ul role="alert" className="list-disc space-y-1 pl-5 text-xs text-destructive">
            {issues
              .filter((i) => i.severity === 'error')
              .map((i, n) => (
                <li key={n}>{i.message}</li>
              ))}
          </ul>
        </div>
      ) : (
        <>
          {server.phase === 'failed' && (
            <p role="alert" className="text-xs text-destructive">
              {server.error === 'not-installed' ? t('preview.notInstalled') : t('preview.serverFailed')}{' '}
              <button type="button" className="underline" onClick={retry}>
                {t('preview.retry')}
              </button>
            </p>
          )}
          {!serverUrl || !origin ? (
            <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('preview.starting')}
            </p>
          ) : (
            <div className="h-[70vh] min-h-[420px]">
              <SequencePlayer
                sequence={loaded.sequence}
                workspaceId={loaded.workspace.workspaceId}
                scenes={loaded.scenes}
                serverUrl={serverUrl}
                hostOrigin={window.location.origin}
                canvas={loaded.workspace.canvas}
                customTransitions={loaded.custom}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Playground;
