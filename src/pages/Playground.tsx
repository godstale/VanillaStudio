import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { EmptyScreen } from '@/components/layout/EmptyScreen';
import { SequencePlayer } from '@/components/playground/SequencePlayer';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { loadCustomTransitions, type CustomTransition } from '@/lib/playground/transitions/custom';
import { previewOriginOf } from '@/lib/review/bridgeProtocol';
import { usePreviewServer } from '@/lib/review/previewServer';
import { listScenes } from '@/lib/scene/files';
import { readSequence } from '@/lib/sequence/file';
import type { Sequence } from '@/lib/sequence/schema';
import { hasErrors, validateSequence } from '@/lib/sequence/validate';
import { readWorkspace } from '@/lib/workspace/file';
import type { Workspace } from '@/lib/workspace/schema';

type SceneRow = { type: 'static' | 'motion' | '3d'; name: string; slug: string; entry: string };

interface Loaded {
  root: string;
  workspace: Workspace;
  sequence: Sequence;
  scenes: Map<string, SceneRow>;
  custom: Map<string, CustomTransition>;
}

/** 플레이그라운드: 이 워크스페이스의 시퀀스를 재생한다(F-PLY-01). 편집은 워크스페이스 화면에서 한다. */
export function Playground() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const [loaded, setLoaded] = useState<Loaded | { root: string; error: string } | null>(null);

  useEffect(() => {
    if (!workspaceRoot) return;
    let cancelled = false;
    (async () => {
      const workspace = await readWorkspace(workspaceRoot);
      const [sequence, entries, custom] = await Promise.all([readSequence(workspaceRoot, workspace.workspaceId), listScenes(workspaceRoot), loadCustomTransitions(workspaceRoot)]);
      const scenes = new Map<string, SceneRow>(entries.flatMap((e) => (e.scene ? [[e.scene.id, { type: e.scene.type, name: e.scene.name, slug: e.slug, entry: e.scene.runtime.entry }] as const] : [])));
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

  if (!workspaceRoot) return <EmptyScreen title={t('shell.nav.playground')}>{t('player.noWorkspace')}</EmptyScreen>;
  if (!loaded || loaded.root !== workspaceRoot) return null;
  if ('error' in loaded) {
    return (
      <p role="alert" className="p-8 text-sm text-destructive">
        {t('player.loadFailed', { error: loaded.error })}
      </p>
    );
  }
  if (loaded.sequence.nodes.length === 0) return <EmptyScreen title={t('shell.nav.playground')}>{t('player.emptySequence')}</EmptyScreen>;

  if (hasErrors(issues)) {
    return (
      <div className="flex h-full flex-col gap-2 p-6 text-sm">
        <h1 className="text-base font-semibold">{t('shell.nav.playground')}</h1>
        <p className="text-xs text-muted-foreground">{t('player.fixFirst')}</p>
        <ul role="alert" className="list-disc space-y-1 pl-5 text-xs text-destructive">
          {issues
            .filter((i) => i.severity === 'error')
            .map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
        </ul>
      </div>
    );
  }

  const origin = previewOriginOf(serverUrl);
  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <h1 className="text-base font-semibold">{t('shell.nav.playground')}</h1>
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
        <div className="min-h-0 flex-1">
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
    </div>
  );
}

export default Playground;
