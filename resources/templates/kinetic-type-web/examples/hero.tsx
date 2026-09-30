/* eslint-disable react-refresh/only-export-components -- a scene module exports its scene definition */
// Staggered hero for the Kinetic Type Web template.
// Free-mode scene; motion stays a function of t so captures match live.
import { clamp01, defineScene, ease, param, token, useParams, useTime } from '@vanilla/runtime';

const params = {
  headline: param.text('Type that moves people', { label: 'Headline' }),
  accentWord: param.text('moves', { label: 'Emphasised word' }),
  standfirst: param.text('A single-page site where the words do the walking.', { label: 'Standfirst' }),
  bgColor: param.color(token('canvas'), { label: 'Background' }),
  inkColor: param.color(token('ink'), { label: 'Headline' }),
  accentColor: param.color(token('accent'), { label: 'Emphasis' }),
  speed: param.number(1, { min: 0.2, max: 2, step: 0.1, label: 'Stagger speed' }),
  align: param.select(['left', 'center'] as const, 'left', { label: 'Alignment' }),
};

function Hero() {
  const t = useTime();
  const { headline, accentWord, standfirst, bgColor, inkColor, accentColor, speed, align } = useParams<typeof params>();
  const words = headline.split(/\s+/).filter(Boolean);
  const stand = ease.expoOut(clamp01((t * speed - 0.5) / 0.8));
  return (
    <section
      style={{
        boxSizing: 'border-box',
        minHeight: '100vh',
        padding: 'clamp(24px, 6vw, 96px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align === 'center' ? 'center' : 'left',
        background: bgColor,
        color: inkColor,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontWeight: 800,
          fontSize: 'clamp(48px, 10vw, 160px)',
          lineHeight: 0.98,
          letterSpacing: '-0.03em',
        }}
      >
        {words.map((w, i) => {
          const p = ease.expoOut(clamp01((t * speed - i * 0.09) / 0.6));
          const hot = w === accentWord;
          return (
            <span
              key={`${w}-${i}`}
              style={{
                display: 'inline-block',
                marginRight: '0.24em',
                color: hot ? accentColor : undefined,
                opacity: p,
                transform: `translateY(${(1 - p) * 0.6}em) rotate(${(1 - p) * 2}deg)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </h1>
      <p
        style={{
          margin: '32px 0 0',
          maxWidth: 720,
          fontSize: 24,
          lineHeight: 1.6,
          color: 'var(--color-ink-muted)',
          opacity: stand,
          transform: `translateY(${(1 - stand) * 16}px)`,
        }}
      >
        {standfirst}
      </p>
    </section>
  );
}

export default defineScene({ id: 'hero', params, Component: Hero });
