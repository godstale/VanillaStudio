// Hand-drawn diagrams referenced by name from content.json (`diagram`). Data and labels come from
// content.json / items.json; colors only from DESIGN.md tokens (classes in deck.css).
import type { ReactNode } from 'react';
import { Reveal, Rich } from './atoms';
import { deckItem, type DeckItem, type Screen } from './content';

interface DiagramProps {
  screen: Screen;
  shown: number;
}

type TabCode = DeckItem & { file: string; comment: string; ghost: string[]; labels: { ghost: string; accept: string } };

/** Copilot tab coding in three clicks: the comment types in, gray ghost text appears, Tab accepts it. */
function TabCoding({ screen, shown }: DiagramProps) {
  const code = deckItem<TabCode>('code.tab');
  const steps = screen.items ?? [];
  const ghost = shown >= 2;
  const accepted = shown >= 3;
  return (
    <div className="tc">
      <div className="tc-window">
        <div className="tc-bar">
          <i />
          <i />
          <i />
          <span>{code.file}</span>
        </div>
        <div className="tc-code">
          <div className="tc-line">
            <span className="tc-no">1</span>
            <span className="tc-comment tc-type">{code.comment}</span>
          </div>
          {code.ghost.map((line, i) => (
            <Reveal key={i} className="tc-line" shown={ghost}>
              <span className="tc-no">{i + 2}</span>
              <span className={accepted ? 'tc-text' : 'tc-ghost'}>{line}</span>
            </Reveal>
          ))}
        </div>
        <Reveal className="tc-hint" shown={ghost && !accepted}>
          <span className="tc-hint-label">{code.labels.ghost}</span>
          <kbd className="tc-key">{code.labels.accept}</kbd>
        </Reveal>
      </div>
      <ol className="tc-steps">
        {steps.map((s, i) => (
          <li key={i} data-on={i < shown} data-now={i === shown - 1}>
            <span className="tc-step-no">{i + 1}</span>
            <Rich text={s.title} />
          </li>
        ))}
      </ol>
    </div>
  );
}

type ContextStack = DeckItem & { blocks: { label: string; tone?: 'accent' | 'primary' }[]; labels: { send: string; fade: string } };

/** Every turn resends the whole conversation; older turns fade toward the top. */
function ContextStackDiagram() {
  const d = deckItem<ContextStack>('context.stack');
  const n = d.blocks.length;
  return (
    <div className="ctx">
      <div className="ctx-stack">
        <span className="ctx-fade">↑ {d.labels.fade}</span>
        {d.blocks.map((b, i) => (
          <span key={i} className="ctx-block" data-tone={b.tone} style={{ opacity: b.tone ? 1 : 0.3 + (0.6 * i) / (n - 1) }}>
            {b.label}
          </span>
        ))}
      </div>
      <div className="ctx-send">
        <span className="ctx-send-label">{d.labels.send}</span>
        <span className="ctx-arrow">→</span>
      </div>
      <div className="ctx-llm">LLM</div>
    </div>
  );
}

type Equation = DeckItem & { parts: string[]; subs: string[] };

function EquationDiagram() {
  const d = deckItem<Equation>('agent.equation');
  return (
    <div className="eq">
      {d.parts.map((p, i) => (
        <div key={p} className="eq-cell">
          {i > 0 && <span className="eq-op">{i === d.parts.length - 1 ? '=' : '+'}</span>}
          <div className="eq-box" data-last={i === d.parts.length - 1}>
            <strong>{p}</strong>
            <span>{d.subs[i]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

type Effort = DeckItem & { levels: { label: string; hypotheses: number; cost: number }[]; labels: { hypotheses: string; cost: string } };

/** Conceptual only: more effort weighs more hypotheses and spends more time and tokens. */
function EffortDiagram() {
  const d = deckItem<Effort>('effort.levels');
  const most = Math.max(...d.levels.map((l) => l.hypotheses));
  return (
    <div className="eff">
      <span />
      <span className="eff-head">{d.labels.hypotheses}</span>
      <span className="eff-head">{d.labels.cost}</span>
      {d.levels.map((l, i) => (
        <Row key={l.label} label={l.label}>
          <span className="eff-dots">
            {Array.from({ length: most }, (_, k) => (
              <i key={k} data-on={k < l.hypotheses} />
            ))}
          </span>
          <span className="eff-track">
            <span className="eff-fill" data-top={i === d.levels.length - 1} style={{ width: `${l.cost * 100}%` }} />
          </span>
        </Row>
      ))}
    </div>
  );
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <span className="eff-label">{label}</span>
    {children}
  </>
);

type Loop = DeckItem & { steps: string[]; center: string; labels: { fresh: string; files: string } };

/** Ralph loop: four stations on a circle, arrows clockwise, the exit condition in the middle. */
function LoopDiagram() {
  const d = deckItem<Loop>('loop.ralph');
  const S = 560;
  const c = S / 2;
  const r = 200;
  const n = d.steps.length;
  const at = (i: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  const arc = (i: number) => {
    const gap = 0.42;
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n + gap;
    const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / n - gap;
    return `M ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)}`;
  };
  return (
    <div className="loopdg">
      <svg className="dg" viewBox={`0 0 ${S} ${S}`} aria-hidden>
        <defs>
          <marker id="loop-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 Z" className="dg-loop-head" />
          </marker>
        </defs>
        {d.steps.map((_, i) => (
          <path key={i} d={arc(i)} className="dg-loop-arc" markerEnd="url(#loop-head)" />
        ))}
        {d.steps.map((s, i) => {
          const p = at(i);
          return (
            <g key={s}>
              <circle cx={p.x} cy={p.y} r={66} className="dg-loop-node" />
              <text x={p.x} y={p.y} className="dg-loop-text">
                {s}
              </text>
            </g>
          );
        })}
        {d.center.split('\n').map((line, i, all) => (
          <text key={i} x={c} y={c + (i - (all.length - 1) / 2) * 38} className="dg-loop-center">
            {line}
          </text>
        ))}
      </svg>
      <div className="loopdg-tags">
        <span>{d.labels.fresh}</span>
        <span>{d.labels.files}</span>
      </div>
    </div>
  );
}

/** Compare side: a pile of full tool manuals. */
function Manuals() {
  return (
    <svg className="dg dg-mini" viewBox="0 0 520 150" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i} transform={`translate(${30 + i * 50} ${8 + (i % 2) * 8})`}>
          <rect width={84} height={126} rx={8} className="dg-page dg-page--muted" />
          {[0, 1, 2, 3, 4].map((j) => (
            <line key={j} x1={12} y1={22 + j * 20} x2={72 - (j % 2) * 16} y2={22 + j * 20} className="dg-scribble dg-scribble--thin" />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Compare side: one-line skill tags, only one SKILL.md opened when needed. */
function Skills() {
  const tags = [0, 1, 2, 3];
  return (
    <svg className="dg dg-mini" viewBox="0 0 520 150" aria-hidden>
      {tags.map((i) => (
        <g key={i} transform={`translate(20 ${10 + i * 34})`}>
          <rect width={200} height={24} rx={12} className="dg-tag" data-on={i === 1} />
          <line x1={18} y1={12} x2={150 - i * 14} y2={12} className="dg-scribble dg-scribble--thin" />
        </g>
      ))}
      <path d="M 232 56 L 300 56" className="dg-link dg-link--primary" />
      <g transform="translate(316 8)">
        <rect width={150} height={134} rx={10} className="dg-page" />
        <text x={75} y={30} className="dg-page-title">
          SKILL.md
        </text>
        {[0, 1, 2, 3].map((j) => (
          <line key={j} x1={18} y1={56 + j * 20} x2={132 - (j % 2) * 30} y2={56 + j * 20} className="dg-scribble dg-scribble--thin" />
        ))}
      </g>
    </svg>
  );
}

/** Who uses AI how much: tiers drawn as a pyramid (not to scale), revealed from the base up. */
function Adoption({ screen, shown }: DiagramProps) {
  const tiers = screen.items ?? [];
  const n = tiers.length;
  return (
    <div className="pyr">
      {tiers
        .map((t, i) => ({ t, i }))
        .reverse()
        .map(({ t, i }) => {
          const level = n - 1 - i;
          const w = 30 + (level / (n - 1)) * 70;
          return (
            <Reveal key={i} className="pyr-row" shown={i < shown}>
              <span className="pyr-tier" data-top={level === 0} style={{ width: `${w}%` }}>
                {t.value}
              </span>
              <Rich as="span" className="pyr-text" text={t.text} />
            </Reveal>
          );
        })}
    </div>
  );
}

const DIAGRAMS: Record<string, (p: DiagramProps) => ReactNode> = {
  'tab-coding': TabCoding,
  'context-stack': ContextStackDiagram,
  equation: EquationDiagram,
  effort: EffortDiagram,
  loop: LoopDiagram,
  manuals: Manuals,
  skills: Skills,
  adoption: Adoption,
};

export function Diagram({ name, screen, shown }: { name: string; screen: Screen; shown: number }) {
  const D = DIAGRAMS[name];
  if (!D) throw new Error(`Unknown diagram ${name}`);
  return <D screen={screen} shown={shown} />;
}
