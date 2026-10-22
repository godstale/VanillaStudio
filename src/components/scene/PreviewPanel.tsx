import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BridgeProvider } from '@/lib/review/BridgeContext';
import { useBridge, useBridgeEvents, useBridgeTime } from '@/lib/review/bridgeContextValue';
import { previewOriginOf } from '@/lib/review/bridgeProtocol';
import { usePreviewServer, type PreviewServerState } from '@/lib/review/previewServer';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { ScenePreview } from './Preview';
import { useThumbnailCapture } from './useThumbnailCapture';

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

const TOAST_MS = 4000;

function Body({ server, onRetry, root, slug, sceneType, canvas, entry, stepsTotal, onThumbnail }: { server: PreviewServerState; onRetry: () => void } & PreviewPanelProps) {
  const { t } = useLanguage();
  const bridge = useBridge();
  const time = useBridgeTime();
  const [step, setStep] = useState<{ index: number; total: number } | null>(null);
  const [done, setDone] = useState(false);
  // 경고·상태 토스트: 툴박스가 아니라 화면 하단 반투명 문자열로 잠시 보여준다.
  const [toast, setToast] = useState<{ msg: string; role: 'alert' | 'status' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const flash = (msg: string, role: 'alert' | 'status') => {
    setToast({ msg, role });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  useBridgeEvents((e) => {
    if (e.type === 'step') {
      // 스텝 보고는 "어느 단계에 있다"는 뜻이므로 완료 상태를 푼다.
      // (완료 뒤 prev로 돌아오면 done만 true로 남아 다음 버튼이 영원히 막히는 버그 방지)
      setStep(e.payload);
      setDone(false);
    }
    if (e.type === 'done') {
      setDone(true);
      // 완료 안내는 툴박스가 아닌 하단 토스트로 보여준다(툴박스는 고정 크기 유지).
      flash(t('preview.finished'), 'status');
    }
    if (e.type === 'ready') {
      setStep(null);
      setDone(false);
    }
  });

  useThumbnailCapture({ root, slug, sceneType, onThumbnail });

  // 브릿지 오류는 토스트로 잠시 보여준다(외부 브릿지 상태 → 로컬 토스트 동기화).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external bridge error needs local transient copy
    if (bridge.error) flash(t('preview.sceneError', { message: bridge.error.message }), 'alert');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.error]);

  // 서버 상태(시작 중·실패)도 툴박스가 아닌 하단 토스트로 보여준다.
  useEffect(() => {
    if (server.phase === 'starting' || server.phase === 'restarting' || server.phase === 'installing') {
      const key = server.phase === 'restarting' ? 'preview.restarting' : server.phase === 'installing' ? 'preview.installing' : 'preview.starting';
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external server phase needs local transient copy
      flash(t(key), 'status');
    } else if (server.phase === 'failed') {
      const notInstalled = server.error === 'not-installed';
      flash(notInstalled ? t('preview.notInstalled') : `${t('preview.serverFailed')}${server.error && !notInstalled ? ` (${server.error})` : ''}`, 'alert');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.phase]);

  const serverUrl = server.phase === 'running' ? server.url : null;
  const isStatic = sceneType === 'static';
  const notReady = bridge.status !== 'ready';
  // 단일 신 미리보기: ready가 보고한 첫 신에 오디오 오버라이드를 보낸다(Play 하단 바와 같은 스타일·키).
  const previewSceneId = bridge.ready?.scenes[0]?.id ?? null;
  const [volume, setVolume] = useState(() => {
    try {
      const raw = window.localStorage.getItem('vp-volume');
      const v = raw === null ? NaN : Number(raw);
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8;
    } catch {
      return 0.8;
    }
  });
  const [muted, setMuted] = useState(() => {
    try {
      return window.localStorage.getItem('vp-muted') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('vp-volume', String(volume));
    } catch {
      // private mode: ignore
    }
    if (!previewSceneId || notReady) return;
    bridge.setParams(previewSceneId, { volume: muted ? 0 : volume, music: !muted, muted });
  }, [bridge, previewSceneId, notReady, volume, muted]);

  useEffect(() => {
    try {
      window.localStorage.setItem('vp-muted', muted ? '1' : '0');
    } catch {
      // private mode: ignore
    }
  }, [muted]);
  const prevDisabled = notReady || !step || step.index <= 0;
  // 마지막 단계에서는 다음을 막는다. 완료(done)는 신 안에서 직접 입력(클릭·키)할 때 보고된다(D-032).
  // 툴박스 next는 스텝 이동용이라 마지막 단계에서 누르면 advance 검사를 우회하게 된다.
  const nextDisabled = notReady || done || (step ? step.index >= step.total - 1 : (stepsTotal != null && stepsTotal <= 1));
  const serverFailed = server.phase === 'failed';
  const stepLabel = step
    ? t('preview.step', { index: step.index + 1, total: step.total })
    : stepsTotal != null && isStatic && !notReady
      ? t('preview.step', { index: 1, total: stepsTotal })
      : '—';

  return (
    <div className="relative h-full min-h-0 w-full" data-testid="preview-panel">
      <div className="absolute inset-0">
        <ScenePreview serverUrl={serverUrl} slug={slug} entry={entry} format={canvas} />
      </div>
      {/* 영상 신: 화면 클릭으로 재생·일시정지를 전환한다(정적 신은 직접 입력으로 진행). */}
      {!isStatic && !notReady && (
        <button
          type="button"
          aria-label={t(bridge.playing ? 'preview.pause' : 'preview.play')}
          data-testid="preview-stage-toggle"
          onClick={() => (bridge.playing ? bridge.pause() : bridge.play())}
          className="absolute inset-0 z-[5] cursor-pointer bg-transparent"
        />
      )}

      {/* 하단 네비게이션 툴박스: 고정 크기, 동작 불가 시 비활성. 상태 문구는 표시하지 않는다. */}
      <div data-testid="preview-bar" className="absolute bottom-4 left-1/2 z-10 flex h-12 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-center gap-2 overflow-hidden rounded-lg border border-border bg-card/95 px-2 text-xs shadow-lg backdrop-blur">
        {isStatic ? (
          <>
            <Button size="sm" variant="outline" aria-label={t('preview.prev')} disabled={prevDisabled} onClick={() => bridge.send({ type: 'prev' })} className="border-foreground/25 text-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/60 disabled:text-muted-foreground disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" aria-label={t('preview.next')} disabled={nextDisabled} onClick={() => bridge.send({ type: 'next' })} className="border-foreground/25 text-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/60 disabled:text-muted-foreground disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="w-20 shrink-0 whitespace-nowrap text-center tabular-nums text-muted-foreground" data-testid="preview-step">
              {stepLabel}
            </span>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" disabled={notReady} onClick={() => (bridge.playing ? bridge.pause() : bridge.play())} className="border-foreground/25 text-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/60 disabled:text-muted-foreground disabled:opacity-40">
              {bridge.playing ? <Pause className="mr-1 h-3.5 w-3.5" /> : <Play className="mr-1 h-3.5 w-3.5" />}
              {bridge.playing ? t('preview.pause') : t('preview.play')}
            </Button>
            {bridge.ready?.duration ? (
              <input
                type="range"
                min={0}
                max={bridge.ready.duration}
                step={0.05}
                value={Math.min(time.t, bridge.ready.duration)}
                aria-label={t('preview.seek')}
                data-testid="preview-seek"
                disabled={notReady}
                onChange={(e) => bridge.seek(Number(e.target.value))}
                className="w-28 accent-primary disabled:opacity-40"
              />
            ) : null}
            <span className="w-28 shrink-0 text-center tabular-nums text-muted-foreground" data-testid="preview-time">
              {time.t.toFixed(2)}s{bridge.ready?.duration ? ` / ${bridge.ready.duration.toFixed(2)}s` : ''}
            </span>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => bridge.reload()} disabled={notReady} className="disabled:cursor-not-allowed disabled:opacity-40">
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          {t('preview.reload')}
        </Button>
        <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
        <span className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMuted((m) => !m)}
            disabled={notReady}
            aria-label={t(muted ? 'player.unmute' : 'player.mute')}
            title={t(muted ? 'player.unmute' : 'player.mute')}
            aria-pressed={muted}
            data-testid="preview-mute"
            className="px-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {muted || volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label={t('player.volume')}
            data-testid="preview-volume"
            disabled={notReady}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              if (v > 0 && muted) setMuted(false);
              if (v === 0) setMuted(true);
            }}
            className="w-20 accent-primary disabled:opacity-40"
          />
        </span>
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
