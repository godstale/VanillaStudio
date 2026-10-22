import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Eraser, Loader2, Pause, Pencil, Play, RotateCcw, SkipBack, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnnotationLayer, type AnnotTool } from './AnnotationLayer';
import { ERASER_RADIUS, PEN_COLOR, PEN_WIDTH, type AnnotPoint, type AnnotStroke, eraseStrokes } from '@/lib/playground/annotations';
import { IframeSceneHost, type SceneSource } from '@/lib/playground/iframeScene';
import { createTransitionRunner } from '@/lib/playground/sceneTransitions';
import type { CustomTransition } from '@/lib/playground/transitions/custom';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { computePreviewLayout } from '@/lib/review/previewLayout';
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
  /** 지정하면 재생 시작 뒤 그 신으로 이동한다(플레이그라운드 플로팅 재생용). */
  initialSceneId?: string | null;
  /** true면 재생 화면만 보여주고 하단 바·오버레이를 숨긴다(전체화면 녹화 미리보기용). */
  hideChrome?: boolean;
}

const EMPTY_CUSTOM: ReadonlyMap<string, CustomTransition> = new Map();
const IDLE: ManagerState = { status: 'idle', current: null, next: null, step: null, t: 0, duration: null, error: null, choices: [], history: [] };

/** 키 입력을 시퀀스 입력으로. 입력에 쓰이지 않는 키는 null. */
function toInput(e: KeyboardEvent): UserInput | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  // static 신에는 타입 입력 그대로 위임한다: 신이 advance와 맞을 때만 진행하므로
  // 신 단축키(N·F 등)나 맞지 않는 화살표가 다음으로 넘어가지 않는다.
  return { kind: 'key', key: e.key };
}

/** 글자 입력란(텍스트·검색·URL 등)에 포커스가 있으면 키를 가로채지 않는다. range 슬라이더·버튼은 제외. */
function isTextInput(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  if (target.tagName !== 'INPUT') return false;
  const type = (target as HTMLInputElement).type;
  return type !== 'range' && type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit' && type !== 'color' && type !== 'file';
}

function useManagerState(manager: SequenceManager | null): ManagerState | null {
  return useSyncExternalStore(
    (cb) => (manager ? manager.subscribe(cb) : () => undefined),
    () => (manager ? manager.getState() : null),
  );
}

const fmt = (s: number) => `${s.toFixed(1)}s`;

/** `[>]` 길게 누르기로 신 점프 팝업을 여는 시간(ms). */
const JUMP_LONG_PRESS_MS = 500;

/**
 * 시퀀스 재생기(F-PLY-01, T6.6). 신 iframe을 겹쳐 두고 시퀀스 매니저가 trigger로 넘긴다.
 * 입력 레이어가 iframe 위를 덮어 클릭을 받는다(신 안의 버튼은 누를 수 없고, 분기는 아래 선택지로 고른다).
 */
export function SequencePlayer({ sequence, workspaceId, scenes, serverUrl, hostOrigin, canvas, customTransitions = EMPTY_CUSTOM, initialSceneId, hideChrome = false }: SequencePlayerProps) {
  const { t } = useLanguage();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [manager, setManager] = useState<SequenceManager | null>(null);
  const [size, setSize] = useState({ width: 640, height: 360 });
  const [startError, setStartError] = useState<string | null>(null);
  const state = useManagerState(manager) ?? IDLE; // 매니저는 스테이지가 그려진 뒤 효과에서 만들어지므로 그 전에도 틀은 그린다
  /** 신 점프 팝업 위치(화면 좌표). null이면 닫힘. */
  const [jumpMenu, setJumpMenu] = useState<{ x: number; y: number } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 길게 누르기로 팝업을 열었으면 뒤따르는 click을 무시한다. */
  const suppressNextClick = useRef(false);

  useEffect(() => () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // 시퀀스·서버가 바뀌면 매니저를 새로 만든다. 이전 것은 정리한다(iframe·타이머).
  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;
    const host = new IframeSceneHost({ container, serverUrl, hostOrigin, canvas, scenes });
    const m = createSequenceManager({ sequence, scenes, workspaceId, host, runTransition: createTransitionRunner(customTransitions), customTransitions: new Set(customTransitions.keys()) });
    const off = m.subscribe(() => host.layout(m.getState()));
    setManager(m);
    setStartError(null);
    m.start()
      .then(() => {
        if (initialSceneId && scenes.has(initialSceneId)) void m.jump(initialSceneId);
      })
      .catch((e: unknown) => setStartError(e instanceof Error ? e.message : String(e)));
    return () => {
      off();
      m.dispose();
      setManager(null);
    };
  }, [sequence, scenes, workspaceId, serverUrl, hostOrigin, canvas, customTransitions, initialSceneId]);

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
  // 슬라이드(정적 신)는 프레젠테이션 겸용이므로 ArrowLeft는 이전 스텝·이전 신으로 되돌린다.
  // 시크·음량 슬라이더(input[type=range])에 포커스가 있어도 화살표는 신 이동으로 쓴다(슬라이더 조절과 충돌하므로 preventDefault).
  useEffect(() => {
    if (!manager) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (isTextInput(target)) return;
      if (target?.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range' && (e.key.startsWith('Arrow') || e.key === ' ')) e.preventDefault();
      if (e.key === 'ArrowLeft') {
        const s = manager.getState();
        const cur = s.current ? scenes.get(s.current) : undefined;
        if (cur?.type === 'static' && (s.status === 'playing' || s.status === 'paused')) {
          e.preventDefault();
          if (s.step && s.step.index > 0) manager.back();
          else if (s.history.length >= 2) void manager.jump(s.history[s.history.length - 2]);
          else {
            const at = sequence.nodes.findIndex((n) => n.sceneId === s.current);
            if (at > 0) void manager.jump(sequence.nodes[at - 1].sceneId);
          }
          return;
        }
      }
      const input = toInput(e);
      if (input) manager.input(input);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manager, scenes, sequence.nodes]);

  const layout = computePreviewLayout({ container: size, format: canvas, zoom: 'fit', deviceWidth: null, padding: 0 });
  const current = state?.current ?? null;
  const currentRef = current ? scenes.get(current) : undefined;
  const isStatic = currentRef?.type === 'static';
  const idx = current ? sequence.nodes.findIndex((n) => n.sceneId === current) : -1;
  const busy = state?.status === 'loading' || state?.status === 'transitioning';

  /** 슬라이드 발표용 필기: 정적 신에서만, 신별 메모리 보관(파일에 저장 안 함). */
  const [annotSel, setAnnotSel] = useState<{ scene: string | null; tool: 'off' | AnnotTool }>({ scene: null, tool: 'off' });
  const [annotByScene, setAnnotByScene] = useState<Readonly<Record<string, AnnotStroke[]>>>({});
  const annotId = useRef(1);
  // 신이 바뀌면 필기 모드를 끈다(다음 클릭이 진행으로 동작하도록). 렌더 중 이전 값과 비교해 조정한다.
  if (annotSel.scene !== current) {
    setAnnotSel({ scene: current, tool: 'off' });
  }
  const annotTool = isStatic && annotSel.scene === current ? annotSel.tool : 'off';
  const annotating = isStatic && annotTool !== 'off';
  const annotStrokes = current ? (annotByScene[current] ?? []) : [];

  const toggleAnnotTool = useCallback(
    (tool: AnnotTool) => {
      setAnnotSel((prev) => (prev.scene === current && prev.tool === tool ? { scene: current, tool: 'off' } : { scene: current, tool }));
    },
    [current],
  );

  const handleStrokeEnd = useCallback(
    (points: AnnotPoint[]) => {
      if (!current) return;
      const id = annotId.current;
      annotId.current += 1;
      const stroke: AnnotStroke = { id, color: PEN_COLOR, width: PEN_WIDTH, points };
      setAnnotByScene((prev) => ({ ...prev, [current]: [...(prev[current] ?? []), stroke] }));
    },
    [current],
  );

  const handleEraseAt = useCallback(
    (point: AnnotPoint) => {
      if (!current) return;
      setAnnotByScene((prev) => {
        const next = eraseStrokes(prev[current] ?? [], point, ERASER_RADIUS);
        if (next.length === (prev[current] ?? []).length) return prev;
        return { ...prev, [current]: next };
      });
    },
    [current],
  );

  const handleClearAnnot = useCallback(() => {
    if (!current) return;
    setAnnotByScene((prev) => (prev[current]?.length ? { ...prev, [current]: [] } : prev));
  }, [current]);

  /** 정적 신의 이전 버튼: 스텝이 있으면 한 칸 뒤로, 첫 스텝이면 이전 신으로. */
  const handlePrev = () => {
    if (!manager) return;
    const s = manager.getState();
    if (s.step && s.step.index > 0) manager.back();
    else if (s.history.length >= 2) void manager.jump(s.history[s.history.length - 2]);
    else {
      const at = sequence.nodes.findIndex((n) => n.sceneId === s.current);
      if (at > 0) void manager.jump(sequence.nodes[at - 1].sceneId);
      else manager.back();
    }
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-black" data-testid="sequence-player">
      <div ref={hostRef} className="relative h-full min-h-0 w-full overflow-hidden bg-black">
        <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative shrink-0 overflow-hidden bg-black" style={{ width: layout.box.width, height: layout.box.height }}>
          {/* 신 iframe은 이 요소 안에 쌓인다. 캔버스 크기로 그린 뒤 맞춰 줄인다. */}
          <div ref={stageRef} data-testid="player-stage" className="absolute left-0 top-0 origin-top-left" style={{ width: layout.frame.width, height: layout.frame.height, transform: `scale(${layout.scale})` }} />
          <button
            type="button"
            aria-label={t('player.input')}
            data-testid="player-input"
            disabled={annotating}
            className={`absolute inset-0 z-10 bg-transparent focus:outline-none ${annotating ? 'pointer-events-none' : 'cursor-pointer'}`}
            onClick={() => {
              if (!annotating) manager?.input({ kind: 'click' });
            }}
          />
          {isStatic && (
            <AnnotationLayer
              canvas={canvas}
              strokes={annotStrokes}
              active={annotating}
              tool={annotTool === 'off' ? 'pen' : annotTool}
              onStrokeEnd={handleStrokeEnd}
              onEraseAt={handleEraseAt}
            />
          )}
          {!hideChrome && busy && (
            <div role="status" className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 text-xs">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t(state.status === 'loading' ? 'player.loading' : 'player.transitioning')}
            </div>
          )}
          {!hideChrome && state.status === 'ended' && (
            <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 text-sm">
              <span>{t('player.ended')}</span>
              <Button size="sm" onClick={() => void manager?.start()}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {t('player.restart')}
              </Button>
            </div>
          )}
          {!hideChrome && state.choices.length > 0 && state.status === 'playing' && (
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
      </div>

      {!hideChrome && (state.status === 'error' || startError) && (
        <div role="alert" data-testid="player-error" className="absolute left-1/2 top-2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-start gap-2 rounded-lg border border-destructive/40 bg-black/70 p-2 text-xs text-destructive backdrop-blur">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{state.error ?? startError}</span>
          {!startError && (
            <Button size="sm" variant="outline" onClick={() => void manager?.retry()}>
              {t('player.retry')}
            </Button>
          )}
        </div>
      )}

      {!hideChrome && (
      <div className="absolute bottom-2 left-1/2 z-30 flex h-8 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1 overflow-hidden rounded-lg border border-border bg-card/95 px-1.5 text-[11px] text-foreground shadow-lg backdrop-blur" data-testid="player-bar">
        <Button size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0" aria-label={t('player.restart')} onClick={() => void manager?.start()}>
          <SkipBack className="h-3 w-3" />
        </Button>
        {!isStatic && (
          <Button size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0" aria-label={t(state.status === 'paused' ? 'player.play' : 'player.pause')} disabled={state.status !== 'playing' && state.status !== 'paused'} onClick={() => (state.status === 'paused' ? manager?.resume() : manager?.pause())}>
            {state.status === 'paused' ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </Button>
        )}
        {isStatic && (
          <>
            <Button size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0" aria-label={t('player.prev')} onClick={handlePrev}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 shrink-0 p-0"
              aria-label={t('player.next')}
              aria-haspopup="menu"
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                cancelPress();
                pressTimer.current = setTimeout(() => {
                  pressTimer.current = null;
                  suppressNextClick.current = true;
                  setJumpMenu({ x: rect.left + rect.width / 2, y: rect.top });
                }, JUMP_LONG_PRESS_MS);
              }}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                cancelPress();
                setJumpMenu({ x: e.clientX, y: e.clientY });
              }}
              onClick={() => {
                if (suppressNextClick.current) {
                  suppressNextClick.current = false;
                  return;
                }
                manager?.stepForward();
              }}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            {state.step && <span data-testid="player-step" className="shrink-0 tabular-nums text-muted-foreground">{t('player.step', { index: state.step.index + 1, total: state.step.total })}</span>}
            <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
            <Button
              size="sm"
              variant="ghost"
              className={`h-6 w-6 shrink-0 p-0 ${annotTool === 'pen' ? 'bg-primary/20 text-primary' : ''}`}
              aria-label={t('player.draw')}
              aria-pressed={annotTool === 'pen'}
              title={t('player.draw')}
              onClick={() => toggleAnnotTool('pen')}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-6 w-6 shrink-0 p-0 ${annotTool === 'eraser' ? 'bg-primary/20 text-primary' : ''}`}
              aria-label={t('player.erase')}
              aria-pressed={annotTool === 'eraser'}
              title={t('player.erase')}
              onClick={() => toggleAnnotTool('eraser')}
            >
              <Eraser className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 shrink-0 p-0"
              aria-label={t('player.clearDraw')}
              title={t('player.clearDraw')}
              disabled={annotStrokes.length === 0}
              onClick={handleClearAnnot}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
        {state.duration && (
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
              className="w-40 accent-primary"
            />
            <span className="shrink-0 tabular-nums text-muted-foreground" data-testid="player-time">
              {fmt(state.t)} / {fmt(state.duration)}
            </span>
          </>
        )}
        <span className="ml-1 shrink-0 tabular-nums text-muted-foreground" data-testid="player-progress">
          {idx >= 0 ? t('player.position', { index: idx + 1, total: sequence.nodes.length }) : ''}
        </span>
      </div>
      )}
      {!hideChrome && jumpMenu && (
        <>
          <button
            type="button"
            aria-label={t('float.close')}
            data-testid="player-jump-backdrop"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setJumpMenu(null)}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div
            role="menu"
            aria-label={t('player.jumpTitle')}
            data-testid="player-jump-menu"
            className="fixed z-50 w-52 overflow-hidden rounded-lg border border-white/10 bg-black/90 text-xs text-white shadow-xl backdrop-blur"
            style={{
              left: Math.min(Math.max(jumpMenu.x, 112), window.innerWidth - 112),
              top: Math.max(jumpMenu.y - 8, 8),
              transform: 'translate(-50%, -100%)',
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <p className="border-b border-white/10 px-2 py-1.5 text-[11px] text-white/60">{t('player.jumpTitle')}</p>
            <ul className="max-h-56 overflow-auto p-1">
              {sequence.nodes.map((n, i) => {
                const active = n.sceneId === current;
                return (
                  <li key={n.sceneId}>
                    <button
                      type="button"
                      role="menuitem"
                      aria-label={t('player.jump', { name: scenes.get(n.sceneId)?.name ?? n.sceneId })}
                      onClick={() => {
                        setJumpMenu(null);
                        void manager?.jump(n.sceneId);
                      }}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-white/15 ${active ? 'bg-white/10' : ''}`}
                    >
                      <span className="w-6 shrink-0 tabular-nums text-white/50">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{scenes.get(n.sceneId)?.name ?? n.sceneId}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
