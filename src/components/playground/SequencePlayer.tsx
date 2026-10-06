import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, MousePointer2, Pause, Play, RotateCcw, SkipBack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IframeSceneHost, type SceneSource } from '@/lib/playground/iframeScene';
import { createTransitionRunner } from '@/lib/playground/sceneTransitions';
import type { CustomTransition } from '@/lib/playground/transitions/custom';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { computePreviewLayout } from '@/lib/review/previewLayout';
import { triggerKind } from '@/lib/sequence/edit';
import { createSequenceManager, type ManagerState, type SequenceManager, type UserInput } from '@/lib/sequence/manager';
import type { Sequence } from '@/lib/sequence/schema';
import type { SceneRef } from '@/lib/sequence/validate';

export interface SequencePlayerProps {
  sequence: Sequence;
  workspaceId: string;
  /** sceneId → 이름·타입·폴더. */
  scenes: ReadonlyMap<string, SceneRef & SceneSource>;
  serverUrl: string;
  /** 이 앱의 origin(`window.location.origin`). */
  hostOrigin: string;
  canvas: { width: number; height: number; fps: number };
  customTransitions?: ReadonlyMap<string, CustomTransition>;
}

const EMPTY_CUSTOM: ReadonlyMap<string, CustomTransition> = new Map();
const IDLE: ManagerState = { status: 'idle', current: null, next: null, step: null, t: 0, duration: null, error: null, choices: [], history: [] };

/** 키 입력을 시퀀스 입력으로. 입력에 쓰이지 않는 키는 null. */
function toInput(e: KeyboardEvent): UserInput | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  return { kind: 'key', key: e.key };
}

function useManagerState(manager: SequenceManager | null): ManagerState | null {
  return useSyncExternalStore(
    (cb) => (manager ? manager.subscribe(cb) : () => undefined),
    () => (manager ? manager.getState() : null),
  );
}

const fmt = (s: number) => `${s.toFixed(1)}s`;

/**
 * 시퀀스 재생기(F-PLY-01, T6.6). 신 iframe을 겹쳐 두고 시퀀스 매니저가 trigger로 넘긴다.
 * 입력 레이어가 iframe 위를 덮어 클릭을 받는다(신 안의 버튼은 누를 수 없고, 분기는 아래 선택지로 고른다).
 */
export function SequencePlayer({ sequence, workspaceId, scenes, serverUrl, hostOrigin, canvas, customTransitions = EMPTY_CUSTOM }: SequencePlayerProps) {
  const { t } = useLanguage();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [manager, setManager] = useState<SequenceManager | null>(null);
  const [size, setSize] = useState({ width: 640, height: 360 });
  const [startError, setStartError] = useState<string | null>(null);
  const state = useManagerState(manager) ?? IDLE; // 매니저는 스테이지가 그려진 뒤 효과에서 만들어지므로 그 전에도 틀은 그린다

  // 시퀀스·서버가 바뀌면 매니저를 새로 만든다. 이전 것은 정리한다(iframe·타이머).
  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;
    const host = new IframeSceneHost({ container, serverUrl, hostOrigin, canvas, scenes });
    const m = createSequenceManager({ sequence, scenes, workspaceId, host, runTransition: createTransitionRunner(customTransitions), customTransitions: new Set(customTransitions.keys()) });
    const off = m.subscribe(() => host.layout(m.getState()));
    setManager(m);
    setStartError(null);
    m.start().catch((e: unknown) => setStartError(e instanceof Error ? e.message : String(e)));
    return () => {
      off();
      m.dispose();
      setManager(null);
    };
  }, [sequence, scenes, workspaceId, serverUrl, hostOrigin, canvas, customTransitions]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth || 640, height: el.clientHeight || 360 });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 키보드 입력은 창 전체에서 받는다(입력 레이어에 포커스가 없어도 화살표로 넘길 수 있게).
  useEffect(() => {
    if (!manager) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      const input = toInput(e);
      if (input) manager.input(input);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manager]);

  const layout = computePreviewLayout({ container: size, format: canvas, zoom: 'fit', deviceWidth: null });
  const current = state?.current ?? null;
  const currentRef = current ? scenes.get(current) : undefined;
  const isStatic = currentRef?.type === 'static';
  const out = useMemo(() => (current ? sequence.edges.filter((e) => e.from === current) : []), [sequence, current]);
  const hints = useMemo(() => {
    const list: string[] = [];
    for (const e of out) {
      const k = triggerKind(e.trigger);
      if (k === 'click') list.push(t('player.hint.click'));
      else if (k === 'key') list.push(t('player.hint.key', { key: e.trigger.slice('key:'.length) }));
      else if (k === 'timeout') list.push(t('player.hint.timeout', { seconds: e.trigger.slice('timeout:'.length, -1) }));
    }
    return [...new Set(list)];
  }, [out, t]);
  const idx = current ? sequence.nodes.findIndex((n) => n.sceneId === current) : -1;
  const progress = state && state.duration ? Math.min(1, state.t / state.duration) : 0;
  const busy = state?.status === 'loading' || state?.status === 'transitioning';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-testid="sequence-player">
      <div ref={hostRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-muted">
        <div className="relative shrink-0 overflow-hidden bg-background shadow-lg" style={{ width: layout.box.width, height: layout.box.height }}>
          {/* 신 iframe은 이 요소 안에 쌓인다. 캔버스 크기로 그린 뒤 맞춰 줄인다. */}
          <div ref={stageRef} data-testid="player-stage" className="absolute left-0 top-0 origin-top-left" style={{ width: layout.frame.width, height: layout.frame.height, transform: `scale(${layout.scale})` }} />
          <button
            type="button"
            aria-label={t('player.input')}
            data-testid="player-input"
            className="absolute inset-0 z-10 cursor-pointer bg-transparent focus:outline-none"
            onClick={() => manager?.input({ kind: 'click' })}
          />
          {busy && (
            <div role="status" className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 text-xs">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t(state.status === 'loading' ? 'player.loading' : 'player.transitioning')}
            </div>
          )}
          {state.status === 'ended' && (
            <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 text-sm">
              <span>{t('player.ended')}</span>
              <Button size="sm" onClick={() => void manager?.start()}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {t('player.restart')}
              </Button>
            </div>
          )}
          {state.choices.length > 0 && state.status === 'playing' && (
            <div data-testid="player-choices" className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap justify-center gap-2 bg-background/70 p-2">
              {state.choices.map((label) => (
                <Button key={label} size="sm" onClick={() => void manager?.choose(label)}>
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {(state.status === 'error' || startError) && (
        <div role="alert" data-testid="player-error" className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{state.error ?? startError}</span>
          {!startError && (
            <Button size="sm" variant="outline" onClick={() => void manager?.retry()}>
              {t('player.retry')}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button size="sm" variant="outline" aria-label={t('player.restart')} onClick={() => void manager?.start()}>
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        {!isStatic && (
          <Button size="sm" variant="outline" disabled={state.status !== 'playing' && state.status !== 'paused'} onClick={() => (state.status === 'paused' ? manager?.resume() : manager?.pause())}>
            {state.status === 'paused' ? <Play className="mr-1 h-3.5 w-3.5" /> : <Pause className="mr-1 h-3.5 w-3.5" />}
            {t(state.status === 'paused' ? 'player.play' : 'player.pause')}
          </Button>
        )}
        {isStatic && (
          <>
            <Button size="sm" variant="outline" aria-label={t('player.prev')} onClick={() => manager?.back()}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" aria-label={t('player.next')} onClick={() => manager?.input({ kind: 'click' })}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            {state.step && <span data-testid="player-step">{t('player.step', { index: state.step.index + 1, total: state.step.total })}</span>}
          </>
        )}
        {state.duration ? (
          <>
            <input
              type="range"
              min={0}
              max={state.duration}
              step={0.05}
              value={Math.min(state.t, state.duration)}
              aria-label={t('player.seek')}
              disabled={busy}
              onChange={(e) => manager?.seek(Number(e.target.value))}
              className="min-w-24 flex-1"
            />
            <span className="tabular-nums text-muted-foreground" data-testid="player-time">
              {fmt(state.t)} / {fmt(state.duration)}
            </span>
          </>
        ) : (
          <span className="flex-1" />
        )}
        <span className="text-muted-foreground" data-testid="player-progress" title={`${Math.round(progress * 100)}%`}>
          {idx >= 0 ? t('player.sceneIndex', { index: idx + 1, total: sequence.nodes.length, name: currentRef?.name ?? '' }) : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <MousePointer2 className="h-3.5 w-3.5" />
        <span data-testid="player-hints">{hints.length > 0 ? hints.join(' · ') : out.some((e) => e.trigger === 'end') ? t('player.hint.auto') : t('player.hint.none')}</span>
        <span className="ml-auto flex flex-wrap gap-1">
          {sequence.nodes.map((n, i) => (
            <Button key={n.sceneId} size="sm" variant={n.sceneId === current ? 'default' : 'ghost'} aria-label={t('player.jump', { name: scenes.get(n.sceneId)?.name ?? n.sceneId })} onClick={() => void manager?.jump(n.sceneId)}>
              {i + 1}
            </Button>
          ))}
        </span>
      </div>
    </div>
  );
}
