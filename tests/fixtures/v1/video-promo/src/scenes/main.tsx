/* eslint-disable */
import { defineScene, useTime } from '@vanilla/runtime';

function Main() {
  const t = useTime();
  const o = Math.min(1, t / 0.6);
  return (
    <section data-testid="main" style={{ width: '100%', height: '100%', minHeight: 360, display: 'grid', placeItems: 'center', background: 'var(--color-canvas)', color: 'var(--color-ink)' }}>
      <div style={{ opacity: o }}>
        <h1 style={{ margin: 0 }}>Main</h1>
        <p>See how it works.</p>
      </div>
    </section>
  );
}

export default defineScene({ id: 'main', duration: 4, Component: Main });
