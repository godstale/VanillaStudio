import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Maximize } from 'lucide-react';
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
 * 슬라이드형은 PPT 프레젠테이션처럼 쓴다. 프리젠테이션 영역 전체를 플레이 영역으로 쓰고,
 * 타임라인·네비게이션은 하단 플로팅 툴박스로 작게 둔다. 전체화면(F) + Alt 단축키 표시.
 */
export function Play() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const [loaded, setLoaded] = useState<Loaded | { root: string; error: string } | null>(null);
  const [altHeld, setAltHeld] = useState(false);
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

  // Alt를 누르면 버튼 위 단축키 배지를 보여준다. F 전체화면, ←/→ 신 이동(플레이어), Space 클릭 진행.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltHeld(true);
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        toggleFullscreen();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
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
  const kbd = (s: string) =>
    altHeld ? (
      <kbd className="ml-1 rounded border border-border bg-muted px-1 text-[10px] text-muted-foreground">{s}</kbd>
    ) : null;

  return (
    <div ref={stageRef} className="relative flex h-full min-h-0 flex-col bg-black" data-testid="play-stage">
      <div className="flex items-center gap-2 bg-background px-4 py-2">
        <h1 className="truncate text-sm font-semibold">{loaded.workspace.name}</h1>
        <span className="text-xs text-muted-foreground">
          {t('player.sceneIndex', { index: 1, total: loaded.sequence.nodes.length, name: '' }).replace(/^신 1.*?:/, '').trim() || t(`sequence.mode.${loaded.sequence.mode}`)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={toggleFullscreen} aria-label={t('play.fullscreen')} title="F">
            <Maximize className="mr-1 h-3.5 w-3.5" />
            {t('play.fullscreen')}
            {kbd('F')}
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
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
            />
          </div>
        )}

        {/* 하단 플로팅 툴박스: 작게, 전체화면에서도 보인다. 네비게이션 단축키 배지는 Alt로 표시. */}
        <div className="absolute bottom-3 left-1/2 z-20 flex h-10 w-[360px] max-w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-center gap-2 overflow-hidden rounded-lg border border-border bg-card/95 px-2 text-xs shadow-lg backdrop-blur" data-testid="play-float-tools">
          <span className="text-muted-foreground">{t('play.toolsHint')}</span>
          {kbd('←/→ · Space')}
          <Button size="sm" variant="outline" onClick={toggleFullscreen} aria-label={t('play.fullscreen')}>
            <Maximize className="h-3.5 w-3.5" />
            {kbd('F')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Play;
