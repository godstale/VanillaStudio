import { useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BridgeProvider } from '@/lib/review/BridgeContext';
import { useBridge, useBridgeEvents, useBridgeTime } from '@/lib/review/bridgeContextValue';
import { previewOriginOf } from '@/lib/review/bridgeProtocol';
import { usePreviewServer, type PreviewServerState } from '@/lib/review/previewServer';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { saveThumbnail } from '@/lib/scene/thumbnail';
import { ScenePreview } from './Preview';

export interface PreviewPanelProps {
  /** 워크스페이스 폴더(프리뷰 서버의 루트). */
  root: string;
  slug: string;
  sceneType: 'static' | 'motion' | '3d';
  /** workspace.json.canvas. */
  canvas: { width: number; height: number; fps: number };
  entry?: string;
  /** 미리보기가 준비되면 썸네일을 한 번 캡처해 저장하고 알린다(T4.8). 없으면 캡처하지 않는다. */
  onThumbnail?: (slug: string, dataUrl: string) => void;
}

const THUMB_SCALE = 0.25;
const THUMB_SETTLE_MS = 400;

function ServerStatus({ state, onRetry }: { state: PreviewServerState; onRetry: () => void }) {
  const { t } = useLanguage();
  if (state.phase === 'running' || state.phase === 'idle') return null;
  if (state.phase === 'failed') {
    const notInstalled = state.error === 'not-installed';
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-md border border-border p-3 text-xs">
        <p className="flex items-center gap-1 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {notInstalled ? t('preview.notInstalled') : t('preview.serverFailed')}
        </p>
        {!notInstalled && <p className="break-all text-muted-foreground">{state.error}</p>}
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw className="mr-1 h-3 w-3" />
          {t('preview.retry')}
        </Button>
      </div>
    );
  }
  return (
    <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {t(state.phase === 'restarting' ? 'preview.restarting' : 'preview.starting')}
    </p>
  );
}

function Body({ server, onRetry, root, slug, sceneType, canvas, entry, onThumbnail }: { server: PreviewServerState; onRetry: () => void } & PreviewPanelProps) {
  const { t } = useLanguage();
  const bridge = useBridge();
  const time = useBridgeTime();
  const [step, setStep] = useState<{ index: number; total: number } | null>(null);
  const [done, setDone] = useState(false);
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useBridgeEvents((e) => {
    if (e.type === 'step') setStep(e.payload);
    if (e.type === 'done') setDone(true);
    if (e.type === 'ready') {
      setStep(null);
      setDone(false);
      if (!onThumbnail) return;
      // 다시 준비될 때(HMR·새로고침)마다 최신 모습으로 갱신한다. 첫 프레임이 비는 신이 많아 길이의 30% 지점에서 찍는다.
      if (thumbTimer.current) clearTimeout(thumbTimer.current);
      const at = sceneType !== 'static' && e.payload.duration ? e.payload.duration * 0.3 : null;
      if (at !== null) bridge.seek(at);
      thumbTimer.current = setTimeout(() => {
        bridge
          .capture(THUMB_SCALE)
          .then(async (c) => {
            if (await saveThumbnail(root, slug, c.dataUrl)) onThumbnail(slug, c.dataUrl);
          })
          .catch(() => undefined) // 썸네일은 부가 기능이다. 실패해도 미리보기는 계속 쓴다.
          .finally(() => {
            if (at !== null) bridge.seek(0);
          });
      }, THUMB_SETTLE_MS);
    }
  });
  const serverUrl = server.phase === 'running' ? server.url : null;
  const isStatic = sceneType === 'static';

  return (
    <div className="flex flex-col gap-2" data-testid="preview-panel">
      <ServerStatus state={server} onRetry={onRetry} />
      <ScenePreview serverUrl={serverUrl} slug={slug} entry={entry} format={canvas} />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {isStatic ? (
          <>
            <Button size="sm" variant="outline" aria-label={t('preview.prev')} disabled={bridge.status !== 'ready'} onClick={() => bridge.send({ type: 'prev' })}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" aria-label={t('preview.next')} disabled={bridge.status !== 'ready'} onClick={() => bridge.send({ type: 'next' })}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="text-muted-foreground" data-testid="preview-step">
              {done ? t('preview.finished') : step ? t('preview.step', { index: step.index + 1, total: step.total }) : t('preview.hintInput')}
            </span>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" disabled={bridge.status !== 'ready'} onClick={() => (bridge.playing ? bridge.pause() : bridge.play())}>
              {bridge.playing ? <Pause className="mr-1 h-3.5 w-3.5" /> : <Play className="mr-1 h-3.5 w-3.5" />}
              {bridge.playing ? t('preview.pause') : t('preview.play')}
            </Button>
            <span className="tabular-nums text-muted-foreground" data-testid="preview-time">
              {time.t.toFixed(2)}s{bridge.ready?.duration ? ` / ${bridge.ready.duration.toFixed(2)}s` : ''}
            </span>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => bridge.reload()} disabled={bridge.status !== 'ready'}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          {t('preview.reload')}
        </Button>
        <span className="ml-auto text-muted-foreground">{bridge.status === 'ready' ? t('preview.connected') : t('preview.connecting')}</span>
      </div>

      {bridge.error && (
        <p role="alert" className="rounded bg-destructive/10 p-2 text-xs text-destructive">
          {t('preview.sceneError', { message: bridge.error.message })}
        </p>
      )}
    </div>
  );
}

/** 신 하나를 프리뷰 서버(워크스페이스 루트)에서 열어 재생·일시정지·새로고침(motion·3d) 또는 단계 이동(static)을 제어한다. */
export function PreviewPanel({ root, slug, sceneType, canvas, entry, onThumbnail }: PreviewPanelProps) {
  const { state, retry } = usePreviewServer(root);
  const origin = previewOriginOf(state.phase === 'running' ? state.url : null);
  return (
    <BridgeProvider previewOrigin={origin} canvas={canvas}>
      <Body server={state} onRetry={retry} root={root} slug={slug} sceneType={sceneType} canvas={canvas} entry={entry} onThumbnail={onThumbnail} />
    </BridgeProvider>
  );
}
