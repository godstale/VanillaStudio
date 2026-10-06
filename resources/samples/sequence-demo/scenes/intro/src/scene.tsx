import { defineScene, useFrame, useTime } from '@vanilla/runtime';

// 모션 신: 모든 움직임은 useTime()의 순수 함수다(같은 t → 같은 프레임). 색은 DESIGN.md 토큰(CSS 변수)만 쓴다.
const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function Intro() {
  const t = useTime();
  const { width, height } = useFrame();
  const title = ease(clamp01(t / 0.9));
  const sub = ease(clamp01((t - 1.4) / 0.9));
  const hold = ease(clamp01((t - 3.2) / 0.5));
  return (
    <div
      data-testid="intro"
      style={{ width, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, background: 'var(--color-canvas)', color: 'var(--color-ink)', fontFamily: 'sans-serif' }}
    >
      <h1 style={{ margin: 0, fontSize: height * 0.12, opacity: title, transform: `translateY(${(1 - title) * 40}px)` }}>Vanilla Studio</h1>
      <p style={{ margin: 0, fontSize: height * 0.045, opacity: sub, color: 'var(--color-primary)' }}>Scenes in motion</p>
      <div style={{ width: width * 0.3 * hold, height: 6, background: 'var(--color-accent)' }} />
    </div>
  );
}

export default defineScene({ id: 'intro', duration: 4, Component: Intro });
