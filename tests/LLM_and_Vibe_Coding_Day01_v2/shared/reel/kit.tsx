// Motion-reel look shared by the intro and the chapter bumpers: flat color fields, ultra-heavy type
// with motion blur, an italic serif accent and a mono HUD in the four corners (DESIGN.md "Motion Reel").
// Everything is drawn in one 1920×1080 SVG and is a pure function of the scene time.
import '@fontsource/archivo-black/400.css';
import '@fontsource/playfair-display/700-italic.css';
import '@fontsource/jetbrains-mono/500.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { useId, type ReactNode } from 'react';
import { clamp01, ease, readiness } from '@vanilla/runtime';

export const W = 1920;
export const H = 1080;

export const HEAVY = '"Archivo Black", "Pretendard Variable", Pretendard, sans-serif';
export const SANS = '"Pretendard Variable", Pretendard, sans-serif';
export const SERIF = '"Playfair Display", Georgia, serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';

export function loadReelFonts(sample: string): void {
  readiness.loadFonts(['400 200px "Archivo Black"', 'italic 700 200px "Playfair Display"', '500 18px "JetBrains Mono"', '900 200px "Pretendard Variable"', '600 22px "Pretendard Variable"'], sample);
}

export const C = {
  black: 'var(--color-reel-black)',
  cream: 'var(--color-reel-cream)',
  red: 'var(--color-reel-red)',
  blue: 'var(--color-reel-blue)',
  yellow: 'var(--color-reel-yellow)',
  pink: 'var(--color-reel-pink)',
  deck: 'var(--color-canvas-deep)',
} as const;

export type Field = 'black' | 'cream' | 'red' | 'blue' | 'yellow';
/** Ink (type, HUD) and accent (serif, dot) that read on each color field, as in the reference reel. */
export const ON: Record<Field, { ink: string; accent: string }> = {
  black: { ink: C.cream, accent: C.red },
  cream: { ink: C.black, accent: C.red },
  red: { ink: C.black, accent: C.cream },
  blue: { ink: C.cream, accent: C.pink },
  yellow: { ink: C.black, accent: C.red },
};

/** 0→1 progress of [a, b] with an easing. */
export const prog = (u: number, a: number, b: number, fn: (x: number) => number = ease.cubicInOut) => fn(clamp01((u - a) / (b - a)));

/** Derivative of an expoOut slide, scaled: how far it moved in the last ~frame, for motion blur. */
export function slide(u: number, a: number, dur: number, from: number, fn: (x: number) => number = ease.expoOut): { x: number; blur: number } {
  const p = fn(clamp01((u - a) / dur));
  const q = fn(clamp01((u - a - 1 / 60) / dur));
  return { x: from * (1 - p), blur: Math.min(60, Math.abs(from) * (p - q) * 0.9) };
}

/** useId() output is not a valid url(#…) fragment everywhere; keep it to safe characters. */
export const useSvgId = () => 'r' + useId().replace(/[^a-zA-Z0-9_-]/g, '');

/** Directional motion blur. Below a third of a pixel it renders the children untouched. */
export function Blur({ x = 0, y = 0, children }: { x?: number; y?: number; children: ReactNode }) {
  const id = useSvgId();
  if (x < 0.35 && y < 0.35) return <g>{children}</g>;
  return (
    <g filter={`url(#${id})`}>
      <defs>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${x.toFixed(2)} ${y.toFixed(2)}`} />
        </filter>
      </defs>
      {children}
    </g>
  );
}

let measureCtx: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();
/** Text advance width; cached only once the web font is in, so fallback metrics never stick. */
export function textWidth(text: string, font: string): number {
  const key = `${font}|${text}`;
  const hit = widths.get(key);
  if (hit !== undefined) return hit;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 0.6 * parseFloat(font.replace(/^\D*?(\d+(\.\d+)?)px.*$/, '$1'));
  measureCtx.font = font;
  const w = measureCtx.measureText(text).width;
  if (document.fonts.check(font)) widths.set(key, w);
  return w;
}

/** Largest size ≤ max at which `text` fits in `room` px. */
export function fitSize(text: string, weightFamily: (size: number) => string, max: number, room: number): number {
  const w = textWidth(text, weightFamily(100));
  return w > 0 ? Math.min(max, (room / w) * 100) : max;
}

/** Scene timecode as the reel prints it: 00:SS:FF. */
export function timecode(t: number, fps = 30): string {
  const s = Math.max(0, t);
  return `00:${String(Math.floor(s)).padStart(2, '0')}:${String(Math.floor((s % 1) * fps)).padStart(2, '0')}`;
}

/** Four-corner mono HUD; each label types itself in at `at`. */
export function Hud({ u, at = 0, color, tl, tr, bl, br }: { u: number; at?: number; color: string; tl: string; tr: string; bl: string; br: string }) {
  const typed = (s: string, d: number) => s.slice(0, Math.max(0, Math.floor((u - at - d) * 60)));
  const common = { fontFamily: MONO, fontWeight: 500, fontSize: 18, letterSpacing: 2.4, style: { fill: color } } as const;
  return (
    <g>
      <text x={42} y={68} {...common}>{typed(tl, 0)}</text>
      <text x={W - 42} y={68} textAnchor="end" {...common}>{typed(tr, 0.05)}</text>
      <text x={42} y={H - 36} {...common} xmlSpace="preserve">{typed(bl, 0.1)}</text>
      <text x={W - 42} y={H - 36} textAnchor="end" {...common}>{u >= at + 0.1 ? br : ''}</text>
    </g>
  );
}

/** Full-frame stage: one SVG in design pixels, letterboxed into the frame by the browser. */
export function Stage({ bg, label, children }: { bg: string; label: string; children: ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: C.deck }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }} role="img" aria-label={label}>
        <rect width={W} height={H} style={{ fill: bg }} />
        {children}
      </svg>
    </div>
  );
}
