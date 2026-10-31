// Chapter bumper: a 4 s chalk-on-blueprint sting in the intro's style, played between chapters.
// A spark lights a chalk ring, the chapter number writes itself inside it, the Korean chapter title
// is handwritten beside an amber bar, the chapter rail marks where we are, and the board dives through
// the ring so the next slide crossfades in from a clean board.
// Copy (chapter number/title, kicker) comes from storyboard/data/content.json.
import '@fontsource/playfair-display/700.css';
import '@fontsource/jetbrains-mono/500.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { clamp01, ease, lerp, param, readiness, token, useDesign, useFrame, useParams, useTime } from '@vanilla/runtime';
import contentJson from '../../storyboard/data/content.json';
import { Backdrop, Dashed, Defs, Grain, Handwrite, Ink, Pal, Spark, circ, prog, seg, textWidth, useFitScale, usePal, type Palette } from './chalk';
import { useSting } from './sting';
import { DOT, DURATION, EXIT, KICKER_RATE, KICKER_START, LABEL, NUMBER, RAIL, RAIL_SPARK } from './timing';

interface Chapter {
  id: string;
  no: string;
  label: string;
}
const content = contentJson as unknown as { chapters: Chapter[]; bumper: { kicker: string } };
const CHAPTERS = content.chapters;
const KICKER = content.bumper.kicker;

const SERIF = '"Playfair Display", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SANS = '"Pretendard Variable", Pretendard, sans-serif';
readiness.loadFonts(
  ['700 270px "Playfair Display"', '500 36px "JetBrains Mono"', '800 100px "Pretendard Variable"', '600 22px "Pretendard Variable"'],
  [KICKER, ...CHAPTERS.flatMap((c) => [c.no, c.label])].join(' '),
);

export const bumperParams = {
  chalk: param.color(token('paper'), { label: 'Chalk color' }),
  accent: param.color(token('primary'), { label: 'Accent color' }),
  music: param.boolean(true, { label: 'Sting sound' }),
  volume: param.number(0.8, { min: 0, max: 1, step: 0.05, label: 'Sound volume' }),
};

const RING = { x: 600, y: 470, r: 230 } as const;
const TEXT_X = 950;
const RAIL_Y = 830;
const RAIL_STEP = 260;

function Ring({ t, no }: { t: number; no: string }) {
  const pal = usePal();
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
    const r1 = RING.r + 18;
    const r2 = RING.r + (i % 3 === 0 ? 40 : 28);
    return seg(RING.x + Math.cos(a) * r1, RING.y + Math.sin(a) * r1, RING.x + Math.cos(a) * r2, RING.y + Math.sin(a) * r2);
  }).join('');
  return (
    <g>
      <g transform={`rotate(-90 ${RING.x} ${RING.y})`}>
        <Ink d={circ(RING.x, RING.y, RING.r)} p={prog(t, 0.05, 0.75)} w={4} />
      </g>
      <Ink d={circ(RING.x, RING.y, RING.r - 16)} p={prog(t, 0.2, 0.85)} w={1.5} opacity={0.4} sketch={false} />
      <Ink d={ticks} p={prog(t, 0.3, 0.95)} w={1.6} opacity={0.5} sketch={false} />
      <Handwrite text={no} x={RING.x} y={RING.y + 95} size={270} font={SERIF} weight={700} u={t} a={NUMBER.a} b={NUMBER.b} />
      <Spark x={RING.x} y={RING.y - RING.r} u={t} />
    </g>
  );
}

function Title({ t, label }: { t: number; label: string }) {
  const pal = usePal();
  const typed = KICKER.slice(0, Math.max(0, Math.floor((t - KICKER_START) * KICKER_RATE)));
  const typing = typed.length > 0 && typed.length < KICKER.length;
  const caretX = TEXT_X + textWidth(typed, `500 36px ${MONO}`) + 6;
  const size = 100;
  const y = 548;
  const w = textWidth(label, `800 ${size}px ${SANS}`);
  return (
    <g>
      <Dashed x1={RING.x + RING.r + 44} y1={RING.y} x2={TEXT_X - 40} y2={RING.y} p={prog(t, 0.55, 0.9)} color={pal.accent} />
      <Ink d={seg(TEXT_X - 40, 360, TEXT_X - 40, 580)} p={prog(t, 0.6, 1.0)} w={6} color={pal.accent} sketch={false} />
      {typed && (
        <text x={TEXT_X} y={405} fontFamily={MONO} fontWeight={500} fontSize={36} letterSpacing={6} style={{ fill: pal.accent }}>
          {typed}
        </text>
      )}
      {typing && <rect x={caretX} y={375} width={18} height={36} style={{ fill: pal.accent }} opacity={0.85} />}
      <Handwrite text={label} x={TEXT_X} y={y} size={size} font={SANS} weight={800} u={t} a={LABEL.a} b={LABEL.b} anchor="start" />
      <circle cx={TEXT_X + w + 26} cy={y - 10} r={12 * ease.backOut(clamp01((t - DOT) / 0.25))} style={{ fill: pal.accent }} />
      <Spark x={TEXT_X + w + 26} y={y - 10} u={t - DOT} r={12} />
      <Dashed x1={TEXT_X} y1={y + 52} x2={TEXT_X + w} y2={y + 52} p={prog(t, LABEL.b - 0.3, LABEL.b + 0.3)} opacity={0.3} w={1.5} />
    </g>
  );
}

function Rail({ t, current }: { t: number; current: number }) {
  const pal = usePal();
  const x0 = 960 - ((CHAPTERS.length - 1) * RAIL_STEP) / 2;
  const xs = CHAPTERS.map((_, i) => x0 + i * RAIL_STEP);
  return (
    <g>
      {xs.slice(1).map((x, i) => (
        <Ink key={i} d={seg(xs[i] + 34, RAIL_Y, x - 34, RAIL_Y)} p={prog(t, RAIL.a + i * 0.1, RAIL.a + 0.3 + i * 0.1)} w={2} opacity={i < current ? 0.7 : 0.3} sketch={false} />
      ))}
      {CHAPTERS.map((c, i) => {
        const x = xs[i];
        const at = RAIL.a + i * 0.1;
        const now = i === current;
        const past = i < current;
        const o = now ? 1 : past ? 0.75 : 0.35;
        return (
          <g key={c.id} opacity={o}>
            <Ink d={circ(x, RAIL_Y, 30)} p={prog(t, at, at + 0.35)} w={now ? 4 : 2.5} color={now ? pal.accent : undefined} />
            {past ? (
              <Ink d={`M${x - 13} ${RAIL_Y + 1}L${x - 4} ${RAIL_Y + 11}L${x + 15} ${RAIL_Y - 12}`} p={prog(t, at + 0.2, at + 0.4, ease.quadOut)} w={4} sketch={false} />
            ) : (
              <text x={x} y={RAIL_Y + 9} textAnchor="middle" fontFamily={MONO} fontWeight={500} fontSize={24} style={{ fill: now ? pal.accent : pal.chalk }} opacity={prog(t, at + 0.15, at + 0.4)}>
                {c.no}
              </text>
            )}
            <text x={x} y={RAIL_Y + 76} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={22} style={{ fill: now ? pal.accent : pal.chalk }} opacity={prog(t, at + 0.25, at + 0.55)}>
              {c.label}
            </text>
          </g>
        );
      })}
      {current >= 0 && <Spark x={xs[current]} y={RAIL_Y - 30} u={t - RAIL_SPARK} r={7} />}
    </g>
  );
}

export function BumperView({ chapterId }: { chapterId: string }) {
  const t = useTime();
  const { width, height } = useFrame();
  const { chalk, accent, music, volume } = useParams<typeof bumperParams>();
  const design = useDesign();
  const scale = useFitScale(width, height);
  const current = CHAPTERS.findIndex((c) => c.id === chapterId);
  const chapter = CHAPTERS[current] ?? { id: chapterId, no: '', label: '' };
  useSting(current, KICKER.length, music, volume);
  const pal: Palette = { chalk, accent, faint: 'var(--color-ink-faint)', bg: 'var(--color-canvas-deep)' };

  // Slow push-in, then a zoom-through dive into the ring.
  const push = 1 + 0.04 * ease.sineInOut(clamp01(t / EXIT));
  const k = ease.cubicIn(clamp01((t - EXIT) / (DURATION - 0.05 - EXIT)));
  const dive = lerp(1, 3.2, k);
  return (
    <Pal.Provider value={pal}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: pal.bg }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width, height, overflow: 'hidden', transform: `translate(-50%, -50%) scale(${scale})` }}>
          <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ display: 'block' }} aria-label={`${KICKER} ${chapter.no} ${chapter.label}`}>
            <Defs />
            <Backdrop t={t} />
            <g opacity={1 - k} transform={`translate(${RING.x} ${RING.y}) scale(${dive}) translate(${-RING.x} ${-RING.y})`}>
              <g transform={`translate(960 540) scale(${push}) translate(-960 -540)`}>
                <Ring t={t} no={chapter.no} />
                <Title t={t} label={chapter.label} />
                <Rail t={t} current={current} />
              </g>
            </g>
          </svg>
          <Grain bg={design.colors['canvas-deep'] ?? ''} chalk={chalk} />
        </div>
      </div>
    </Pal.Provider>
  );
}

export { DURATION as BUMPER_DURATION };
