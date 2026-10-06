import { defineScene, useFrame, useTime } from '@vanilla/runtime';

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function Outro() {
  const t = useTime();
  const { width, height } = useFrame();
  const a = ease(clamp01(t / 0.8));
  return (
    <div
      data-testid="outro"
      style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-accent)', color: 'var(--color-canvas)', fontFamily: 'sans-serif' }}
    >
      <h1 style={{ margin: 0, fontSize: height * 0.1, opacity: a, transform: `scale(${0.9 + 0.1 * a})` }}>Thank you</h1>
    </div>
  );
}

export default defineScene({ id: 'outro', duration: 2, Component: Outro });
