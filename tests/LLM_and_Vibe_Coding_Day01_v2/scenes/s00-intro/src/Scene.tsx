// Intro: a 15 s Swiss-style motion reel for the Day 1 lecture. Nine hard cuts on a 120 BPM grid, one
// idea of the lecture per shot — a neuron's signal, "MAKE IT THINK.", a morphing form, a deep cube that
// splits, a halftone attention ring, token ribbons, a prompt toggle, scale (sun → orbit) — landing on the
// title card where the first shot's red ball drops in as the full stop.
import { clamp01, defineScene, ease, param, useParams, useTime } from '@vanilla/runtime';
import { introInfo } from '../../../shared/deck/content';
import { Blur, C, H, HEAVY, Hud, MONO, ON, SANS, SERIF, Stage, W, fitSize, loadReelFonts, prog, slide, textWidth, timecode, useSvgId } from '../../../shared/reel/kit';
import { Ball, Cube, Halftone, Morph, Orbit, Place, Ribbon, Sun, Toggle } from '../../../shared/reel/motifs';
import { useSoundtrack } from './soundtrack';
import { CLICK, CUBE, DURATION, FIELD, MAKE_DOT, ORBIT_CUT, SHOT, TITLE, WORDS } from './timing';

loadReelFonts([introInfo.hud, ...introInfo.shots, ...introInfo.make, ...introInfo.title, introInfo.serif, ...introInfo.footer].join(' '));

const params = {
  sound: param.boolean(true, { label: 'Soundtrack' }),
  volume: param.number(0.8, { min: 0, max: 1, step: 0.05, label: 'Volume' }),
};

// ---- shot 2: MAKE / IT / THINK. ---------------------------------------------------------------

function MakeItThink({ u }: { u: number }) {
  const [make, it, think] = introInfo.make;
  const body = think.replace(/\.$/, '');
  const font = (s: number) => `400 ${s}px ${HEAVY}`;
  const size = fitSize(`${make} ${it}`, font, 330, W - 120);
  const space = textWidth(' ', font(size)) * 0.6;
  const wMake = textWidth(make, font(size));
  const wBody = textWidth(body, font(size));
  const a = slide(u, WORDS[0], 0.38, 1400);
  const b = slide(u, WORDS[1], 0.34, 900);
  const c = slide(u, WORDS[2], 0.38, -1600);
  const dot = ease.backOut(clamp01((u - MAKE_DOT) / 0.2));
  const y1 = 470;
  const y2 = y1 + size * 0.98;
  const common = { fontFamily: HEAVY, fontSize: size, letterSpacing: -size * 0.03 } as const;
  return (
    <g>
      {u >= WORDS[0] && (
        <Blur x={a.blur}>
          <text x={60 + a.x} y={y1} {...common} style={{ fill: C.black }}>
            {make}
          </text>
        </Blur>
      )}
      {u >= WORDS[1] && (
        <Blur x={b.blur}>
          <text x={60 + wMake + space + b.x} y={y1} {...common} style={{ fill: C.cream }}>
            {it}
          </text>
        </Blur>
      )}
      {u >= WORDS[2] && (
        <Blur x={c.blur}>
          <text x={60 + c.x} y={y2} {...common} style={{ fill: C.black }}>
            {body}
          </text>
        </Blur>
      )}
      <circle cx={60 + wBody + size * 0.2} cy={y2 - size * 0.12} r={size * 0.11 * dot} style={{ fill: C.cream }} />
    </g>
  );
}

// ---- shot 9: title card ------------------------------------------------------------------------

function TitleCard({ u }: { u: number }) {
  const clip = useSvgId();
  const [line1, line2] = introInfo.title;
  const heavy = (s: number) => `900 ${s}px ${SANS}`;
  const serif = (s: number) => `italic 700 ${s}px ${SERIF}`;
  // Fit the wider of the two lines; line 2 carries the serif "Day 01" and the full-stop ball.
  const w1 = textWidth(line1, heavy(100));
  const w2 = textWidth(line2, heavy(100)) + 40 + textWidth(introInfo.serif, serif(100)) * 0.95 + 70;
  const size = Math.min(330, ((W - 120) * 100) / Math.max(w1, w2, 1));
  // Centre the block (two lines + rule + footer) vertically.
  const y1 = (H - (size * 1.94 + 136)) / 2 + size * 0.86;
  const y2 = y1 + size * 1.08;
  const l1 = slide(u, TITLE.line1, 0.5, -1500);
  const l2 = slide(u, TITLE.line2, 0.5, 1500);
  const serifX = 60 + textWidth(line2, heavy(size)) + 40;
  const serifW = textWidth(introInfo.serif, serif(size * 0.95));
  const reveal = prog(u, TITLE.serif, TITLE.serif + 0.4, ease.cubicOut);
  // The ball falls into place as the full stop and squashes once on landing.
  const fall = clamp01((u - TITLE.drop) / (TITLE.land - TITLE.drop));
  const r = size * 0.11;
  const dotX = serifX + serifW + r * 1.6;
  const dotY = y2 - r;
  const ballY = dotY - (1 - fall * fall) * 900;
  const sq = u >= TITLE.land && u < TITLE.land + 0.12 ? 0.3 * (1 - (u - TITLE.land) / 0.12) : 0;
  const ruleY = y2 + 90;
  const foot = (s: string, d: number) => s.slice(0, Math.max(0, Math.floor((u - TITLE.footer - d) * 70)));
  const footStyle = { fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: 1.5, style: { fill: C.black } } as const;
  return (
    <g>
      <Blur x={l1.blur}>
        <text x={60 + l1.x} y={y1} fontFamily={SANS} fontWeight={900} fontSize={size} letterSpacing={-size * 0.03} style={{ fill: C.black }}>
          {line1}
        </text>
      </Blur>
      <Blur x={l2.blur}>
        <text x={60 + l2.x} y={y2} fontFamily={SANS} fontWeight={900} fontSize={size} letterSpacing={-size * 0.03} style={{ fill: C.black }}>
          {line2}
        </text>
      </Blur>
      <defs>
        <clipPath id={clip}>
          <rect x={serifX - 30} y={y2 - size * 1.1} width={(serifW + 80) * reveal} height={size * 1.4} />
        </clipPath>
      </defs>
      <text x={serifX} y={y2} clipPath={`url(#${clip})`} fontFamily={SERIF} fontStyle="italic" fontWeight={700} fontSize={size * 0.95} style={{ fill: C.red }}>
        {introInfo.serif}
      </text>
      {u >= TITLE.drop && (
        <Blur y={fall < 1 ? Math.min(20, fall * 24) : 0}>
          <ellipse cx={dotX} cy={ballY + r * sq} rx={r * (1 + sq)} ry={r * (1 - sq)} style={{ fill: C.red }} />
        </Blur>
      )}
      <line x1={60} y1={ruleY} x2={60 + (W - 120) * prog(u, TITLE.rule, TITLE.rule + 0.5, ease.expoOut)} y2={ruleY} style={{ stroke: C.black }} strokeWidth={2.5} />
      <text x={60} y={ruleY + 46} {...footStyle}>
        {foot(introInfo.footer[0], 0)}
      </text>
      <text x={W / 2} y={ruleY + 46} textAnchor="middle" {...footStyle} fontFamily={MONO} fontWeight={500}>
        {foot(introInfo.footer[1], 0.08)}
      </text>
      <text x={W - 60} y={ruleY + 46} textAnchor="end" {...footStyle} fontFamily={MONO} fontWeight={500}>
        {foot(introInfo.footer[2], 0.16)}
      </text>
    </g>
  );
}

// ---- the reel ----------------------------------------------------------------------------------

function Intro() {
  const t = useTime();
  const { sound, volume } = useParams<typeof params>();
  useSoundtrack(sound, volume);

  const shot = Math.max(0, SHOT.findIndex((s, i) => t >= s && t < (SHOT[i + 1] ?? Infinity)));
  const i = Math.min(shot, FIELD.length - 1);
  const u = t - SHOT[i];
  const field = i === 7 && t >= ORBIT_CUT ? 'blue' : FIELD[i];
  const { ink } = ON[field];
  const no = String(i + 1).padStart(2, '0');

  let body = null;
  switch (i) {
    case 0:
      body = (
        <Place x={W / 2} y={560}>
          <Ball u={u} color={C.red} line={C.cream} />
        </Place>
      );
      break;
    case 1:
      body = <MakeItThink u={u} />;
      break;
    case 2:
      body = (
        <Place x={W / 2} y={H / 2 + 10}>
          <Morph u={u} ink={C.black} />
        </Place>
      );
      break;
    case 3:
      body = (
        <Place x={W / 2} y={H / 2} s={1.6}>
          <Cube u={u} split={CUBE.split} scatter={CUBE.scatter} />
        </Place>
      );
      break;
    case 4:
      body = (
        <Place x={W / 2} y={H / 2}>
          <Halftone u={u} ink={C.cream} accent={C.red} w={W} h={H} />
        </Place>
      );
      break;
    case 5:
      body = (
        <Place x={W / 2} y={H / 2}>
          <Ribbon u={u} />
        </Place>
      );
      break;
    case 6:
      body = (
        <Place x={W / 2} y={H / 2}>
          <Toggle u={u} ink={C.black} on={C.red} click={CLICK} />
        </Place>
      );
      break;
    case 7:
      body =
        t < ORBIT_CUT ? (
          <Place x={W / 2} y={H / 2} s={1.15}>
            <Sun u={u} ink={C.black} />
          </Place>
        ) : (
          <Place x={W / 2} y={H / 2} s={1.25}>
            <Orbit u={t - ORBIT_CUT} ink={C.cream} />
          </Place>
        );
      break;
    default:
      body = <TitleCard u={u} />;
  }

  return (
    <Stage bg={C[field]} label={`${introInfo.title.join(' ')} ${introInfo.serif}`}>
      {body}
      <Hud u={t} at={0.05} color={ink} tl={introInfo.hud} tr="©2026" bl={`${no}  ${introInfo.shots[i]}`} br={timecode(t)} />
    </Stage>
  );
}

export default defineScene({
  id: 'scn_ee31a77d114d',
  duration: DURATION,
  params,
  Component: Intro,
});
