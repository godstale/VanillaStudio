// Hand-drawn diagrams referenced by name from content.json (`diagram`). Data and labels come from
// content.json / items.json; colors only from DESIGN.md tokens (classes in deck.css).
import type { ReactNode } from 'react';
import { Reveal, Rich } from './atoms';
import { deckItem, type DeckItem, type Screen } from './content';

interface DiagramProps {
  screen: Screen;
  shown: number;
}

// Deterministic PRNG so the noise strip draws the same every time.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Board = DeckItem & {
  size: number;
  highlight: { move: number; line: number; side: 'right' | 'left'; row: number };
  labels: { fifth: string };
  stones: string[];
};

function GoBoard() {
  const board = deckItem<Board>('board.move37');
  const S = 640;
  const pad = 36;
  const gap = (S - pad * 2) / (board.size - 1);
  const at = (i: number) => pad + i * gap;
  const col = board.highlight.side === 'right' ? board.size - board.highlight.line : board.highlight.line - 1;
  const stone = { x: at(col), y: at(board.highlight.row - 1) };
  const stars = [3, 9, 15];
  return (
    <svg className="dg dg-board" viewBox={`0 0 ${S} ${S}`} aria-hidden>
      <rect x={0} y={0} width={S} height={S} rx={22} className="dg-paper" />
      {Array.from({ length: board.size }, (_, i) => (
        <g key={i} className="dg-grid">
          <line x1={at(0)} y1={at(i)} x2={at(board.size - 1)} y2={at(i)} />
          <line x1={at(i)} y1={at(0)} x2={at(i)} y2={at(board.size - 1)} />
        </g>
      ))}
      {stars.flatMap((r) => stars.map((c) => <circle key={`${r}-${c}`} cx={at(c)} cy={at(r)} r={4} className="dg-star" />))}
      <line x1={at(col)} y1={at(0)} x2={at(col)} y2={at(board.size - 1)} className="dg-fifth" />
      <text x={at(col)} y={pad - 12} className="dg-fifth-label">
        {board.labels.fifth}
      </text>
      <circle cx={stone.x} cy={stone.y} r={gap * 2.2} className="dg-halo dg-halo--outer" />
      <circle cx={stone.x} cy={stone.y} r={gap * 1.3} className="dg-halo" />
      {board.stones.flatMap((line, r) =>
        [...line].map((cell, c) =>
          (cell === 'X' || cell === 'O') && !(r === board.highlight.row - 1 && c === col) ? (
            <circle key={`s${r}-${c}`} cx={at(c)} cy={at(r)} r={gap * 0.46} className={cell === 'X' ? 'dg-pstone dg-pstone--black' : 'dg-pstone dg-pstone--white'} />
          ) : null,
        ),
      )}
      <circle cx={stone.x} cy={stone.y} r={gap * 0.48} className="dg-stone" />
      <text x={stone.x} y={stone.y} className="dg-move">
        {board.highlight.move}
      </text>
    </svg>
  );
}

type Strip = DeckItem & { frames: number; grid: number; seed: number; labels: { forward: string; reverse: string } };

function Diffusion() {
  const strip = deckItem<Strip>('diffusion.strip');
  const n = strip.grid;
  const cell = 14;
  const size = n * cell;
  const gapX = 44;
  const W = strip.frames * size + (strip.frames - 1) * gapX;
  const rand = mulberry32(strip.seed);
  const noise = Array.from({ length: n * n }, () => rand());
  // A clean "picture": a sun over a horizon, as cell intensities 0..1.
  const clean = Array.from({ length: n * n }, (_, i) => {
    const x = i % n;
    const y = Math.floor(i / n);
    const sun = Math.hypot(x - n * 0.62, y - n * 0.34) < n * 0.2 ? 1 : 0;
    const ground = y >= n * 0.7 ? 0.55 : 0;
    return Math.max(sun, ground);
  });
  return (
    <svg className="dg" viewBox={`0 -70 ${W} ${size + 150}`} aria-hidden>
      {Array.from({ length: strip.frames }, (_, f) => {
        const t = f / (strip.frames - 1);
        const ox = f * (size + gapX);
        return (
          <g key={f} transform={`translate(${ox} 0)`}>
            <rect x={-4} y={-4} width={size + 8} height={size + 8} rx={10} className="dg-cardbg" />
            {clean.map((c, i) => (
              <rect key={i} x={(i % n) * cell} y={Math.floor(i / n) * cell} width={cell} height={cell} className="dg-pixel" style={{ opacity: 0.08 + 0.92 * (c * (1 - t) + noise[i] * t) }} />
            ))}
          </g>
        );
      })}
      <g className="dg-arrow dg-arrow--muted">
        <line x1={0} y1={-34} x2={W - 12} y2={-34} />
        <path d={`M ${W - 16} -42 L ${W} -34 L ${W - 16} -26 Z`} />
        <text x={0} y={-50} className="dg-label dg-label--start">
          {strip.labels.forward}
        </text>
      </g>
      <g className="dg-arrow">
        <line x1={12} y1={size + 40} x2={W} y2={size + 40} />
        <path d={`M 16 ${size + 32} L 0 ${size + 40} L 16 ${size + 48} Z`} />
        <text x={W} y={size + 78} className="dg-label dg-label--end">
          {strip.labels.reverse}
        </text>
      </g>
    </svg>
  );
}

function Chain() {
  const k = 5;
  return (
    <svg className="dg dg-mini" viewBox="0 0 520 120" aria-hidden>
      {Array.from({ length: k }, (_, i) => (
        <g key={i} transform={`translate(${i * 106 + 10} 30)`}>
          <rect width={64} height={64} rx={12} className="dg-node dg-node--muted" />
          <text x={32} y={34} className="dg-node-text">
            {i + 1}
          </text>
          {i < k - 1 && <path d="M 70 32 L 98 32" className="dg-link" markerEnd="url(#dg-head)" />}
        </g>
      ))}
      <defs>
        <marker id="dg-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 Z" className="dg-head" />
        </marker>
      </defs>
    </svg>
  );
}

function Matrix() {
  const k = 5;
  const c = 34;
  return (
    <svg className="dg dg-mini" viewBox="0 0 520 220" aria-hidden>
      <g transform="translate(170 18)">
        {Array.from({ length: k * k }, (_, i) => {
          const r = Math.floor(i / k);
          const q = i % k;
          const w = r === q ? 1 : 0.18 + 0.7 * Math.abs(Math.sin((r + 1) * (q + 2) * 1.7));
          return <rect key={i} x={q * (c + 4)} y={r * (c + 4)} width={c} height={c} rx={6} className="dg-cell" style={{ opacity: w }} />;
        })}
      </g>
    </svg>
  );
}

function PageOne() {
  return (
    <svg className="dg dg-mini" viewBox="0 0 520 160" aria-hidden>
      <rect x={200} y={10} width={120} height={140} rx={10} className="dg-page dg-page--muted" />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={216} y1={40 + i * 26} x2={304 - (i % 2) * 22} y2={34 + i * 26 + (i % 2) * 10} className="dg-scribble" style={{ opacity: 0.35 + i * 0.2 }} />
      ))}
    </svg>
  );
}

function PageMany() {
  const marks = ['×', '+', '↗'];
  return (
    <svg className="dg dg-mini" viewBox="0 0 520 160" aria-hidden>
      {marks.map((m, i) => (
        <g key={m} transform={`translate(${120 + i * 104} 10)`}>
          <rect width={92} height={140} rx={10} className="dg-page" />
          {[0, 1, 2].map((j) => (
            <line key={j} x1={14} y1={30 + j * 22} x2={78 - j * 12} y2={30 + j * 22} className="dg-scribble" />
          ))}
          <circle cx={46} cy={112} r={16} className="dg-gate" />
          <text x={46} y={113} className="dg-gate-text">
            {m}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Twenty-questions rows: diverging bars from 0, revealed one per click. */
function Vector({ screen, shown }: DiagramProps) {
  const rows = screen.items ?? [];
  const done = shown >= rows.length;
  return (
    <div className="vec">
      {rows.map((r, i) => {
        const v = Number(r.value);
        return (
          <Reveal key={i} className="vec-row" shown={i < shown}>
            <span className="vec-q">{r.title}</span>
            <span className="vec-track">
              <span className="vec-zero" />
              <span className={`vec-fill ${v < 0 ? 'vec-fill--neg' : ''}`} style={v < 0 ? { right: '50%', width: `${-v * 50}%` } : { left: '50%', width: `${v * 50}%` }} />
            </span>
            <span className="vec-v">{v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)}</span>
          </Reveal>
        );
      })}
      {screen.answer && (
        <Reveal className="vec-answer" shown={done}>
          → <em>{screen.answer}</em>
        </Reveal>
      )}
    </div>
  );
}

/** Same dimensions for several words; each click adds a word column. */
function VectorCompare({ screen, shown }: DiagramProps) {
  const dims = screen.dims ?? [];
  const words = screen.items ?? [];
  return (
    <div className="vcmp" style={{ gridTemplateColumns: `260px repeat(${words.length}, 1fr)` }}>
      <span />
      {words.map((w, i) => (
        <Reveal key={i} className="vcmp-word" shown={i < shown}>
          <span data-latest={i === shown - 1}>{w.title}</span>
        </Reveal>
      ))}
      {dims.map((d, di) => (
        <Row key={d} label={d}>
          {words.map((w, wi) => {
            const v = w.values?.[di] ?? 0;
            const changed = wi > 0 && v !== words[0].values?.[di];
            return (
              <Reveal key={wi} className="vcmp-cell" shown={wi < shown}>
                <span className="vec-track">
                  <span className="vec-zero" />
                  <span className={`vec-fill ${v < 0 ? 'vec-fill--neg' : ''} ${changed ? 'vec-fill--changed' : ''}`} style={v < 0 ? { right: '50%', width: `${-v * 50}%` } : { left: '50%', width: `${v * 50}%` }} />
                </span>
                <span className={`vec-v ${changed ? 'vec-v--changed' : ''}`}>{v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)}</span>
              </Reveal>
            );
          })}
        </Row>
      ))}
    </div>
  );
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <span className="vcmp-dim">{label}</span>
    {children}
  </>
);

/** Attention heads: how strongly the first word attends to each word, per perspective. */
function MultiHead({ screen }: DiagramProps) {
  const tokens = screen.tokens ?? [];
  const heads = screen.heads ?? [];
  return (
    <div className="mh" style={{ gridTemplateColumns: `110px repeat(${tokens.length}, 1fr)` }}>
      <span />
      {tokens.map((t, i) => (
        <span key={t} className="mh-token" data-query={i === 0}>
          {t}
        </span>
      ))}
      {heads.map((h) => (
        <Row key={h.label} label={h.label}>
          {h.weights.map((w, i) => (
            <span key={i} className="mh-cell" data-query={i === 0} style={{ opacity: 0.12 + 0.88 * w }} />
          ))}
        </Row>
      ))}
    </div>
  );
}

type Prefill = DeckItem & { prompt: string[]; labels: { block: string; kv: string; parallel: string } };

function PrefillDiagram() {
  const d = deckItem<Prefill>('tokens.prefill');
  return (
    <div className="flowdg">
      <div className="tok-row">
        {d.prompt.map((t, i) => (
          <span key={i} className="tok">
            {t}
          </span>
        ))}
      </div>
      <div className="flowdg-arrows" style={{ gridTemplateColumns: `repeat(${d.prompt.length}, 1fr)` }}>
        {d.prompt.map((_, i) => (
          <span key={i} className="flowdg-down" />
        ))}
      </div>
      <div className="flowdg-caption">
        <Rich text={d.labels.parallel} />
      </div>
      <div className="flowdg-block">{d.labels.block}</div>
      <div className="tok-row">
        {d.prompt.map((_, i) => (
          <span key={i} className="kv">
            <i />
            <i />
          </span>
        ))}
      </div>
      <div className="flowdg-caption flowdg-caption--accent">{d.labels.kv}</div>
    </div>
  );
}

type Decode = DeckItem & { context: string[]; answer: string[]; candidates: { word: string; p: number }[]; labels: { hidden: string; probs: string; loop: string } };

function DecodeDiagram() {
  const d = deckItem<Decode>('tokens.decode');
  return (
    <div className="flowdg">
      <div className="tok-row tok-row--left">
        {d.context.map((t, i) => (
          <span key={`c${i}`} className="tok tok--dim">
            {t}
          </span>
        ))}
        {d.answer.map((t, i) => (
          <span key={`a${i}`} className="tok tok--gen" data-last={i === d.answer.length - 1}>
            {t}
          </span>
        ))}
        <span className="tok tok--next">?</span>
      </div>
      <div className="dec-loop">
        <div className="dec-box">
          <span className="dec-label">{d.labels.hidden}</span>
          <span className="dec-vec">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ opacity: 0.25 + 0.75 * Math.abs(Math.sin(i * 1.9)) }} />
            ))}
          </span>
        </div>
        <span className="dec-arrow">→</span>
        <div className="dec-box dec-box--wide">
          <span className="dec-label">{d.labels.probs}</span>
          {d.candidates.map((c, i) => (
            <span key={c.word} className="dec-cand" data-top={i === 0}>
              <span className="dec-word">{c.word}</span>
              <span className="dec-bar">
                <span style={{ width: `${c.p * 100}%` }} />
              </span>
              <span className="dec-p">{Math.round(c.p * 100)}%</span>
            </span>
          ))}
        </div>
      </div>
      <div className="dec-back">↺ {d.labels.loop}</div>
    </div>
  );
}

const DIAGRAMS: Record<string, (p: DiagramProps) => ReactNode> = {
  'go-board': GoBoard,
  diffusion: Diffusion,
  chain: Chain,
  matrix: Matrix,
  'page-one': PageOne,
  'page-many': PageMany,
  vector: Vector,
  'vector-compare': VectorCompare,
  multihead: MultiHead,
  prefill: PrefillDiagram,
  decode: DecodeDiagram,
};

export function Diagram({ name, screen, shown }: { name: string; screen: Screen; shown: number }) {
  const D = DIAGRAMS[name];
  if (!D) throw new Error(`Unknown diagram ${name}`);
  return <D screen={screen} shown={shown} />;
}
