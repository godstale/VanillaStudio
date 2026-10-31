// Presenter chrome shared by every scene: fixed 1920-wide stage scaled to the window, header + chapter chip,
// 2021→2026 era bar, step counter, keyboard and F fullscreen. A scene = one lecture scene; its screens and build
// items become click steps (content.ts `stepsOf`).
//
// Input: steps advance on "key:ArrowRight", which useSteps reads itself (and the Vanilla Studio player forwards as a
// typed input). For standalone presenting, clicks and Space/PageDown/Enter also go next, ←/PageUp/Backspace go back.
import { useEffect, useLayoutEffect, useState } from 'react';
import { useFrame, useSteps } from '@vanilla/runtime';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { Rich } from './atoms';
import { chapterOf, deckInfo, deckScene, eraOf, stepsOf, type Era } from './content';
import { FULL_BLEED, ScreenView } from './layouts';
import './deck.css';

const DESIGN_WIDTH = 1920;
const NEXT_KEYS = new Set([' ', 'PageDown', 'Enter']);
const PREV_KEYS = new Set(['ArrowLeft', 'PageUp', 'Backspace']);

function useFitScale(width: number, height: number): number {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / width, window.innerHeight / height));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [width, height]);
  return scale;
}

// Linear month-level scale: Day 2 spans only a few years, each tick marks January of that year.
function eraX(year: number): number {
  const { eraFrom, eraTo } = deckInfo;
  return Math.min(Math.max((year - eraFrom) / (eraTo - eraFrom), 0), 1);
}

function EraBar({ era }: { era: Era }) {
  const [a, b] = era.range;
  const x0 = eraX(a) * 100;
  const x1 = eraX(b) * 100;
  return (
    <div className="era" aria-hidden>
      <div className="era-track">
        <div className="era-past" style={{ width: `${x1}%` }} />
        {deckInfo.eraTicks.map((t) => (
          <span key={t} className="era-tick" style={{ left: `${eraX(t) * 100}%` }}>
            {t}
          </span>
        ))}
        {b > a && <div className="era-range" style={{ left: `${x0}%`, width: `${x1 - x0}%` }} />}
        <span className="era-dot" style={{ left: `${x1}%` }} />
        <span className="era-label" style={{ left: `${x1}%` }}>
          {era.label}
        </span>
      </div>
    </div>
  );
}

function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="head">
      <h2 className="head-title">{title}</h2>
      {sub && <Rich as="p" className="head-sub" text={sub} />}
    </header>
  );
}

export function DeckShell({ sceneKey }: { sceneKey: string }) {
  const scene = deckScene(sceneKey);
  const chapter = chapterOf(scene);
  // Scenes lay out in design units on a 1920-wide stage; its height follows the workspace canvas aspect (D-030).
  const frame = useFrame();
  const width = DESIGN_WIDTH;
  const height = Math.round((DESIGN_WIDTH * frame.height) / frame.width);
  const scale = useFitScale(width, height);
  const [steps] = useState(() => stepsOf(scene));
  const [index, setIndex] = useState(0);
  const controller = useSteps(steps, null, setIndex);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (NEXT_KEYS.has(e.key)) {
        e.preventDefault();
        controller.next();
      } else if (PREV_KEYS.has(e.key)) {
        e.preventDefault();
        controller.prev();
      } else if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => undefined);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-no-advance]')) return;
      controller.next();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [controller]);

  const step = steps[Math.min(index, steps.length - 1)];
  const screen = scene.screens[step.screen];
  const full = FULL_BLEED.has(screen.layout);
  const era = full ? null : eraOf(scene, screen);
  const screenCount = scene.screens.length;

  return (
    <div className="deck-viewport">
      <div className="deck-stage" data-scene={scene.key} style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="deck-bg" aria-hidden />
        <div key={screen.id} className={`screen ${full ? 'screen--full' : ''} ${era ? 'screen--era' : ''}`} data-layout={screen.layout}>
          {!full && <Header title={screen.title ?? scene.title} sub={screen.sub} />}
          <ScreenView scene={scene} screen={screen} shown={step.shown} chapterNo={chapter.no} />
        </div>
        {screen.layout !== 'photo' && (
          <div className="chip">
            <span className="chip-no">{chapter.no}</span>
            <span className="chip-label">{chapter.label}</span>
          </div>
        )}
        {era && <EraBar era={era} />}
        <div className="counter">
          {screenCount > 1 && (
            <span className="counter-dots" aria-hidden>
              {scene.screens.map((s, i) => (
                <i key={s.id} data-on={i <= step.screen} />
              ))}
            </span>
          )}
          <span>{scene.key.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
