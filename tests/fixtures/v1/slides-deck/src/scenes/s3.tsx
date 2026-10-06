/* eslint-disable */
import { defineScene, useTime } from '@vanilla/runtime';

function S3() {
  const t = useTime();
  const o = Math.min(1, t / 0.6);
  return (
    <section data-testid="s3" style={{ width: '100%', height: '100%', minHeight: 360, display: 'grid', placeItems: 'center', background: 'var(--color-canvas)', color: 'var(--color-ink)' }}>
      <div style={{ opacity: o }}>
        <h1 style={{ margin: 0 }}>Close</h1>
        <p>Thank you.</p>
      </div>
    </section>
  );
}

export default defineScene({ id: 's3', Component: S3 });
