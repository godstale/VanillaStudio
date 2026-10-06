import { defineScene } from '@vanilla/runtime';

// 정적 페이지(scroll): 시간이 아니라 스크롤과 입력으로 읽는 페이지다. 색은 DESIGN.md 토큰(CSS 변수)만 쓴다.
const BEANS = [
  { name: 'Sunrise', note: 'Light roast, citrus and honey' },
  { name: 'Hearth', note: 'Medium roast, cocoa and toasted almond' },
  { name: 'Midnight', note: 'Dark roast, molasses and spice' },
];
const STEPS = ['Pick your beans', 'Choose how often', 'We roast and ship'];

function Landing() {
  return (
    <main data-testid="landing" style={{ minHeight: '100%', background: 'var(--color-canvas)', color: 'var(--color-ink)', fontFamily: 'sans-serif' }}>
      <section style={{ padding: '96px 12%', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h1 id="headline" style={{ margin: 0, fontSize: 64 }}>Fresh-roasted beans, every week</h1>
        <p style={{ margin: 0, fontSize: 24, color: 'var(--color-ink-muted)' }}>Morning Grain delivers small-batch coffee to your door.</p>
        <a href="#plans" style={{ alignSelf: 'flex-start', padding: '14px 28px', background: 'var(--color-primary)', color: 'var(--color-on-primary)', textDecoration: 'none', borderRadius: 8 }}>
          Start a subscription
        </a>
      </section>
      <section id="steps" style={{ padding: '48px 12%', background: 'var(--color-surface)' }}>
        <h2 style={{ marginTop: 0 }}>How it works</h2>
        <ol>
          {STEPS.map((s) => (
            <li key={s} style={{ fontSize: 22, margin: '8px 0' }}>
              {s}
            </li>
          ))}
        </ol>
      </section>
      <section id="plans" style={{ padding: '48px 12% 96px' }}>
        <h2 style={{ marginTop: 0 }}>Our beans</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {BEANS.map((b) => (
            <article key={b.name} data-testid="bean" style={{ padding: 24, border: '1px solid var(--color-line)', borderRadius: 12 }}>
              <h3 style={{ marginTop: 0 }}>{b.name}</h3>
              <p style={{ margin: 0 }}>{b.note}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default defineScene({ id: 'landing', Component: Landing });
