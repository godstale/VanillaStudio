/* eslint-disable react-refresh/only-export-components -- a scene module exports its scene definition */
// Scrolling statement for the Kinetic Type Web template.
// Masked line reveals + a seamless marquee, all functions of t.
import { clamp01, defineScene, ease, param, token, useParams, useTime } from '@vanilla/runtime';

const params = {
  lines: param.text('Read the room.\nMove the words.\nKeep the calm.', { label: 'Statement lines (one per line)' }),
  marquee: param.text('KINETIC TYPE — GROVE FRESH — ', { label: 'Marquee text' }),
  bgColor: param.color(token('canvas'), { label: 'Background' }),
  bandColor: param.color(token('ink'), { label: 'Marquee band' }),
  bandInk: param.color(token('canvas'), { label: 'Marquee text' }),
  speed: param.number(1, { min: 0.2, max: 2, step: 0.1, label: 'Motion rate' }),
};

function Manifesto() {
  const t = useTime();
  const { lines, marquee, bgColor, bandColor, bandInk, speed } = useParams<typeof params>();
  const items = lines.split('\n').filter((l) => l.trim() !== '');
  // Seamless loop: identical halves, 0 → -50% over the period.
  const period = 12 / speed;
  const shift = -50 * ((t % period) / period);
  return (
    <section style={{ background: bgColor, color: 'var(--color-ink)', padding: 'clamp(24px, 6vw, 96px) 0' }}>
      <div style={{ padding: '0 clamp(24px, 6vw, 96px)', marginBottom: 64 }}>
        {items.map((line, i) => {
          const p = ease.expoOut(clamp01((t * speed - i * 0.12) / 0.7));
          return (
            <div key={i} style={{ overflow: 'hidden' }}>
              <p
                style={{
                  margin: '0 0 8px',
                  fontWeight: 800,
                  fontSize: 'clamp(36px, 6vw, 88px)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                  transform: `translateY(${(1 - p) * 110}%)`,
                  opacity: p,
                }}
              >
                {line}
              </p>
            </div>
          );
        })}
      </div>
      <div style={{ overflow: 'hidden', background: bandColor, color: bandInk }}>
        <div
          style={{
            display: 'flex',
            width: 'max-content',
            transform: `translateX(${shift}%)`,
            padding: '16px 0',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ paddingRight: 32 }}>{marquee}</span>
          <span aria-hidden style={{ paddingRight: 32 }}>
            {marquee}
          </span>
        </div>
      </div>
    </section>
  );
}

export default defineScene({ id: 'manifesto', params, Component: Manifesto });
