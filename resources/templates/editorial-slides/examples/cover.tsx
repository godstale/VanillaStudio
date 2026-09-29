/* eslint-disable react-refresh/only-export-components -- a scene module exports its scene definition */
// Cover scene for the Minimal Editorial Slides template.
// Token-only styling; entrance is a pure function of t (clock contract).
import { clamp01, defineScene, ease, param, token, useParams, useTime } from '@vanilla/runtime';

const params = {
  kicker: param.text('A Vanilla Studio template', { label: 'Kicker' }),
  title: param.text('Quiet paper, loud ideas', { label: 'Title' }),
  subtitle: param.text('A minimal editorial deck for talks that should read, not shout.', { label: 'Subtitle' }),
  bgColor: param.color(token('canvas'), { label: 'Background' }),
  ruleColor: param.color(token('primary'), { label: 'Rule color' }),
  speed: param.number(1, { min: 0.2, max: 2, step: 0.1, label: 'Entrance speed' }),
  align: param.select(['left', 'center'] as const, 'left', { label: 'Alignment' }),
};

function Cover() {
  const t = useTime();
  const { kicker, title, subtitle, bgColor, ruleColor, speed, align } = useParams<typeof params>();
  const p = ease.expoOut(clamp01((t * speed) / 1));
  const rise = (1 - p) * 24;
  const centered = align === 'center';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: 120,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: centered ? 'center' : 'flex-start',
        textAlign: centered ? 'center' : 'left',
        background: bgColor,
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-body, Arial, sans-serif)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 24,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--color-primary)',
          opacity: p,
          transform: `translateY(${rise}px)`,
        }}
      >
        {kicker}
      </p>
      <div
        aria-hidden
        style={{
          width: 96,
          height: 6,
          margin: '28px 0',
          background: ruleColor,
          borderRadius: 'var(--rounded-md, 4px)',
          opacity: p,
        }}
      />
      <h1
        style={{
          margin: 0,
          maxWidth: 1400,
          fontFamily: 'var(--font-display, Georgia, serif)',
          fontWeight: 400,
          fontSize: 120,
          lineHeight: 1.02,
          letterSpacing: '-0.015em',
          opacity: p,
          transform: `translateY(${rise * 1.4}px)`,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: '32px 0 0',
          maxWidth: 1000,
          fontSize: 28,
          lineHeight: 1.55,
          color: 'var(--color-ink-muted)',
          opacity: p,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

export default defineScene({ id: 'cover', params, Component: Cover });
