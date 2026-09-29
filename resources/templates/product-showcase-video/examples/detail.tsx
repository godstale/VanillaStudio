/* eslint-disable react-refresh/only-export-components -- a scene module exports its scene definition */
// Spec-callout scene for the 3D Product Showcase Video template.
// Two cards dock from the floor; an accent pulse marks the hero detail.
// All motion is a pure function of t (clock contract).
import type { CSSProperties } from 'react';
import { clamp01, defineScene, ease, param, token, useParams, useTime } from '@vanilla/runtime';

const params = {
  specA: param.text('38h battery — a week of evenings', { label: 'Spec card A' }),
  specB: param.text('Brass dial, sapphire glass', { label: 'Spec card B' }),
  bgColor: param.color(token('canvas'), { label: 'Stage' }),
  edgeColor: param.color(token('primary'), { label: 'Card edge' }),
  glowColor: param.color(token('accent'), { label: 'Accent glow' }),
  speed: param.number(1, { min: 0.2, max: 2, step: 0.1, label: 'Motion rate' }),
};

function Detail() {
  const t = useTime();
  const { specA, specB, bgColor, edgeColor, glowColor, speed } = useParams<typeof params>();
  const a = ease.expoOut(clamp01(((t - 0.4) * speed) / 0.8));
  const b = ease.expoOut(clamp01(((t - 0.8) * speed) / 0.8));
  // Accent pulse decays to ~0 before the scene ends (loop-safe).
  const pulse = Math.exp(-3 * Math.max(0, t * speed - 1.2));
  const card = (entered: number): CSSProperties => ({
    borderLeft: `4px solid ${edgeColor}`,
    background: 'var(--color-surface)',
    color: 'var(--color-ink)',
    borderRadius: 'var(--rounded-md, 12px)',
    padding: '28px 36px',
    fontSize: 30,
    maxWidth: 560,
    opacity: entered,
    transform: `translateY(${(1 - entered) * 48}px)`,
  });
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 96px',
        boxSizing: 'border-box',
      }}
    >
      <div style={card(a)}>{specA}</div>
      <div style={{ position: 'relative' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: -24,
            borderRadius: 'var(--rounded-md, 12px)',
            background: glowColor,
            opacity: pulse * 0.35,
          }}
        />
        <div style={{ ...card(b), position: 'relative' }}>{specB}</div>
      </div>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '78%',
          height: 1,
          background: 'var(--color-line)',
          opacity: 0.7,
        }}
      />
    </div>
  );
}

export default defineScene({ id: 'detail', duration: 5, params, Component: Detail });
