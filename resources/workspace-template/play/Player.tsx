// Standalone sequence player UI (mirrors the Studio play screen, simplified).
// One iframe + input overlay: clicks/keys are forwarded as typed Bridge `input`
// so static scenes advance only on matching advance rules (D-032). Explicit
// step buttons use legacy `next`/`prev`, which also works on old runtimes.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SameOriginScene } from './host';
import { loadManifest, type Manifest } from './manifest';
import { createNavigator, type NavigatorState, type PlayNavigator } from './navigator';
import './play.css';

const MANIFEST: Manifest = loadManifest();

const IDLE: NavigatorState = {
  status: 'idle',
  current: null,
  index: -1,
  total: MANIFEST.order.length,
  step: null,
  t: 0,
  duration: null,
  choices: [],
  error: null,
};

const STR = {
  prevScene: '이전 신',
  nextScene: '다음 신',
  prevStep: '이전 단계',
  nextStep: '다음 단계',
  restart: '처음부터',
  play: '재생',
  pause: '일시정지',
  retry: '다시 시도',
  fullscreen: '전체화면',
  help: '도움말',
  close: '닫기',
  sceneList: '신 목록',
  ended: '시퀀스가 끝났습니다.',
  empty: '재생할 신이 없습니다. sequence.json에 노드를 추가하세요.',
  loading: '신을 불러오는 중…',
  volume: '음량',
  mute: '음소거',
  unmute: '음소거 해제',
} as const;

function hashSceneId(): string | null {
  const m = /^#\/play\/([A-Za-z0-9_-]+)$/.exec(window.location.hash);
  return m ? m[1] : null;
}

function useNavigatorState(nav: PlayNavigator | null): NavigatorState {
  return useSyncExternalStore(
    (cb) => (nav ? nav.subscribe(cb) : () => undefined),
    () => (nav ? nav.getState() : IDLE),
  );
}

const fmtTime = (s: number): string => `${s.toFixed(1)}s`;

/** Text entry focus keeps its keys; range sliders and buttons don't swallow arrows. */
function isTextInput(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  if (target.tagName !== 'INPUT') return false;
  const type = (target as HTMLInputElement).type;
  return type !== 'range' && type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit' && type !== 'color' && type !== 'file';
}

export function Player() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageBoxRef = useRef<HTMLDivElement | null>(null);
  const [nav, setNav] = useState<PlayNavigator | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [box, setBox] = useState({ width: 960, height: 540 });
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
  const state = useNavigatorState(nav);

  useEffect(() => {
    if (MANIFEST.warnings.length > 0) console.warn('[play]', MANIFEST.warnings.join('\n[play] '));
  }, []);

  // Fit the workspace canvas into the stage area (letterbox).
  useEffect(() => {
    const el = stageBoxRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const scale = Math.min(r.width / MANIFEST.canvas.width, r.height / MANIFEST.canvas.height);
      const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
      setBox({
        width: Math.max(1, Math.floor(MANIFEST.canvas.width * s)),
        height: Math.max(1, Math.floor(MANIFEST.canvas.height * s)),
      });
    };
    fit();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Navigator owns one iframe; scenes swap its src.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || MANIFEST.order.length === 0) return;
    const n = createNavigator({
      manifest: MANIFEST,
      createDriver: (sceneId) => {
        const meta = MANIFEST.scenes.get(sceneId);
        if (!meta) throw new Error(`unknown scene ${sceneId}`);
        return new SameOriginScene(iframe, `scenes/${meta.slug}/${meta.entry}`, MANIFEST.canvas);
      },
    });
    setNav(n);
    const initial = hashSceneId();
    if (initial && MANIFEST.order.includes(initial)) void n.jump(initial);
    else void n.start();
    return () => {
      n.dispose();
      setNav(null);
    };
  }, []);

  const current = state.current ? MANIFEST.scenes.get(state.current) : undefined;
  const currentId = state.current;
  const isStatic = current?.type === 'static';
  const busy = state.status === 'loading';
  const empty = MANIFEST.order.length === 0;
  /** 클릭 분기가 없는 영상 신의 화면 클릭은 재생/일시정지 전환으로 쓴다. */
  const hasClickEdge = currentId ? MANIFEST.sequence.edges.some((e) => e.from === currentId && e.trigger === 'click') : false;

  // Player chrome audio: persisted locally, forwarded as preview param overrides.
  useEffect(() => {
    try {
      window.localStorage.setItem('vp-volume', String(volume));
    } catch {
      // private mode: ignore
    }
    nav?.setAudio(volume, muted);
  }, [nav, volume, muted]);

  useEffect(() => {
    try {
      window.localStorage.setItem('vp-muted', muted ? '1' : '0');
    } catch {
      // private mode: ignore
    }
  }, [muted]);

  const handleStageClick = () => {
    if (isStatic || hasClickEdge) nav?.input({ kind: 'click' });
    else if (state.status === 'paused') nav?.resume();
    else if (state.status === 'playing') nav?.pause();
  };

  // Deep link: keep the hash on the current scene (replace, no history spam).
  useEffect(() => {
    if (currentId) window.history.replaceState(null, '', `#/play/${currentId}`);
  }, [currentId]);

  useEffect(() => {
    document.title = currentId
      ? `${MANIFEST.scenes.get(currentId)?.name ?? currentId} — ${MANIFEST.workspaceName}`
      : `${MANIFEST.workspaceName} — Play`;
  }, [currentId]);

  // Keyboard: ArrowLeft steps back (Studio parity), everything else is typed
  // input — the scene matches it against its own advance rules and shortcuts.
  // Range sliders (seek/volume) don't swallow arrows: they still navigate scenes.
  useEffect(() => {
    if (!nav) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (isTextInput(target)) return;
      if (target?.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range' && (e.key.startsWith('Arrow') || e.key === ' ')) e.preventDefault();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const s = nav.getState();
        const meta = s.current ? MANIFEST.scenes.get(s.current) : undefined;
        if (meta?.type === 'static' && s.step && s.step.index > 0) nav.back();
        else void nav.prevScene();
        return;
      }
      if (e.key === ' ') e.preventDefault();
      nav.input({ kind: 'key', key: e.key });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div ref={rootRef} className="vp-root">
      <header className="vp-top">
        <span className="vp-title" title={MANIFEST.workspaceName}>
          {MANIFEST.workspaceName}
        </span>
        {!empty && (
          <select
            aria-label={STR.sceneList}
            className="vp-select"
            value={state.current ?? ''}
            disabled={busy}
            onChange={(e) => {
              if (e.target.value) void nav?.jump(e.target.value);
            }}
          >
            {MANIFEST.order.map((id, i) => (
              <option key={id} value={id}>
                {`${i + 1}. ${MANIFEST.scenes.get(id)?.name ?? id}`}
              </option>
            ))}
          </select>
        )}
        <span className="vp-counter" aria-live="polite">
          {!empty && state.index >= 0 ? `${state.index + 1} / ${state.total}` : ''}
        </span>
        <span className="vp-spacer" />
        <button type="button" className="vp-btn" aria-label={STR.help} title={STR.help} onClick={() => setShowHelp((v) => !v)}>
          ?
        </button>
        <button type="button" className="vp-btn" aria-label={STR.fullscreen} title={STR.fullscreen} onClick={toggleFullscreen}>
          ⛶
        </button>
      </header>

      <div ref={stageBoxRef} className="vp-stagebox">
        {empty ? (
          <p role="status" className="vp-empty">
            {STR.empty}
          </p>
        ) : (
          <div className="vp-stage" style={{ width: box.width, height: box.height }}>
            <iframe ref={iframeRef} title={current?.name ?? 'scene'} className="vp-frame" tabIndex={-1} />
            <button
              type="button"
              aria-label="scene input"
              className="vp-input"
              onClick={handleStageClick}
            />
            {busy && (
              <div role="status" className="vp-overlay">
                {STR.loading}
              </div>
            )}
            {state.status === 'ended' && (
              <div role="status" className="vp-overlay">
                <span>{STR.ended}</span>
                <button type="button" className="vp-btn vp-btn-primary" onClick={() => void nav?.start()}>
                  {STR.restart}
                </button>
              </div>
            )}
            {state.status === 'error' && (
              <div role="alert" className="vp-overlay vp-error">
                <span className="vp-error-msg">{state.error}</span>
                <button type="button" className="vp-btn vp-btn-primary" onClick={() => void nav?.retry()}>
                  {STR.retry}
                </button>
              </div>
            )}
            {state.choices.length > 0 && state.status === 'playing' && (
              <div className="vp-choices">
                {state.choices.map((label) => (
                  <button key={label} type="button" className="vp-btn vp-btn-primary" onClick={() => void nav?.choose(label)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!empty && (
        <footer className="vp-bar">
          <button type="button" className="vp-btn" aria-label={STR.restart} title={STR.restart} onClick={() => void nav?.start()}>
            ⏮
          </button>
          <button
            type="button"
            className="vp-btn"
            aria-label={STR.prevScene}
            title={STR.prevScene}
            disabled={busy || state.index <= 0}
            onClick={() => void nav?.prevScene()}
          >
            ‹‹
          </button>
          {isStatic ? (
            <>
              <button
                type="button"
                className="vp-btn"
                aria-label={STR.prevStep}
                title={STR.prevStep}
                disabled={busy}
                onClick={() => {
                  const s = nav?.getState();
                  if (s?.step && s.step.index > 0) nav?.back();
                  else void nav?.prevScene();
                }}
              >
                ‹
              </button>
              <button type="button" className="vp-btn" aria-label={STR.nextStep} title={STR.nextStep} disabled={busy} onClick={() => nav?.stepForward()}>
                ›
              </button>
              {state.step && (
                <span className="vp-meta">
                  {state.step.index + 1} / {state.step.total} 단계
                </span>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="vp-btn"
                aria-label={state.status === 'paused' ? STR.play : STR.pause}
                title={state.status === 'paused' ? STR.play : STR.pause}
                disabled={state.status !== 'playing' && state.status !== 'paused'}
                onClick={() => (state.status === 'paused' ? nav?.resume() : nav?.pause())}
              >
                {state.status === 'paused' ? '▶' : '❚❚'}
              </button>
              {state.duration !== null && (
                <>
                  <input
                    type="range"
                    min={0}
                    max={state.duration}
                    step={0.05}
                    value={Math.min(state.t, state.duration)}
                    aria-label="seek"
                    disabled={busy}
                    className="vp-seek"
                    onChange={(e) => nav?.seek(Number(e.target.value))}
                  />
                  <span className="vp-meta">
                    {fmtTime(state.t)} / {fmtTime(state.duration)}
                  </span>
                </>
              )}
            </>
          )}
          <button
            type="button"
            className="vp-btn"
            aria-label={STR.nextScene}
            title={STR.nextScene}
            disabled={busy || state.index < 0 || state.index >= state.total - 1}
            onClick={() => void nav?.nextScene()}
          >
            ››
          </button>
          <span className="vp-vol">
            <button
              type="button"
              className="vp-btn"
              aria-label={muted ? STR.unmute : STR.mute}
              title={muted ? STR.unmute : STR.mute}
              aria-pressed={muted}
              onClick={() => setMuted((m) => !m)}
            >
              {muted ? '🔇' : volume === 0 ? '🔈' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label={STR.volume}
              title={STR.volume}
              className="vp-vol-slider"
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (v > 0 && muted) setMuted(false);
                if (v === 0) setMuted(true);
              }}
            />
          </span>
          <span className="vp-current" title={current?.name ?? ''}>
            {current?.name ?? ''}
          </span>
        </footer>
      )}

      {showHelp && (
        <div className="vp-help-wrap">
          <div role="dialog" aria-label={STR.help} className="vp-help">
            <h2>발표용 재생 화면</h2>
            <ul>
              <li>클릭·키 입력은 신의 진행 규칙에 따라 단계가 넘어갑니다. 마지막 단계에서 입력하면 다음 신으로 이동합니다.</li>
              <li>→ · Space · Enter: 다음 단계 · ←: 이전 단계/이전 신 · F11 대신 ⛶ 버튼으로 전체화면을 씁니다.</li>
              <li>‹ › 버튼은 단계를, ‹‹ ›› 버튼과 상단 목록은 신을 직접 옮깁니다. 주소 `#/play/&lt;sceneId&gt;`로 특정 신을 바로 열 수 있습니다.</li>
              <li>분기(choice) 신에서는 화면 아래 선택지를 고릅니다.</li>
              <li>영상 신에서는 화면을 클릭하면 재생·일시정지가 바뀝니다(클릭 분기가 있는 신은 제외).</li>
              <li>하단 바의 🔊 버튼·슬라이더로 음량과 음소거를 조절합니다 (신 오디오에 적용, 설정은 브라우저에 저장).</li>
              <li>구 런타임(구 Bridge) 신에서는 클릭·키 위임이 무시될 수 있습니다. 그때는 ‹ › 단계 버튼을 쓰세요.</li>
              <li>전환 연출은 끊김 없는 컷/페이드로 단순화됩니다. 스튜디오의 전환 합성과 동일하지 않습니다.</li>
            </ul>
            {MANIFEST.warnings.length > 0 && (
              <>
                <h2>주의</h2>
                <ul>
                  {MANIFEST.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </>
            )}
            <button type="button" className="vp-btn vp-btn-primary" onClick={() => setShowHelp(false)}>
              {STR.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
