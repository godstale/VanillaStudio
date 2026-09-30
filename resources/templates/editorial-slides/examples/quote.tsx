/* eslint-disable react-refresh/only-export-components -- a scene module exports its scene definition */
// Quote scene for the Minimal Editorial Slides template.
// One serif statement, one attribution, nothing else.
import { clamp01, defineScene, ease, param, token, useParams, useTime } from '@vanilla/runtime';

const params = {
  quote: param.text('Simplicity is the shortest path to being understood.', { label: 'Quote' }),
  author: param.text('Studio notes, 2026', { label: 'Attribution' }),
  bgColor: param.color(token('canvas'), { label: 'Background' }),
  ruleColor: param.color(token('primary'), { label: 'Rule color' }),
  speed: param.number(1, { min: 0.2, max: 2, step: 0.1, label: 'Entrance speed' }),
};

function Quote() {
  const t = useTime();
  const { quote, author, bgColor, ruleColor, speed } = useParams<typeof params>();
  const p = ease.expoOut(clamp01((t * speed) / 1));
  const rise = (1 - p) * 24;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: 120,
        paddingLeft: 240,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: bgColor,
        color: 'var(--color-ink)',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 96,
          height: 6,
          margin: '0 0 40px',
          background: ruleColor,
          borderRadius: 'var(--rounded-md, 4px)',
          opacity: p,
        }}
      />
      <blockquote
        style={{
          margin: 0,
          maxWidth: 1300,
          fontFamily: 'var(--font-display, Georgia, serif)',
          fontWeight: 400,
          fontSize: 72,
          lineHeight: 1.15,
          opacity: p,
          transform: `translateY(${rise}px)`,
        }}
      >
        &ldquo;{quote}&rdquo;
      </blockquote>
      <p
        style={{
          margin: '40px 0 0',
          fontSize: 28,
          color: 'var(--color-ink-muted)',
          opacity: p,
        }}
      >
        {author}
      </p>
    </div>
  );
}

export default defineScene({ id: 'quote', params, Component: Quote });
