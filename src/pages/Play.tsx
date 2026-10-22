import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

type SceneRow = { type: 'static' | 'motion' | '3d'; name: string; slug: string; entry: string; status: string };

interface Loaded {
  root: string;
  workspace: Workspace;
  sequence: Sequence;
  scenes: Map<string, SceneRow>;
  custom: Map<string, CustomTransition>;
}

/**
 * 재생 메뉴: 프로젝트 결과물을 시간순(또는 사용자 입력 순)으로 탐색한다.
 * 플레이 화면이 전체를 꽉 채운다. 타이틀·전체화면 버튼은 반투명 오버레이,
 * 하단 네비게이션은 신 화면 툴박스를 확장한 compact 바(SequencePlayer)다.
 * 전체화면에서는 재생 화면 외에 아무것도 표시하지 않는다.
 */
export function Play() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const [loaded, setLoaded] = useState<Loaded | { root: string; error: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

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

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void el.requestFullscreen();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // F로 전체화면 전환. 입력란에서는 동작하지 않는다.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [toggleFullscreen]);

  if (!workspaceRoot) return <EmptyScreen title={t('shell.nav.play')}>{t('player.noWorkspace')}</EmptyScreen>;
  if (!loaded || loaded.root !== workspaceRoot) return null;
  if ('error' in loaded) {
    return (
      <p role="alert" className="p-8 text-sm text-destructive">
        {t('player.loadFailed', { error: loaded.error })}
      </p>
    );
  }

  const origin = previewOriginOf(serverUrl);

  return (
    <div ref={stageRef} className="relative h-full min-h-0 overflow-hidden bg-black" data-testid="play-stage">
      <div className="relative h-full min-h-0 overflow-hidden">
        {hasErrors(issues) ? (
          <div className="flex h-full flex-col gap-2 overflow-auto bg-background p-4 text-xs">
            <p className="text-muted-foreground">{t('player.fixFirst')}</p>
            <ul role="alert" className="list-disc space-y-0.5 pl-5 text-destructive">
              {issues
                .filter((i) => i.severity === 'error')
                .map((i, n) => (
                  <li key={n}>{i.message}</li>
                ))}
            </ul>
          </div>
        ) : !serverUrl || !origin ? (
          <p role="status" className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('preview.starting')}
            <button type="button" className="underline" onClick={retry}>
              {t('preview.retry')}
            </button>
          </p>
        ) : (
          <div className="absolute inset-0">
            <SequencePlayer
              sequence={loaded.sequence}
              workspaceId={loaded.workspace.workspaceId}
              scenes={loaded.scenes}
              serverUrl={serverUrl}
              hostOrigin={window.location.origin}
              canvas={loaded.workspace.canvas}
              customTransitions={loaded.custom}
              hideChrome={isFullscreen}
            />
          </div>
        )}

        {/* 타이틀 오버레이: 반투명 팝업, 작은 폰트로 타이틀+신 정보. 전체화면에서는 숨긴다. */}
        {!isFullscreen && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 max-w-[calc(100%-5rem)] -translate-x-1/2 truncate rounded bg-black/50 px-2 py-1 text-center text-[11px] leading-tight text-white">
            {loaded.workspace.name}
            <span className="ml-1 opacity-70">
              {t('player.sceneIndex', { index: 1, total: loaded.sequence.nodes.length, name: '' }).replace(/^신 1.*?:/, '').trim() || t(`sequence.mode.${loaded.sequence.mode}`)}
            </span>
          </div>
        )}
        {/* 전체화면 오버레이 버튼. 전체화면에서는 숨긴다(녹화 미리보기처럼 부가 요소 없음). */}
        {!isFullscreen && (
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            aria-label={t('play.fullscreen')}
            title="F"
            className="absolute right-2 top-2 z-20 h-7 w-7 bg-black/50 p-0 text-white hover:bg-black/70 hover:text-white"
          >
            <Maximize className="h-3.5 w-3.5" />
          </Button>
        )}
        {isFullscreen && (
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            aria-label={t('play.fullscreen')}
            title="F"
            className="absolute bottom-2 right-2 z-20 h-7 w-7 bg-black/50 p-0 text-white opacity-0 hover:bg-black/70 hover:text-white hover:opacity-100 focus-visible:opacity-100"
          >
            <Minimize className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default Play;
