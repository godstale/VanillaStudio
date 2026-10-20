/* eslint-disable */
import { defineScene, useTime } from '@vanilla/runtime';

function Features() {
  const t = useTime();
  const o = Math.min(1, t / 0.6);
  return (
    <section data-testid="features" style={{ width: '100%', height: '100%', minHeight: 360, display: 'grid', placeItems: 'center', background: 'var(--color-canvas)', color: 'var(--color-ink)' }}>
      <div style={{ opacity: o }}>
        <h1 style={{ margin: 0 }}>Features</h1>
        <p>Three things we do well.</p>
      </div>
    </section>
  );
}

export default defineScene({ id: 'features', Component: Features });
