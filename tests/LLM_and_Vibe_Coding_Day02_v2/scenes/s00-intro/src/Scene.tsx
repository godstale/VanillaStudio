// Intro: "Vibe Coding for Beginners" — a 15 s chalk-on-blueprint motion piece.
// A spoken prompt becomes code, the code becomes a blueprint, the blueprint turns into working gears,
// the tests pass, and everything lands on a filmstrip title card. Six shots of one bar each (96 BPM).
import '@fontsource/great-vibes/400.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/jetbrains-mono/500.css';
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { clamp01, defineScene, ease, lerp, mulberry32, param, readiness, token, useDesign, useFrame, useParams, useTime } from '@vanilla/runtime';
import { useSoundtrack } from './soundtrack';
import { CHECKS, CODE, DURATION, GEAR_TEETH, KEYWORDS, SEND_PRESS, SHOT, TYPE_RATE, TYPE_START, gearAngle } from './timing';

const params = {
  title: param.text('Vibe Coding', { label: 'Title' }),
  subtitle: param.text('for Beginners', { label: 'Subtitle (script)' }),
  prompt: param.text('make me a game', { label: 'Prompt (script)' }),
  chalk: param.color(token('paper'), { label: 'Chalk color' }),
  accent: param.color(token('primary'), { label: 'Accent color' }),
  music: param.boolean(true, { label: 'Background music' }),
  volume: param.number(0.8, { min: 0, max: 1, step: 0.05, label: 'Music volume' }),
};

const SCRIPT = '"Great Vibes", cursive';
const SERIF = '"Playfair Display", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
readiness.loadFonts(['400 150px "Great Vibes"', '700 180px "Playfair Display"', '500 40px "JetBrains Mono"'], 'Vibe Coding for Beginners make me a game');

interface Palette {
  chalk: string;
  accent: string;
  faint: string;
  bg: string;
}
const Pal = createContext<Palette>({ chalk: 'var(--color-paper)', accent: 'var(--color-primary)', faint: 'var(--color-ink-faint)', bg: 'var(--color-canvas-deep)' });
const usePal = () => useContext(Pal);
/** useId() output is not a valid url(#…) fragment everywhere; keep it to safe characters. */
const useSvgId = () => 'i' + useId().replace(/[^a-zA-Z0-9_-]/g, '');

// ---- math & path helpers -----------------------------------------------------------------------

const prog = (u: number, a: number, b: number, fn: (x: number) => number = ease.cubicInOut) => fn(clamp01((u - a) / (b - a)));
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const circ = (cx: number, cy: number, r: number) => `M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}Z`;
const seg = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}L${x2} ${y2}`;

function gearPath(teeth: number, r: number, depth: number): string {
  const ro = r + depth / 2;
  const ri = r - depth / 2;
  const step = (Math.PI * 2) / teeth;
  const pt = (a: number, rad: number) => `${(Math.cos(a) * rad).toFixed(2)} ${(Math.sin(a) * rad).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    d += `${i === 0 ? 'M' : 'L'}${pt(a, ri)}L${pt(a + step * 0.2, ri)}L${pt(a + step * 0.32, ro)}L${pt(a + step * 0.68, ro)}L${pt(a + step * 0.8, ri)}`;
  }
  return d + 'Z';
}

let measureCtx: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();
/** Text advance width; cached only once the web font is in, so fallback metrics never stick. */
function textWidth(text: string, font: string): number {
  const key = `${font}|${text}`;
  const hit = widths.get(key);
  if (hit !== undefined) return hit;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 40;
  measureCtx.font = font;
  const w = measureCtx.measureText(text).width;
  if (document.fonts.check(font)) widths.set(key, w);
  return w;
}

// ---- drawing primitives ------------------------------------------------------------------------

/** A chalk stroke that draws itself (p: 0..1), with a thin offset second pass for the hand-drawn feel. */
function Ink({ d, p, w = 3, color, sketch = true, opacity = 1 }: { d: string; p: number; w?: number; color?: string; sketch?: boolean; opacity?: number }) {
  const pal = usePal();
  if (p <= 0) return null;
  const stroke = color ?? pal.chalk;
  return (
    <g opacity={opacity} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - p} style={{ stroke }} strokeWidth={w} />
      {sketch && (
        <path
          d={d}
          pathLength={1}
          strokeDasharray="1 2"
          strokeDashoffset={1 - clamp01(p * 1.04 - 0.04)}
          transform="translate(1.8 -1.4)"
          style={{ stroke }}
          strokeWidth={Math.max(1, w * 0.45)}
          opacity={0.5}
        />
      )}
    </g>
  );
}

function Dashed({ x1, y1, x2, y2, p, color, w = 2, opacity = 1 }: { x1: number; y1: number; x2: number; y2: number; p: number; color?: string; w?: number; opacity?: number }) {
  const pal = usePal();
  if (p <= 0) return null;
  return <line x1={x1} y1={y1} x2={lerp(x1, x2, p)} y2={lerp(y1, y2, p)} style={{ stroke: color ?? pal.chalk }} strokeWidth={w} strokeDasharray="10 10" opacity={opacity} />;
}

/** Accent spark: a dot pops in with a ring of rays that fly out and fade. */
function Spark({ x, y, u, r = 10 }: { x: number; y: number; u: number; r?: number }) {
  const pal = usePal();
  if (u < 0) return null;
  const pop = ease.backOut(clamp01(u / 0.25));
  const fly = ease.expoOut(clamp01(u / 0.55));
  const fade = 1 - clamp01((u - 0.3) / 0.45);
  return (
    <g>
      <circle cx={x} cy={y} r={r * 2.4 * pop} style={{ fill: pal.accent }} opacity={0.18} />
      <circle cx={x} cy={y} r={r * pop} style={{ fill: pal.accent }} />
      {fade > 0 &&
        Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 + 0.2;
          const r0 = r * 1.6 + 30 * fly;
          const r1 = r0 + 16 * (1 - fly) + 6;
          return (
            <line
              key={i}
              x1={x + Math.cos(a) * r0}
              y1={y + Math.sin(a) * r0}
              x2={x + Math.cos(a) * r1}
              y2={y + Math.sin(a) * r1}
              style={{ stroke: pal.accent }}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={fade}
            />
          );
        })}
    </g>
  );
}

/** Script/serif text that writes itself left to right: outline traced, then filled in, with a glowing nib. */
function Handwrite({
  text,
  x,
  y,
  size,
  font,
  weight = 400,
  u,
  a,
  b,
  color,
  anchor = 'middle',
  nib = true,
}: {
  text: string;
  x: number;
  y: number;
  size: number;
  font: string;
  weight?: number;
  u: number;
  a: number;
  b: number;
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
  nib?: boolean;
}) {
  const pal = usePal();
  const id = useSvgId();
  const p = prog(u, a, b, ease.sineInOut);
  if (p <= 0) return null;
  const ink = color ?? pal.chalk;
  const w = textWidth(text, `${weight} ${size}px ${font}`);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const edge = x0 - size * 0.25 + (w + size * 0.5) * p;
  const fill = prog(u, lerp(a, b, 0.55), b + 0.25, ease.quadOut);
  const dash = size * 9;
  return (
    <g>
      <clipPath id={id}>
        <rect x={x0 - size} y={y - size * 1.4} width={edge - (x0 - size)} height={size * 2.2} />
      </clipPath>
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        fontFamily={font}
        fontWeight={weight}
        fontSize={size}
        clipPath={`url(#${id})`}
        style={{ fill: ink, fillOpacity: fill, stroke: ink }}
        strokeWidth={size / 70}
        strokeDasharray={`${dash} ${dash}`}
        strokeDashoffset={dash * (1 - p)}
      >
        {text}
      </text>
      {nib && p < 1 && <circle cx={edge} cy={y - size * 0.28} r={5} style={{ fill: pal.accent }} opacity={0.9} />}
    </g>
  );
}

/** Zoom-through between shots: the outgoing shot dives into its focal point, the next one grows out of the centre. */
function Stage({ t, i, focal, children }: { t: number; i: number; focal: [number, number]; children: ReactNode }) {
  const start = SHOT[i];
  const end = SHOT[i + 1];
  const last = i === SHOT.length - 2;
  const IN = 0.32;
  const OUT = 0.3;
  if (t < start - IN || (!last && t > end + OUT)) return null;
  let s = 1;
  let o = 1;
  let [fx, fy] = [960, 540];
  if (i > 0 && t < start + 0.22) {
    const k = ease.expoOut(clamp01((t - (start - IN)) / (IN + 0.22)));
    s = lerp(0.5, 1, k);
    o = clamp01(k * 1.8);
  } else if (!last && t > end - 0.24) {
    const k = ease.expoIn(clamp01((t - (end - 0.24)) / (0.24 + OUT)));
    s = lerp(1, 2.8, k);
    o = 1 - k;
    [fx, fy] = focal;
  }
  const push = 1 + 0.05 * ease.sineInOut(clamp01((t - start) / (end - start)));
  return (
    <g opacity={o} transform={`translate(${fx} ${fy}) scale(${s}) translate(${-fx} ${-fy})`}>
      <g transform={`translate(960 540) scale(${push}) translate(-960 -540)`}>{children}</g>
    </g>
  );
}

// ---- shots (u = seconds since the shot started) -----------------------------------------------------

function ShotPrompt({ u, prompt }: { u: number; prompt: string }) {
  const pal = usePal();
  const [bx, by, bw, bh, r] = [380, 330, 1160, 360, 64];
  const bubble = `M${bx + r} ${by}H${bx + bw - r}A${r} ${r} 0 0 1 ${bx + bw} ${by + r}V${by + bh - r}A${r} ${r} 0 0 1 ${bx + bw - r} ${by + bh}H${bx + 300}L${bx + 170} ${by + bh + 110}L${bx + 210} ${by + bh}H${bx + r}A${r} ${r} 0 0 1 ${bx} ${by + bh - r}V${by + r}A${r} ${r} 0 0 1 ${bx + r} ${by}Z`;
  const guides = `${seg(470, 455, 1360, 455)}${seg(470, 590, 1360, 590)}`;
  const slants = Array.from({ length: 8 }, (_, i) => seg(510 + i * 115, 610, 545 + i * 115, 435)).join('');
  const press = clamp01((u - SEND_PRESS) / 0.2);
  const btnScale = 1 - 0.12 * Math.sin(Math.PI * press);
  return (
    <g>
      <Ink d={bubble} p={prog(u, 0.2, 1.05)} w={4} />
      <Ink d={guides} p={prog(u, 0.4, 0.95)} w={1.5} sketch={false} opacity={0.35} />
      <Ink d={slants} p={prog(u, 0.55, 1.1)} w={1.2} sketch={false} opacity={0.18} />
      <Handwrite text={prompt} x={915} y={585} size={150} font={SCRIPT} u={u} a={0.6} b={1.85} />
      <g transform={`translate(1450 610) scale(${btnScale}) translate(-1450 -610)`}>
        <Ink d={circ(1450, 610, 44)} p={prog(u, 1.55, 1.95)} w={3.5} color={pal.accent} />
        <Ink d={`${seg(1428, 610, 1470, 610)}M1452 592L1472 610L1452 628`} p={prog(u, 1.8, 2.05)} w={4} color={pal.accent} sketch={false} />
      </g>
      {press > 0 && press < 1 && <circle cx={1450} cy={610} r={44 + 60 * press} fill="none" style={{ stroke: pal.accent }} strokeWidth={3} opacity={1 - press} />}
      <Spark x={bx + r} y={by} u={u} />
    </g>
  );
}

const CHAR_W = 24; // JetBrains Mono advance at 40px
function brace(x: number, y1: number, y2: number, dir: 1 | -1): string {
  const m = (y1 + y2) / 2;
  return `M${x + dir * 34} ${y1}Q${x} ${y1} ${x} ${y1 + 44}V${m - 40}Q${x} ${m} ${x - dir * 34} ${m}Q${x} ${m} ${x} ${m + 40}V${y2 - 44}Q${x} ${y2} ${x + dir * 34} ${y2}`;
}
const TREE = [
  { x: 1450, y: 300, label: 'game', at: 0.7 },
  { x: 1310, y: 480, label: 'score', at: 1.1, parent: 0 },
  { x: 1590, y: 480, label: 'while', at: 1.2, parent: 0 },
  { x: 1480, y: 660, label: 'move', at: 1.55, parent: 2 },
  { x: 1700, y: 660, label: '+= 1', at: 1.65, parent: 2 },
] as const;

function ShotCode({ u }: { u: number }) {
  const pal = usePal();
  const typed = Math.max(0, Math.floor((u - TYPE_START) * TYPE_RATE));
  let before = 0;
  let caret: { x: number; y: number } | null = null;
  const lines = CODE.map((line, i) => {
    const shown = line.slice(0, Math.max(0, typed - before));
    if (typed > before && typed <= before + line.length) caret = { x: 360 + shown.length * CHAR_W, y: 300 + i * 66 };
    before += line.length;
    return { shown, parts: shown.split(/((?:function|let|while))/), i };
  });
  const cursor = caret as { x: number; y: number } | null;
  const blink = Math.floor(u * 4) % 2 === 0;
  return (
    <g>
      <Ink d={brace(250, 230, 760, 1)} p={prog(u, 0, 0.5)} w={4} />
      <Ink d={brace(1110, 230, 760, -1)} p={prog(u, 0.1, 0.6)} w={4} />
      {lines.map(({ shown, parts, i }) => (
        <g key={i}>
          <text x={320} y={300 + i * 66} textAnchor="end" fontFamily={MONO} fontSize={26} style={{ fill: pal.faint }} opacity={prog(u, 0.05 + i * 0.05, 0.3 + i * 0.05)}>
            {i + 1}
          </text>
          {shown && (
            <text x={360} y={300 + i * 66} fontFamily={MONO} fontWeight={500} fontSize={40} xmlSpace="preserve" style={{ whiteSpace: 'pre' }}>
              {parts.map((part, k) => (
                <tspan key={k} style={{ fill: KEYWORDS.has(part) ? pal.accent : pal.chalk }}>
                  {part}
                </tspan>
              ))}
            </text>
          )}
        </g>
      ))}
      {cursor && blink && <rect x={cursor.x + 2} y={cursor.y - 34} width={20} height={42} style={{ fill: pal.accent }} opacity={0.85} />}
      {TREE.map((n, i) => {
        const parent = 'parent' in n ? TREE[n.parent] : null;
        return (
          <g key={i}>
            {parent && <Ink d={seg(parent.x, parent.y + 32, n.x, n.y - 32)} p={prog(u, n.at - 0.3, n.at)} w={2.5} />}
            <Ink d={rr(n.x - 85, n.y - 32, 170, 64, 14)} p={prog(u, n.at, n.at + 0.35)} w={3} />
            <text x={n.x} y={n.y + 10} textAnchor="middle" fontFamily={MONO} fontSize={28} style={{ fill: pal.chalk }} opacity={prog(u, n.at + 0.2, n.at + 0.45)}>
              {n.label}
            </text>
          </g>
        );
      })}
      <Dashed x1={830} y1={420} x2={1500} y2={480} p={prog(u, 1.5, 1.95)} color={pal.accent} />
    </g>
  );
}

function ShotBlueprint({ u }: { u: number }) {
  const pal = usePal();
  const id = useSvgId();
  const ticksTop = Array.from({ length: 31 }, (_, i) => seg(360 + i * 40, 150, 360 + i * 40, i % 5 === 0 ? 128 : 140)).join('');
  const ticksLeft = Array.from({ length: 19 }, (_, i) => seg(300, 210 + i * 40, i % 5 === 0 ? 278 : 290, 210 + i * 40)).join('');
  const hatch = prog(u, 0.85, 1.5);
  const cards = [420, 790, 1160].map((x) => rr(x, 750, 340, 140, 14)).join('');
  return (
    <g>
      <Ink d={`${seg(360, 150, 1560, 150)}${ticksTop}`} p={prog(u, 0, 0.6)} w={1.6} sketch={false} opacity={0.6} />
      <Ink d={`${seg(300, 210, 300, 930)}${ticksLeft}`} p={prog(u, 0.05, 0.6)} w={1.6} sketch={false} opacity={0.6} />
      <Ink d={rr(360, 210, 1200, 720, 28)} p={prog(u, 0.1, 0.85)} w={4} />
      <Ink d={rr(374, 224, 1172, 692, 20)} p={prog(u, 0.2, 0.95)} w={1.5} opacity={0.5} />
      <Ink d={seg(374, 270, 1546, 270)} p={prog(u, 0.45, 0.8)} w={2.5} />
      <Ink d={`${circ(404, 247, 9)}${circ(436, 247, 9)}`} p={prog(u, 0.55, 0.8)} w={2.5} />
      <Ink d={circ(468, 247, 9)} p={prog(u, 0.6, 0.85)} w={2.5} color={pal.accent} />
      <Ink d={rr(520, 233, 560, 28, 14)} p={prog(u, 0.6, 0.9)} w={2} opacity={0.7} />
      <Ink d={rr(420, 300, 120, 40, 8)} p={prog(u, 0.7, 0.95)} w={2.5} />
      <Ink d={[1200, 1290, 1380, 1470].map((x) => seg(x, 320, x + 60, 320)).join('')} p={prog(u, 0.75, 1.05)} w={5} sketch={false} opacity={0.55} />
      <clipPath id={id}>
        <rect x={420} y={380} width={640 * hatch} height={330} />
      </clipPath>
      <rect x={420} y={380} width={640} height={330} fill="url(#intro-hatch)" clipPath={`url(#${id})`} />
      <Ink d={rr(420, 380, 640, 330, 12)} p={prog(u, 0.8, 1.25)} w={3.5} />
      <Ink d={`${seg(420, 380, 1060, 710)}${seg(1060, 380, 420, 710)}`} p={prog(u, 1.2, 1.6)} w={1.5} opacity={0.4} sketch={false} />
      <Ink d={[420, 470, 520].map((y, i) => seg(1110, y, 1110 + [390, 330, 250][i], y)).join('')} p={prog(u, 1.0, 1.4)} w={14} sketch={false} opacity={0.5} />
      <Ink d={rr(1110, 580, 220, 70, 35)} p={prog(u, 1.2, 1.6)} w={3.5} color={pal.accent} />
      <Ink d={cards} p={prog(u, 1.3, 1.95)} w={3} />
      <Ink d={`${seg(360, 975, 1560, 975)}${seg(360, 960, 360, 990)}${seg(1560, 960, 1560, 990)}`} p={prog(u, 1.6, 2.1)} w={1.6} sketch={false} opacity={0.5} />
    </g>
  );
}

const GEARS = (() => {
  const m = 170 / GEAR_TEETH[0];
  const rA = 170;
  const rB = m * GEAR_TEETH[1];
  const rC = m * GEAR_TEETH[2];
  const a1 = (-20 * Math.PI) / 180;
  const a2 = (50 * Math.PI) / 180;
  const A = { x: 800, y: 560 };
  const B = { x: A.x + Math.cos(a1) * (rA + rB), y: A.y + Math.sin(a1) * (rA + rB) };
  const C = { x: B.x + Math.cos(a2) * (rB + rC), y: B.y + Math.sin(a2) * (rB + rC) };
  const depth = m * 2.2;
  return [
    { ...A, r: rA, teeth: GEAR_TEETH[0], path: gearPath(GEAR_TEETH[0], rA, depth), link: 0 },
    { ...B, r: rB, teeth: GEAR_TEETH[1], path: gearPath(GEAR_TEETH[1], rB, depth), link: a1 },
    { ...C, r: rC, teeth: GEAR_TEETH[2], path: gearPath(GEAR_TEETH[2], rC, depth), link: a2 },
  ];
})();

/** Meshing angles (deg): each gear turns opposite to its driver at the teeth ratio, phased so teeth interlock. */
function gearAngles(t: number): number[] {
  const out = [gearAngle(t)];
  for (let i = 1; i < GEARS.length; i++) {
    const prev = GEARS[i - 1];
    const g = GEARS[i];
    const ratio = prev.teeth / g.teeth;
    const link = (g.link * 180) / Math.PI;
    out.push(-(out[i - 1] - link) * ratio + link + 180 + 180 / g.teeth);
  }
  return out;
}

function ShotGears({ u }: { u: number }) {
  const pal = usePal();
  const angles = gearAngles(SHOT[3] + u);
  const [A, B, C] = GEARS;
  return (
    <g>
      <Ink d={`M520 230V880M1420 230V880${seg(520, 250, 1420, 250)}`} p={prog(u, 0, 0.55)} w={4} color={pal.accent} />
      <Ink d={`${rr(560, 800, 820, 26, 4)}`} p={prog(u, 0.15, 0.6)} w={3} />
      <Ink d={GEARS.map((g) => seg(g.x, g.y, g.x, 800)).join('')} p={prog(u, 0.3, 0.7)} w={2} opacity={0.5} sketch={false} />
      <Dashed x1={A.x} y1={A.y} x2={B.x} y2={B.y} p={prog(u, 0.35, 0.7)} opacity={0.35} />
      <Dashed x1={B.x} y1={B.y} x2={C.x} y2={C.y} p={prog(u, 0.45, 0.8)} opacity={0.35} />
      {GEARS.map((g, i) => (
        <g key={i}>
          <g transform={`translate(${g.x} ${g.y}) rotate(${angles[i]})`}>
            <Ink d={g.path} p={prog(u, 0.1 + i * 0.15, 0.75 + i * 0.15)} w={3} />
            <Ink d={circ(0, 0, g.r * 0.62)} p={prog(u, 0.3 + i * 0.15, 0.8 + i * 0.15)} w={1.6} opacity={0.6} />
            <Ink d={[0, 1, 2, 3].map((k) => seg(Math.cos((k * Math.PI) / 2) * 20, Math.sin((k * Math.PI) / 2) * 20, Math.cos((k * Math.PI) / 2) * g.r * 0.6, Math.sin((k * Math.PI) / 2) * g.r * 0.6)).join('')} p={prog(u, 0.4 + i * 0.15, 0.85 + i * 0.15)} w={2.5} sketch={false} />
            <Ink d={circ(0, 0, 20)} p={prog(u, 0.35 + i * 0.15, 0.7 + i * 0.15)} w={3} color={i === 0 ? pal.accent : undefined} />
          </g>
        </g>
      ))}
      <Spark x={A.x} y={A.y} u={u - 0.55} r={7} />
    </g>
  );
}

const TESTS = ['board()', 'move()', 'score()', 'end()'];
function ShotTests({ u }: { u: number }) {
  const pal = usePal();
  const ring = CHECKS.pass.reduce((sum, at) => sum + prog(u, at + 0.05, at + 0.35, ease.cubicOut), 0) / CHECKS.pass.length;
  const done = u >= CHECKS.done;
  const counter = Math.round(ring * 100);
  return (
    <g>
      {TESTS.map((label, i) => {
        const y = 330 + i * 110;
        const x = 600;
        const pass = CHECKS.pass[i];
        const check = `M${x + 10} ${y + 30}L${x + 26} ${y + 48}L${x + 66} ${y - 6}`;
        return (
          <g key={label}>
            <Ink d={rr(x, y, 56, 56, 8)} p={prog(u, 0.05 + i * 0.08, 0.35 + i * 0.08)} w={3} />
            <text x={x + 90} y={y + 42} fontFamily={MONO} fontWeight={500} fontSize={40} style={{ fill: pal.chalk }} opacity={prog(u, 0.15 + i * 0.08, 0.4 + i * 0.08)}>
              {label}
            </text>
            {i === 2 && u < CHECKS.erase + 0.25 && (
              <Ink d={`${seg(x + 12, y + 12, x + 44, y + 44)}${seg(x + 44, y + 12, x + 12, y + 44)}`} p={prog(u, CHECKS.fail, CHECKS.fail + 0.15, ease.linear)} w={5} color={pal.accent} sketch={false} />
            )}
            {i === 2 && (
              <Ink d={`M${x - 6} ${y + 14}L${x + 62} ${y + 6}L${x - 4} ${y + 30}L${x + 64} ${y + 22}L${x - 2} ${y + 46}L${x + 62} ${y + 40}`} p={prog(u, CHECKS.erase, CHECKS.erase + 0.2, ease.linear) * (1 - clamp01((u - CHECKS.erase - 0.25) / 0.05))} w={16} color={pal.bg} sketch={false} />
            )}
            {i === 2 && u >= CHECKS.erase + 0.25 && <Ink d={rr(x, y, 56, 56, 8)} p={1} w={3} />}
            <Ink d={check} p={prog(u, pass, pass + 0.18, ease.quadOut)} w={5} color={i === 2 ? pal.accent : undefined} />
          </g>
        );
      })}
      <Ink d={circ(1340, 520, 170)} p={prog(u, 0.1, 0.55)} w={1.5} opacity={0.35} sketch={false} />
      <g transform="rotate(-90 1340 520)">
        <Ink d={circ(1340, 520, 150)} p={ring} w={10} color={done ? pal.accent : undefined} sketch={false} />
      </g>
      <text x={1340} y={548} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={84} style={{ fill: done ? pal.accent : pal.chalk, fontVariantNumeric: 'tabular-nums' }} opacity={prog(u, 0.3, 0.6)}>
        {`${counter}%`}
      </text>
      {done && <Spark x={1340} y={350} u={u - CHECKS.done} r={8} />}
    </g>
  );
}

function ShotTitle({ u, title, subtitle, prompt }: { u: number; title: string; subtitle: string; prompt: string }) {
  const pal = usePal();
  const size = 180;
  const w = textWidth(title, `700 ${size}px ${SERIF}`);
  const x0 = 960 - w / 2;
  const slide = 1500 * (1 - ease.expoOut(clamp01((u - 0.2) / 1.0)));
  const frames = [0, 1, 2, 3, 4];
  const holes = (y: number) => Array.from({ length: 40 }, (_, i) => rr(236 + i * 36, y, 16, 10, 3)).join('');
  return (
    <g>
      <Ink d={rr(x0 - 70, 290, w + 140, 210, 4)} p={prog(u, 0.05, 0.55)} w={1.2} sketch={false} opacity={0.3} />
      <Dashed x1={0} y1={455} x2={1920} y2={455} p={prog(u, 0, 0.5)} opacity={0.15} w={1.5} />
      <Handwrite text={title} x={960} y={455} size={size} font={SERIF} weight={700} u={u} a={0.05} b={0.75} nib={false} />
      <circle cx={x0 + w + 26} cy={443} r={13 * ease.backOut(clamp01((u - 0.7) / 0.25))} style={{ fill: pal.accent }} />
      <Spark x={x0 + w + 26} y={443} u={u - 0.7} r={13} />
      <Handwrite text={subtitle} x={x0 + w + 10} y={585} size={112} font={SCRIPT} u={u} a={0.55} b={1.45} color={pal.accent} anchor="end" />
      <g transform={`translate(${slide} 0)`}>
        <Ink d={`${seg(220, 652, 1700, 652)}${seg(220, 848, 1700, 848)}`} p={prog(u, 0.2, 0.9)} w={3} />
        <Ink d={`${holes(660)}${holes(830)}`} p={prog(u, 0.4, 1.1)} w={1.6} sketch={false} opacity={0.7} />
        <rect x={220} y={678} width={60} height={144} fill="url(#intro-hatch)" opacity={prog(u, 0.6, 1)} />
        <rect x={1640} y={678} width={60} height={144} fill="url(#intro-hatch)" opacity={prog(u, 0.6, 1)} />
        {frames.map((k) => {
          const x = 288 + k * 272;
          const o = prog(u, 0.8 + k * 0.08, 1.15 + k * 0.08);
          return (
            <g key={k}>
              <Ink d={rr(x, 678, 256, 144, 4)} p={prog(u, 0.5 + k * 0.06, 0.95 + k * 0.06)} w={3} />
              {o > 0 && (
                <svg x={x} y={678} width={256} height={144} viewBox="0 0 1920 1080" opacity={o}>
                  {k === 0 && <ShotPrompt u={2.0} prompt={prompt} />}
                  {k === 1 && <ShotCode u={2.0} />}
                  {k === 2 && <ShotBlueprint u={2.2} />}
                  {k === 3 && <ShotGears u={2.2} />}
                  {k === 4 && <ShotTests u={2.2} />}
                </svg>
              )}
            </g>
          );
        })}
      </g>
    </g>
  );
}

// ---- backdrop & texture --------------------------------------------------------------------------

function Backdrop({ t }: { t: number }) {
  const pal = usePal();
  const a = t * 4;
  return (
    <g>
      <rect width={1920} height={1080} style={{ fill: pal.bg }} />
      <g opacity={0.03} fill="none" style={{ stroke: pal.chalk }} strokeWidth={70} strokeLinecap="round">
        <path d="M-200 900A900 900 0 0 1 700 -100" transform={`rotate(${a} 700 900)`} />
        <path d="M1300 1250A700 700 0 0 1 2100 300" transform={`rotate(${-a * 0.7} 1500 900)`} />
        <path d="M1500 -150A520 520 0 0 1 1980 380" transform={`rotate(${a * 0.5} 1700 200)`} />
      </g>
      <rect width={1920} height={1080} fill="url(#intro-vignette)" />
    </g>
  );
}

/** Static chalk grain: specks of the board colour eat into every stroke, plus a little dust. Drawn once. */
/** `bg` and `chalk` are resolved hex values (canvas pixels cannot read CSS variables). */
function Grain({ bg, chalk }: { bg: string; chalk: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const channels = (hex: string) => {
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex.trim());
      return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
    };
    const [br, bgc, bb] = channels(bg);
    const [cr, cg, cb] = channels(chalk);
    const img = ctx.createImageData(canvas.width, canvas.height);
    const rand = mulberry32(1337);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rand();
      if (v < 0.5) {
        img.data[i] = br;
        img.data[i + 1] = bgc;
        img.data[i + 2] = bb;
        img.data[i + 3] = Math.round((1 - v * 2) ** 2 * 200);
      } else if (v > 0.9985) {
        img.data[i] = cr;
        img.data[i + 1] = cg;
        img.data[i + 2] = cb;
        img.data[i + 3] = 40;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [bg, chalk]);
  return <canvas ref={ref} width={1920} height={1080} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}

function Defs() {
  const pal = usePal();
  return (
    <defs>
      <pattern id="intro-hatch" width={16} height={16} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={16} style={{ stroke: pal.chalk }} strokeWidth={2} opacity={0.32} />
      </pattern>
      <radialGradient id="intro-vignette" cx="50%" cy="50%" r="75%">
        <stop offset="55%" stopOpacity={0} style={{ stopColor: pal.bg }} />
        <stop offset="100%" stopOpacity={0.85} style={{ stopColor: pal.bg }} />
      </radialGradient>
    </defs>
  );
}

// ---- scene -----------------------------------------------------------------------------------------

/** The stage keeps the workspace canvas size and is scaled to fit the window (same as the deck scenes). */
function useFitScale(width: number, height: number): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / width, window.innerHeight / height));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [width, height]);
  return scale;
}

function IntroScene() {
  const t = useTime();
  const { width, height } = useFrame();
  const { title, subtitle, prompt, chalk, accent, music, volume } = useParams<typeof params>();
  const design = useDesign();
  const scale = useFitScale(width, height);
  useSoundtrack(music, volume);
  const pal: Palette = { chalk, accent, faint: 'var(--color-ink-faint)', bg: 'var(--color-canvas-deep)' };
  return (
    <Pal.Provider value={pal}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: pal.bg }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width, height, overflow: 'hidden', transform: `translate(-50%, -50%) scale(${scale})` }}>
        <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ display: 'block' }} aria-label={`${title} ${subtitle}`}>
          <Defs />
          <Backdrop t={t} />
          <Stage t={t} i={0} focal={[1450, 610]}>
            <ShotPrompt u={t - SHOT[0]} prompt={prompt} />
          </Stage>
          <Stage t={t} i={1} focal={[1590, 480]}>
            <ShotCode u={t - SHOT[1]} />
          </Stage>
          <Stage t={t} i={2} focal={[740, 545]}>
            <ShotBlueprint u={t - SHOT[2]} />
          </Stage>
          <Stage t={t} i={3} focal={[GEARS[2].x, GEARS[2].y]}>
            <ShotGears u={t - SHOT[3]} />
          </Stage>
          <Stage t={t} i={4} focal={[1340, 520]}>
            <ShotTests u={t - SHOT[4]} />
          </Stage>
          <Stage t={t} i={5} focal={[960, 540]}>
            <ShotTitle u={t - SHOT[5]} title={title} subtitle={subtitle} prompt={prompt} />
          </Stage>
        </svg>
        <Grain bg={design.colors['canvas-deep'] ?? ''} chalk={chalk} />
      </div>
      </div>
    </Pal.Provider>
  );
}

export default defineScene({
  id: 'scn_2c75c92e3237',
  duration: DURATION,
  params,
  Component: IntroScene,
});
