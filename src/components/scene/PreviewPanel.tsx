import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
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
  /** static 신의 전체 스텝 수(스크롤형은 1). 알면 신을 옮긴 직후에도 `1 / N`을 보여준다. */
  stepsTotal?: number | null;
  /** 미리보기가 준비되면 썸네일을 한 번 캡처해 저장하고 알린다(T4.8). 없으면 캡처하지 않는다. */
  onThumbnail?: (slug: string, dataUrl: string) => void;
}

const THUMB_SCALE = 0.25;
const THUMB_SETTLE_MS = 400;
const TOAST_MS = 4000;

function Body({ server, onRetry, root, slug, sceneType, canvas, entry, stepsTotal, onThumbnail }: { server: PreviewServerState; onRetry: () => void } & PreviewPanelProps) {
  const { t } = useLanguage();
  const bridge = useBridge();
  const time = useBridgeTime();
  const [step, setStep] = useState<{ index: number; total: number } | null>(null);
  const [done, setDone] = useState(false);
  // 경고·상태 토스트: 툴박스가 아니라 화면 하단 반투명 문자열로 잠시 보여준다.
  const [toast, setToast] = useState<{ msg: string; role: 'alert' | 'status' } | null>(null);
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (thumbTimer.current) clearTimeout(thumbTimer.current);
    };
  }, []);

  const flash = (msg: string, role: 'alert' | 'status') => {
    setToast({ msg, role });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

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

  // 브릿지 오류는 토스트로 잠시 보여준다(외부 브릿지 상태 → 로컬 토스트 동기화).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external bridge error needs local transient copy
    if (bridge.error) flash(t('preview.sceneError', { message: bridge.error.message }), 'alert');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.error]);

  // 서버 상태(시작 중·실패)도 툴박스가 아닌 하단 토스트로 보여준다.
  useEffect(() => {
    if (server.phase === 'starting' || server.phase === 'restarting') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external server phase needs local transient copy
      flash(t(server.phase === 'restarting' ? 'preview.restarting' : 'preview.starting'), 'status');
    } else if (server.phase === 'failed') {
      const notInstalled = server.error === 'not-installed';
      flash(notInstalled ? t('preview.notInstalled') : `${t('preview.serverFailed')}${server.error && !notInstalled ? ` (${server.error})` : ''}`, 'alert');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.phase]);

  const serverUrl = server.phase === 'running' ? server.url : null;
  const isStatic = sceneType === 'static';
  const notReady = bridge.status !== 'ready';
  const prevDisabled = notReady || !step || step.index <= 0;
  const nextDisabled = notReady || done || (step ? step.index >= step.total - 1 : false);
  const serverFailed = server.phase === 'failed';
  const stepLabel = done
    ? t('preview.finished')
    : step
      ? t('preview.step', { index: step.index + 1, total: step.total })
      : stepsTotal != null && isStatic && !notReady
        ? t('preview.step', { index: 1, total: stepsTotal })
        : '—';

  return (
    <div className="relative h-full min-h-0 w-full" data-testid="preview-panel">
      <div className="absolute inset-0">
        <ScenePreview serverUrl={serverUrl} slug={slug} entry={entry} format={canvas} />
      </div>

      {/* 하단 네비게이션 툴박스: 고정 크기, 동작 불가 시 비활성. 상태 문구는 표시하지 않는다. */}
      <div className="absolute bottom-4 left-1/2 z-10 flex h-12 w-[420px] max-w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-center gap-2 overflow-hidden rounded-lg border border-border bg-card/95 px-2 text-xs shadow-lg backdrop-blur">
        {isStatic ? (
          <>
            <Button size="sm" variant="outline" aria-label={t('preview.prev')} disabled={prevDisabled} onClick={() => bridge.send({ type: 'prev' })}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" aria-label={t('preview.next')} disabled={nextDisabled} onClick={() => bridge.send({ type: 'next' })}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="w-20 shrink-0 text-center tabular-nums text-muted-foreground" data-testid="preview-step">
              {stepLabel}
            </span>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" disabled={notReady} onClick={() => (bridge.playing ? bridge.pause() : bridge.play())}>
              {bridge.playing ? <Pause className="mr-1 h-3.5 w-3.5" /> : <Play className="mr-1 h-3.5 w-3.5" />}
              {bridge.playing ? t('preview.pause') : t('preview.play')}
            </Button>
            <span className="w-28 shrink-0 text-center tabular-nums text-muted-foreground" data-testid="preview-time">
              {time.t.toFixed(2)}s{bridge.ready?.duration ? ` / ${bridge.ready.duration.toFixed(2)}s` : ''}
            </span>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => bridge.reload()} disabled={notReady}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          {t('preview.reload')}
        </Button>
      </div>

      {/* 상태·경고 토스트: 화면 하단 반투명 문자열, 잠시 후 사라진다. 서버 실패만 다시 시도 버튼을 둔다. */}
      {toast && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2">
          <p role={toast.role} className="rounded bg-black/60 px-3 py-1 text-center text-xs text-white">
            {toast.msg}
          </p>
        </div>
      )}
      {serverFailed && (
        <div className="absolute bottom-20 left-1/2 z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2">
          <button type="button" onClick={onRetry} className="rounded bg-black/60 px-3 py-1 text-xs text-white underline">
            {t('preview.retry')}
          </button>
        </div>
      )}
    </div>
  );
}

/** 신 하나를 프리뷰 서버(워크스페이스 루트)에서 열어 재생·일시정지·새로고침(motion·3d) 또는 단계 이동(static)을 제어한다. */
export function PreviewPanel({ root, slug, sceneType, canvas, entry, stepsTotal, onThumbnail }: PreviewPanelProps) {
  const { state, retry } = usePreviewServer(root);
  const origin = previewOriginOf(state.phase === 'running' ? state.url : null);
  return (
    <BridgeProvider previewOrigin={origin} canvas={canvas}>
      <Body key={slug} server={state} onRetry={retry} root={root} slug={slug} sceneType={sceneType} canvas={canvas} entry={entry} stepsTotal={stepsTotal} onThumbnail={onThumbnail} />
    </BridgeProvider>
  );
}
