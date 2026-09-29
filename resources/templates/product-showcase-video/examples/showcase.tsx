/* eslint-disable react-refresh/only-export-components -- a scene module exports its scene definition */
// Turntable reveal for the 3D Product Showcase Video template.
// CSS-perspective 3D driven purely by t (clock contract, whole turns only).
import { clamp01, defineScene, ease, param, token, useParams, useTime } from '@vanilla/runtime';

const params = {
  name: param.text('Ember One', { label: 'Product name' }),
  claim: param.text('Light, tuned to the hour.', { label: 'Claim' }),
  bgColor: param.color(token('canvas'), { label: 'Stage' }),
  rimColor: param.color(token('primary'), { label: 'Rim light' }),
  glowColor: param.color(token('accent'), { label: 'Accent glow' }),
  speed: param.number(1, { min: 0.2, max: 2, step: 0.1, label: 'Turntable rate' }),
  face: param.select(['front', 'three-quarter'] as const, 'three-quarter', { label: 'Camera face' }),
};

function Showcase() {
  const t = useTime();
  const { name, claim, bgColor, rimColor, glowColor, speed, face } = useParams<typeof params>();
  // One whole turn every 8s at speed 1: the loop point always matches t = 0.
  const angle = ((t * speed * 360) / 8) % 360;
  const rise = ease.expoOut(clamp01(t / 1.2));
  const sweep = clamp01((t - 0.4) / 2.2);
  const baseTilt = face === 'front' ? 0 : -18;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: bgColor,
        color: 'var(--color-ink)',
        perspective: 1200,
      }}
    >
      {/* Rim-light sweep: crosses once, then rests off-stage. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(105deg, transparent ${sweep * 130 - 30}%, ${rimColor} ${sweep * 130 - 12}%, transparent ${sweep * 130 + 6}%)`,
          opacity: sweep < 1 ? 0.35 : 0,
        }}
      />
      {/* Product: layered token surfaces turning in perspective. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '46%',
          width: 300,
          height: 420,
          transformStyle: 'preserve-3d',
          transform: `translate(-50%, -50%) translateY(${(1 - rise) * 120}px) rotateX(8deg) rotateY(${baseTilt + angle}deg)`,
          opacity: rise,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 28,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-line)',
            transform: 'translateZ(46px)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span style={{ fontSize: 120, color: 'var(--color-primary)' }}>&#9670;</span>
        </div>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 28,
            background: 'var(--color-primary)',
            transform: 'translateZ(-46px)',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 8,
            bottom: 8,
            left: '50%',
            width: 92,
            background: 'var(--color-line)',
            transform: 'translateX(-50%) rotateY(90deg)',
          }}
        />
      </div>
      {/* Floor shadow + glow. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '78%',
          width: 420,
          height: 56,
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 70%)`,
          opacity: 0.3 * rise,
        }}
      />
      {/* Name + claim lower third. */}
      <div style={{ position: 'absolute', left: 96, bottom: 84, opacity: ease.expoOut(clamp01((t - 1.2) / 0.8)) }}>
        <p style={{ margin: 0, fontSize: 28, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
          {name}
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 64, fontWeight: 700, letterSpacing: '-0.02em' }}>{claim}</p>
      </div>
    </div>
  );
}

export default defineScene({ id: 'showcase', duration: 4, params, Component: Showcase });
