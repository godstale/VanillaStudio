// One renderer per `layout` in content.json. `shown` = items revealed so far (Infinity when not building).
import type { ReactNode } from 'react';
import { Bullets, Figure, Note, Reveal, Rich } from './atoms';
import { Diagram } from './diagrams';
import { buildCount, deckInfo, figuresAt, imageUrl, type DeckScene, type Item, type Screen, type Side } from './content';

export interface LayoutProps {
  scene: DeckScene;
  screen: Screen;
  shown: number;
  chapterNo: string;
}

/** The note is the punchline: on a building screen it waits for the last item. */
const noteShown = (screen: Screen, shown: number) => !screen.build || shown >= buildCount(screen);

function Visual({ screen, shown }: { screen: Screen; shown: number }) {
  if (screen.diagram) {
    return (
      <div className="visual visual--diagram">
        <Diagram name={screen.diagram} screen={screen} shown={shown} />
      </div>
    );
  }
  if (screen.figures?.length) {
    return (
      <div className="visual visual--stack">
        {screen.figures.map((f) => (
          <Figure key={f.src} figure={f} />
        ))}
      </div>
    );
  }
  if (screen.figure) {
    return (
      <div className="visual">
        <Figure figure={screen.figure} />
      </div>
    );
  }
  return null;
}

function Cover({ screen }: LayoutProps) {
  return (
    <div className="cover">
      <span className="cover-kicker">
        <Rich text={screen.kicker} />
      </span>
      <Rich as="h1" className="cover-title" text={screen.heading} />
      <Rich as="p" className="cover-text" text={screen.text} />
      <p className="cover-course">{deckInfo.course}</p>
    </div>
  );
}

function Divider({ screen, chapterNo }: LayoutProps) {
  return (
    <div className="divider">
      <span className="divider-kicker">
        <Rich text={screen.kicker} />
      </span>
      <span className="divider-no">{chapterNo}</span>
      <Rich as="h1" className="divider-title" text={screen.heading} />
    </div>
  );
}

function Statement({ screen }: LayoutProps) {
  return (
    <div className="statement">
      {screen.figure && <Figure figure={screen.figure} className="statement-fig" />}
      <Rich as="p" className="statement-kicker" text={screen.kicker} />
      {screen.classic && <Rich as="p" className="statement-classic" text={screen.classic} />}
      <Rich as="h1" className="statement-heading" text={screen.heading} />
      <Rich as="p" className="statement-text" text={screen.text} />
      <Bullets items={screen.bullets} className="bullets--center" />
    </div>
  );
}

function StackItems({ items, shown, flow }: { items?: Item[]; shown: number; flow?: boolean }) {
  if (!items?.length) return null;
  return (
    <div className="stack">
      {items.map((it, i) => (
        <Reveal key={i} className="stack-item" shown={i < shown}>
          {flow && i > 0 && <span className="stack-arrow">↓</span>}
          <div className="card stack-card">
            <Rich as="strong" text={it.title} />
            <Rich as="span" text={it.text} />
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function Split({ screen, shown }: LayoutProps) {
  const visual = Visual({ screen, shown });
  // Diagram rows own the build; the text column is always complete.
  const itemsShown = screen.diagram ? Infinity : shown;
  return (
    <div className={`split ${visual ? '' : 'split--solo'}`}>
      {visual}
      <div className="split-text">
        {screen.value && <p className="t-number">{screen.value}</p>}
        <Rich as="h3" className="t-heading" text={screen.heading} />
        <Rich as="p" className="t-meta" text={screen.text} />
        <Rich as="p" className="t-lead" text={screen.lead} />
        <Bullets items={screen.bullets} />
        {!screen.diagram && <StackItems items={screen.items} shown={itemsShown} flow={screen.flow} />}
      </div>
    </div>
  );
}

function Cards({ screen, shown }: LayoutProps) {
  const items = screen.items ?? [];
  const cols = typeof screen.cols === 'number' ? screen.cols : 3;
  const grid = (
    <div className={`cards ${screen.flow ? 'cards--flow' : ''}`} style={{ gridTemplateColumns: screen.flow ? undefined : `repeat(${screen.figure ? 1 : cols}, 1fr)` }}>
      {items.map((it, i) => (
        <Reveal key={i} className="cards-cell" shown={i < shown}>
          {screen.flow && i > 0 && <span className="cards-arrow">→</span>}
          <div className="card">
            {screen.numbered && <span className="card-no">{String(i + 1).padStart(2, '0')}</span>}
            <Rich as="h4" className="card-title" text={it.title} />
            <Rich as="p" className="card-text" text={it.text} />
          </div>
        </Reveal>
      ))}
    </div>
  );
  if (!screen.figure) return grid;
  return (
    <div className="split">
      <div className="visual">
        <Figure figure={screen.figure} />
      </div>
      {grid}
    </div>
  );
}

function SideCard({ side }: { side: Side }) {
  return (
    <div className="card side" data-tone={side.tone ?? 'primary'}>
      {side.logo && (
        <div className={`side-logo ${side.logoPaper ? 'side-logo--paper' : ''}`}>
          <img src={imageUrl(side.logo)} alt="" draggable={false} />
        </div>
      )}
      {side.tag && <span className="side-tag">{side.tag}</span>}
      <h3 className="side-title">{side.title}</h3>
      {side.diagram && <div className="side-diagram">{<SideDiagram name={side.diagram} />}</div>}
      {side.figure && <Figure figure={side.figure} className="side-figure" />}
      <Bullets items={side.bullets} />
    </div>
  );
}

const EMPTY: Screen = { id: '', layout: 'split' };
const SideDiagram = ({ name }: { name: string }) => <Diagram name={name} screen={EMPTY} shown={Infinity} />;

function Compare({ screen }: LayoutProps) {
  if (!screen.left || !screen.right) throw new Error(`${screen.id}: compare needs left and right`);
  return (
    <div className={`compare ${screen.left.figure || screen.right.figure ? 'compare--boards' : ''}`}>
      <SideCard side={screen.left} />
      <div className="compare-link">
        <span className="compare-dots" />
        {screen.link && <span className="compare-label">{screen.link}</span>}
        <span className="compare-dots" />
      </div>
      <SideCard side={screen.right} />
    </div>
  );
}

function Timeline({ screen, shown }: LayoutProps) {
  const items = screen.items ?? [];
  const figures = figuresAt(screen, shown);
  const twoCols = !figures.length && items.length > 5;
  const half = Math.ceil(items.length / 2);
  const columns = twoCols ? [items.slice(0, half), items.slice(half)] : [items];
  return (
    <div className={`split ${figures.length ? 'split--timeline' : 'split--solo'}`}>
      <div className={`tl ${twoCols ? 'tl--two' : ''}`}>
        {columns.map((col, c) => (
          <ol key={c} className="tl-col">
            {col.map((it, i) => {
              const idx = c * half + i;
              return (
                <Reveal key={idx} as="li" className="tl-row" shown={idx < shown}>
                  <span className="tl-date">{it.date}</span>
                  <span className="tl-dot" />
                  <span className="tl-body">
                    <Rich as="strong" text={it.title} />
                    <Rich as="span" text={it.text} />
                  </span>
                </Reveal>
              );
            })}
          </ol>
        ))}
      </div>
      {figures.length > 0 && (
        <div className={`visual ${figures.length > 1 ? 'visual--stack' : ''}`}>
          {figures.map((f) => (
            <Figure key={f.src} figure={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stats({ screen }: LayoutProps) {
  const items = screen.items ?? [];
  const stack = Boolean(screen.figure);
  return (
    <div className={stack ? 'split split--stats' : 'stats-wrap'}>
      <div className={`stats ${stack ? 'stats--stack' : ''}`}>
        {items.map((it, i) => (
          <div key={i} className="stat">
            <span className="stat-value">
              {it.value}
              {it.unit && <small>{it.unit}</small>}
            </span>
            <Rich as="span" className="stat-label" text={it.label} />
          </div>
        ))}
      </div>
      {screen.figure && (
        <div className="visual">
          <Figure figure={screen.figure} />
        </div>
      )}
      {screen.foot && <p className="foot">{screen.foot}</p>}
    </div>
  );
}

function Bars({ screen }: LayoutProps) {
  const items = screen.items ?? [];
  const log = screen.scale === 'log';
  const values = items.map((it) => Number(it.value));
  const max = screen.max ?? Math.max(...values);
  const min = log ? Math.min(...values) / 10 : 0;
  const pct = (v: number) => (log ? ((Math.log10(v) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * 100 : (v / max) * 100);
  const bars = (
    <div className="bars-col">
      <Rich as="p" className="t-lead" text={screen.lead} />
      <div className="bars">
        {items.map((it, i) => (
          <div key={i} className="bar" data-tone={it.tone ?? 'muted'}>
            <span className="bar-label">{it.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${Math.max(pct(values[i]), 2) * 0.82}%` }} />
              <span className="bar-value">
                {it.display}
                {screen.badge && it.tone === 'primary' && <span className="bar-badge">{screen.badge}</span>}
              </span>
            </span>
          </div>
        ))}
      </div>
      <Bullets items={screen.bullets} />
    </div>
  );
  if (!screen.figure) return bars;
  return (
    <div className="split split--bars">
      {bars}
      <div className="visual">
        <Figure figure={screen.figure} />
      </div>
    </div>
  );
}

function FigureLayout({ screen }: LayoutProps) {
  if (!screen.figure) throw new Error(`${screen.id}: figure layout needs a figure`);
  return (
    <div className="figure-full">
      <Figure figure={screen.figure} />
    </div>
  );
}

function Quote({ screen }: LayoutProps) {
  return (
    <div className="split split--quote">
      <div className="quote">
        <span className="quote-mark">“</span>
        <p className="quote-text">{screen.quote}</p>
        {screen.source && <p className="quote-source">— {screen.source}</p>}
        <Rich as="p" className="quote-extra" text={screen.text} />
      </div>
      {screen.figure && (
        <div className="visual">
          <Figure figure={screen.figure} />
        </div>
      )}
    </div>
  );
}

function Hero({ screen }: LayoutProps) {
  return (
    <div className="hero">
      {screen.figure && <img className="hero-bg" src={imageUrl(screen.figure.src)} alt="" draggable={false} />}
      <span className="hero-kicker">
        <Rich text={screen.kicker} />
      </span>
      <Rich as="h1" className="hero-title" text={screen.heading} />
    </div>
  );
}

function Photo({ screen }: LayoutProps) {
  return (
    <div className="photo">
      {screen.figure && <img className="photo-bg" src={imageUrl(screen.figure.src)} alt="" draggable={false} />}
      <div className="photo-shade" />
      <div className="photo-text">
        <span className="photo-kicker">
          <Rich text={screen.kicker} />
        </span>
        {screen.lines?.map((l, i) => <Rich key={i} as="p" className={i === (screen.lines?.length ?? 0) - 1 ? 'photo-line photo-line--last' : 'photo-line'} text={l} />)}
      </div>
    </div>
  );
}

function Table({ screen }: LayoutProps) {
  const cols = Array.isArray(screen.cols) ? screen.cols : [];
  return (
    <div className="table-wrap">
      <table className="dtable">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {screen.rows?.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>
                  <Rich text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {screen.foot && <p className="foot">{screen.foot}</p>}
    </div>
  );
}

const LAYOUTS: Record<Screen['layout'], (p: LayoutProps) => ReactNode> = {
  cover: Cover,
  divider: Divider,
  statement: Statement,
  split: Split,
  cards: Cards,
  compare: Compare,
  timeline: Timeline,
  stats: Stats,
  bars: Bars,
  figure: FigureLayout,
  quote: Quote,
  hero: Hero,
  photo: Photo,
  table: Table,
};

/** Layouts that own the whole stage (no header, no body box). */
export const FULL_BLEED = new Set<Screen['layout']>(['cover', 'divider', 'hero', 'photo']);

export function ScreenView(props: LayoutProps) {
  const L = LAYOUTS[props.screen.layout];
  return (
    <>
      <div className="body-main">
        <L {...props} />
      </div>
      <Note text={props.screen.note} shown={noteShown(props.screen, props.shown)} />
    </>
  );
}
