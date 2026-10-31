// Chalk-on-blueprint drawing primitives, the same look as scenes/s00-intro (strokes that draw
// themselves, handwritten text, amber sparks, static grain). Kept here so the bumpers share one copy.
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { clamp01, ease, lerp, mulberry32 } from '@vanilla/runtime';

export interface Palette {
  chalk: string;
  accent: string;
  faint: string;
  bg: string;
}
export const Pal = createContext<Palette>({ chalk: 'var(--color-paper)', accent: 'var(--color-primary)', faint: 'var(--color-ink-faint)', bg: 'var(--color-canvas-deep)' });
export const usePal = () => useContext(Pal);
/** useId() output is not a valid url(#…) fragment everywhere; keep it to safe characters. */
const useSvgId = () => 'i' + useId().replace(/[^a-zA-Z0-9_-]/g, '');

export const prog = (u: number, a: number, b: number, fn: (x: number) => number = ease.cubicInOut) => fn(clamp01((u - a) / (b - a)));
export const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
export const circ = (cx: number, cy: number, r: number) => `M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}Z`;
export const seg = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}L${x2} ${y2}`;

let measureCtx: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();
/** Text advance width; cached only once the web font is in, so fallback metrics never stick. */
export function textWidth(text: string, font: string): number {
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

/** A chalk stroke that draws itself (p: 0..1), with a thin offset second pass for the hand-drawn feel. */
export function Ink({ d, p, w = 3, color, sketch = true, opacity = 1 }: { d: string; p: number; w?: number; color?: string; sketch?: boolean; opacity?: number }) {
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

export function Dashed({ x1, y1, x2, y2, p, color, w = 2, opacity = 1 }: { x1: number; y1: number; x2: number; y2: number; p: number; color?: string; w?: number; opacity?: number }) {
  const pal = usePal();
  if (p <= 0) return null;
  return <line x1={x1} y1={y1} x2={lerp(x1, x2, p)} y2={lerp(y1, y2, p)} style={{ stroke: color ?? pal.chalk }} strokeWidth={w} strokeDasharray="10 10" opacity={opacity} />;
}

/** Accent spark: a dot pops in with a ring of rays that fly out and fade. */
export function Spark({ x, y, u, r = 10 }: { x: number; y: number; u: number; r?: number }) {
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

/** Text that writes itself left to right: outline traced, then filled in, with a glowing nib. */
export function Handwrite({
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

export function Backdrop({ t }: { t: number }) {
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
      <rect width={1920} height={1080} fill="url(#bumper-vignette)" />
    </g>
  );
}

export function Defs() {
  const pal = usePal();
  return (
    <defs>
      <radialGradient id="bumper-vignette" cx="50%" cy="50%" r="75%">
        <stop offset="55%" stopOpacity={0} style={{ stopColor: pal.bg }} />
        <stop offset="100%" stopOpacity={0.85} style={{ stopColor: pal.bg }} />
      </radialGradient>
    </defs>
  );
}

/** Static chalk grain: specks of the board colour eat into every stroke, plus a little dust. Drawn once. */
/** `bg` and `chalk` are resolved hex values (canvas pixels cannot read CSS variables). */
export function Grain({ bg, chalk }: { bg: string; chalk: string }) {
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

/** The stage keeps the workspace canvas size and is scaled to fit the window (same as the deck scenes). */
export function useFitScale(width: number, height: number): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / width, window.innerHeight / height));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [width, height]);
  return scale;
}
