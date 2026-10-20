/* eslint-disable */
import { defineScene, useTime } from '@vanilla/runtime';

function S2() {
  const t = useTime();
  const o = Math.min(1, t / 0.6);
  return (
    <section data-testid="s2" style={{ width: '100%', height: '100%', minHeight: 360, display: 'grid', placeItems: 'center', background: 'var(--color-canvas)', color: 'var(--color-ink)' }}>
      <div style={{ opacity: o }}>
        <h1 style={{ margin: 0 }}>Plan</h1>
        <p>What we will do.</p>
      </div>
    </section>
  );
}

export default defineScene({ id: 's2', Component: S2 });
