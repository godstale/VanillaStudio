// Chapter bumper in the intro's motion-reel style: a flat color field wipes in, the chapter number
// slams in with motion blur, the chapter's shape motif plays, the Korean title rises word by word over
// an italic serif line, and everything whips off to the deck background so the next slide crossfades
// in cleanly. Every frame is a pure function of useTime(); copy comes from content.json (bumpers).
import { clamp01, ease, param, useParams, useTime } from '@vanilla/runtime';
import { bumperItem, bumperNext, bumpers, chapterOf, chapters, deckInfo } from '../deck/content';
import { Blur, C, H, HEAVY, Hud, MONO, ON, SANS, SERIF, Stage, W, fitSize, loadReelFonts, prog, slide, textWidth, timecode, useSvgId } from '../reel/kit';
import { MotifView, Place } from '../reel/motifs';
import { useSting } from './sting';
import { DOT, DURATION, EXIT, FOOTER, MOTIF_START, NUMBER, RULE, SERIF as SERIF_T, TITLE, WIPE } from './timing';

loadReelFonts([bumpers.kicker, bumpers.hud, ...chapters.flatMap((c) => [c.no, c.label]), ...bumpers.items.map((b) => b.en)].join(' '));

export const bumperParams = {
  sound: param.boolean(true, { label: 'Sting sound' }),
  volume: param.number(0.8, { min: 0, max: 1, step: 0.05, label: 'Sound volume' }),
  speed: param.number(1, { min: 0.5, max: 1.5, step: 0.05, label: 'Animation speed' }),
};

const X = 64;
const TITLE_Y = 712;
const SERIF_Y = 852;
const RULE_Y = 900;
const FOOT_Y = 944;

function Title({ u, text, ink }: { u: number; text: string; ink: string }) {
  const clip = useSvgId();
  const font = (s: number) => `900 ${s}px ${SANS}`;
  const size = fitSize(text, font, 172, W - X * 2);
  const words = text.split(' ');
  const space = textWidth(' ', font(size));
  let x = X;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={TITLE_Y - size * 1.05} width={W} height={size * 1.32} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {words.map((word, i) => {
          const at = x;
          x += textWidth(word, font(size)) + space;
          const a = TITLE.a + i * TITLE.step;
          const p = prog(u, a, a + TITLE.dur, ease.expoOut);
          const q = prog(u - 1 / 60, a, a + TITLE.dur, ease.expoOut);
          return (
            <Blur key={i} y={Math.min(30, (p - q) * size * 1.2)}>
              <text x={at} y={TITLE_Y + (1 - p) * size * 1.1} fontFamily={SANS} fontWeight={900} fontSize={size} letterSpacing={-size * 0.02} style={{ fill: ink }}>
                {word}
              </text>
            </Blur>
          );
        })}
      </g>
    </g>
  );
}

function SerifLine({ u, text, accent }: { u: number; text: string; accent: string }) {
  const clip = useSvgId();
  const size = 104;
  const body = text.replace(/\.$/, '');
  const w = textWidth(body, `italic 700 ${size}px ${SERIF}`);
  const p = prog(u, SERIF_T.a, SERIF_T.a + SERIF_T.dur, ease.cubicOut);
  const dot = ease.backOut(clamp01((u - DOT) / 0.22));
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={X - 20} y={SERIF_Y - size} width={(w + 60) * p} height={size * 1.4} />
        </clipPath>
      </defs>
      <text x={X} y={SERIF_Y} clipPath={`url(#${clip})`} fontFamily={SERIF} fontStyle="italic" fontWeight={700} fontSize={size} style={{ fill: accent }}>
        {body}
      </text>
      {text.endsWith('.') && <circle cx={X + w + 30} cy={SERIF_Y - 14} r={17 * dot} style={{ fill: accent }} />}
    </g>
  );
}

function BumperCard({ chapterId }: { chapterId: string }) {
  const { sound, volume, speed } = useParams<typeof bumperParams>();
  const raw = useTime();
  // Speed scales the build only; the exit stays pinned to the end of the scene.
  const u = raw < EXIT.a ? Math.min(raw * speed, EXIT.a) : raw;
  const item = bumperItem(chapterId);
  const index = bumpers.items.indexOf(item);
  const next = bumperNext(chapterId);
  const chapter = chapterOf(next);
  const { ink, accent } = ON[item.field];
  useSting(index, sound, volume);

  const numbered = chapters.filter((c) => /^\d+$/.test(c.no));
  const wipe = prog(u, WIPE.a, WIPE.b, ease.expoOut);
  const num = slide(u, NUMBER.a, NUMBER.dur, -1100);
  const out = slide(u, EXIT.a, EXIT.b - EXIT.a, -1, ease.cubicIn);
  const outX = -1500 * prog(u, EXIT.a, EXIT.b, ease.cubicIn);
  const outBlur = Math.min(50, out.blur * 1500);
  const cover = prog(u, EXIT.a + 0.08, EXIT.b, ease.cubicInOut);
  const nextNo = next.key.replace(/^\D+/, '');
  const footRow = (s: string, d: number) => s.slice(0, Math.max(0, Math.floor((u - FOOTER - d) * 70)));

  return (
    <Stage bg={C.deck} label={`${bumpers.kicker} ${chapter.no} ${chapter.label}`}>
      <rect x={W * (1 - wipe)} width={W} height={H} style={{ fill: C[item.field] }} />
      <g transform={`translate(${outX} 0)`}>
        <Blur x={outBlur}>
          <Place x={1390} y={340} s={item.motif === 'ribbon' ? 0.62 : 0.78}>
            {u >= MOTIF_START && <MotifView motif={item.motif} u={u - MOTIF_START} ink={ink} accent={accent} />}
          </Place>
          <Blur x={num.blur}>
            <text x={X - 14 + num.x} y={480} fontFamily={HEAVY} fontSize={400} letterSpacing={-14} style={{ fill: ink }}>
              {chapter.no}
            </text>
          </Blur>
          <Title u={u} text={chapter.label} ink={ink} />
          <SerifLine u={u} text={item.en} accent={accent} />
          <line x1={X} y1={RULE_Y} x2={X + (W - X * 2) * prog(u, RULE.a, RULE.b, ease.expoOut)} y2={RULE_Y} style={{ stroke: ink }} strokeWidth={2.5} />
          <text x={X} y={FOOT_Y} fontFamily={SANS} fontWeight={600} fontSize={22} letterSpacing={1} style={{ fill: ink }}>
            {footRow(`${bumpers.label} — ${nextNo}. ${next.title}`, 0)}
          </text>
          <g opacity={prog(u, FOOTER, FOOTER + 0.3)}>
            {numbered.map((c, i) => {
              const now = c.id === chapter.id;
              const x = W / 2 - ((numbered.length - 1) * 54) / 2 + i * 54;
              return (
                <text key={c.id} x={x} y={FOOT_Y} textAnchor="middle" fontFamily={MONO} fontWeight={500} fontSize={20} style={{ fill: now ? accent : ink }} opacity={now ? 1 : 0.5}>
                  {c.no}
                </text>
              );
            })}
          </g>
          <text x={W - X} y={FOOT_Y} textAnchor="end" fontFamily={SANS} fontWeight={600} fontSize={22} letterSpacing={1} style={{ fill: ink }}>
            {footRow(deckInfo.course, 0.1)}
          </text>
        </Blur>
      </g>
      <g opacity={wipe * (1 - cover)}>
        <Hud
          u={u}
          at={WIPE.b - 0.1}
          color={ink}
          tl={bumpers.hud}
          tr={`${bumpers.kicker} ${chapter.no} / ${String(numbered.length).padStart(2, '0')}`}
          bl={`${chapter.no}  ${item.tag}`}
          br={timecode(raw)}
        />
      </g>
      <rect x={W * (1 - cover)} width={W} height={H} style={{ fill: C.deck }} />
    </Stage>
  );
}

/** Component for one sequence slot; each bumper scene folder wraps it in its own defineScene. */
export function makeBumper(chapterId: string) {
  return function Bumper() {
    return <BumperCard chapterId={chapterId} />;
  };
}

export { DURATION as BUMPER_SECONDS };
