/* eslint-disable */
import { defineScene, param, useParams, useTime } from '@vanilla/runtime';

const params = { title: param.text('Welcome', { label: 'Title' }) };

function Hero() {
  const t = useTime();
  const { title } = useParams<typeof params>();
  const o = Math.min(1, t / 0.6);
  return (
    <section data-testid="hero" style={{ width: '100%', height: '100%', minHeight: 360, display: 'grid', placeItems: 'center', background: 'var(--color-canvas)', color: 'var(--color-ink)' }}>
      <div style={{ opacity: o }}>
        <h1 id="title" style={{ margin: 0 }}>{title}</h1>
        <p>A friendly landing page.</p>
      </div>
    </section>
  );
}

export default defineScene({ id: 'hero', params, Component: Hero });
