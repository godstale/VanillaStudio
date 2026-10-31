// The eight shape motifs of the reel, one per idea in the lecture: a bouncing signal, a morphing form,
// a split cube, a halftone ring, striped ribbons, a toggle under a cursor, a sun and an orbit.
// Each draws around (0, 0) in a ~600 px box from its own local time `u` (seconds); place it with <Place>.
import type { ReactNode } from 'react';
import { clamp01, ease, lerp, mulberry32 } from '@vanilla/runtime';
import { Blur, C, MONO, prog } from './kit';

export type Motif = 'ball' | 'morph' | 'cube' | 'halftone' | 'ribbon' | 'toggle' | 'sun' | 'orbit';

export function Place({ x, y, s = 1, children }: { x: number; y: number; s?: number; children: ReactNode }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{children}</g>;
}

const TAU = Math.PI * 2;

// ---- ball: a signal drops onto a line and bounces, leaving a dotted trail ------------------------

/** Height above the floor (px) and squash at local time u: a drop, then bounces losing 45 % each. */
function bounce(u: number): { h: number; squash: number; x: number } {
  const g = 5200;
  const h0 = 520;
  let t = u;
  let v = Math.sqrt(2 * g * h0);
  let tFall = v / g;
  const x = -220 + 110 * u;
  if (t < tFall) return { h: h0 - 0.5 * g * t * t, squash: 0, x };
  t -= tFall;
  for (let i = 0; i < 6; i++) {
    v *= 0.62;
    const air = (2 * v) / g;
    if (t < air) return { h: v * t - 0.5 * g * t * t, squash: t < 0.06 ? 1 - t / 0.06 : 0, x };
    t -= air;
  }
  return { h: 0, squash: 0, x };
}

export function Ball({ u, color = C.red, line = C.cream }: { u: number; color?: string; line?: string }) {
  const floor = 250;
  const lineP = prog(u, 0, 0.35, ease.expoOut);
  const trail = Array.from({ length: 22 }, (_, i) => u - (i + 1) * 0.03).filter((v) => v > 0);
  const now = bounce(Math.max(0, u - 0.1));
  const sq = now.squash * 0.35;
  return (
    <g>
      <line x1={-460 * lineP} y1={floor} x2={460 * lineP} y2={floor} style={{ stroke: line }} strokeWidth={3} />
      {trail.map((v, i) => {
        const b = bounce(Math.max(0, v - 0.1));
        return <circle key={i} cx={b.x} cy={floor - 34 - b.h} r={3} style={{ fill: line }} opacity={0.7 * (1 - i / 22)} />;
      })}
      {u > 0.1 && (
        <Blur y={Math.min(14, Math.abs(bounce(u - 0.1).h - bounce(u - 0.1 - 1 / 60).h) * 0.25)}>
          <ellipse cx={now.x} cy={floor - 34 * (1 - sq) - now.h} rx={34 * (1 + sq)} ry={34 * (1 - sq)} style={{ fill: color }} />
        </Blur>
      )}
    </g>
  );
}

// ---- morph: square → cross → hexagon, with offset ghosts and a bounding box ----------------------

/** Exit distance of a ray (c, s) from the centre of an axis-aligned rectangle with half sizes hx, hy. */
const rectExit = (c: number, s: number, hx: number, hy: number) => Math.min(hx / Math.max(1e-6, Math.abs(c)), hy / Math.max(1e-6, Math.abs(s)));
const SHAPES: ((a: number) => number)[] = [
  (a) => rectExit(Math.cos(a), Math.sin(a), 180, 180),
  (a) => Math.max(rectExit(Math.cos(a), Math.sin(a), 230, 80), rectExit(Math.cos(a), Math.sin(a), 80, 230)),
  (a) => (230 * Math.cos(Math.PI / 6)) / Math.cos(((((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6)),
];

function morphPath(k: number, rot: number): string {
  const i = Math.min(SHAPES.length - 2, Math.floor(k));
  const f = ease.backInOut(clamp01(k - i));
  const n = 96;
  let d = '';
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU;
    const r = lerp(SHAPES[i](a), SHAPES[i + 1](a), f);
    d += `${j ? 'L' : 'M'}${(Math.cos(a + rot) * r).toFixed(1)} ${(Math.sin(a + rot) * r).toFixed(1)}`;
  }
  return d + 'Z';
}

export function Morph({ u, ink = C.black }: { u: number; ink?: string }) {
  const at = (v: number) => clamp01((v - 0.2) / 0.55) + clamp01((v - 0.85) / 0.55);
  const rot = (v: number) => ease.cubicInOut(clamp01((v - 0.1) / 1.4)) * (Math.PI / 2);
  const box = prog(u, 0, 0.4, ease.expoOut);
  const k = at(u);
  const labels = ['RECT / 4', 'CROSS / 12', 'POLYGON / 6'];
  return (
    <g>
      <g opacity={box}>
        <rect x={-260} y={-260} width={520} height={520} fill="none" style={{ stroke: ink }} strokeWidth={1.5} opacity={0.45} />
        {[-260, 260].flatMap((x) => [-260, 260].map((y) => <rect key={`${x}${y}`} x={x - 6} y={y - 6} width={12} height={12} style={{ fill: C.cream, stroke: ink }} strokeWidth={1.5} />))}
        <text x={-256} y={-276} fontFamily={MONO} fontSize={16} letterSpacing={2} style={{ fill: ink }}>
          {labels[Math.min(2, Math.round(k))]}
        </text>
        <text x={256} y={292} textAnchor="end" fontFamily={MONO} fontSize={16} letterSpacing={2} style={{ fill: ink }}>
          {`W 520  H 520  R ${Math.round((rot(u) * 180) / Math.PI)}°`}
        </text>
      </g>
      <g transform="translate(26 22)">
        <path d={morphPath(at(u - 0.1), rot(u - 0.1))} style={{ fill: C.yellow }} />
      </g>
      <g transform="translate(18 -14)">
        <path d={morphPath(at(u - 0.05), rot(u - 0.05))} style={{ fill: C.blue }} />
      </g>
      <Blur x={Math.abs(rot(u) - rot(u - 1 / 60)) * 600}>
        <path d={morphPath(k, rot(u))} transform={`scale(${box})`} style={{ fill: C.red }} />
      </Blur>
    </g>
  );
}

// ---- cube: a 2×2×2 cube turns, then its cubelets pull apart ------------------------------------

type V3 = [number, number, number];
const FACES: { n: V3; color: string }[] = [
  { n: [0, -1, 0], color: C.cream },
  { n: [0, 1, 0], color: C.yellow },
  { n: [0, 0, -1], color: C.red },
  { n: [0, 0, 1], color: C.cream },
  { n: [1, 0, 0], color: C.pink },
  { n: [-1, 0, 0], color: C.red },
];

function rotate([x, y, z]: V3, ay: number, ax: number): V3 {
  const x1 = x * Math.cos(ay) + z * Math.sin(ay);
  const z1 = -x * Math.sin(ay) + z * Math.cos(ay);
  const y2 = y * Math.cos(ax) - z1 * Math.sin(ax);
  const z2 = y * Math.sin(ax) + z1 * Math.cos(ax);
  return [x1, y2, z2];
}

export function Cube({ u, split = 0.9, scatter = 1.5 }: { u: number; split?: number; scatter?: number }) {
  const ay = 0.6 + u * 1.6 + ease.cubicInOut(clamp01((u - split) / 0.6)) * 1.2;
  const ax = -0.5 + 0.15 * Math.sin(u * 1.3);
  const gap = 4 + 60 * ease.backOut(clamp01((u - split) / 0.45)) + 380 * ease.cubicIn(clamp01((u - scatter) / 0.5));
  const size = 120 * prog(u, 0, 0.3, ease.backOut);
  const D = 1600;
  const polys: { z: number; pts: string; color: string }[] = [];
  const rand = mulberry32(8);
  for (const cx of [-1, 1])
    for (const cy of [-1, 1])
      for (const cz of [-1, 1]) {
        const spin = (rand() - 0.5) * 2 * ease.cubicIn(clamp01((u - scatter) / 0.5));
        const c: V3 = [cx * (size / 2 + gap / 2), cy * (size / 2 + gap / 2), cz * (size / 2 + gap / 2)];
        for (const f of FACES) {
          const inner = f.n[0] === -cx || f.n[1] === -cy || f.n[2] === -cz;
          const h = size / 2;
          const [a, b] = f.n[0] ? [1, 2] : f.n[1] ? [0, 2] : [0, 1];
          const corners: V3[] = [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([p, q]) => {
            const v: V3 = [f.n[0] * h, f.n[1] * h, f.n[2] * h];
            v[a] = p * h;
            v[b] = q * h;
            const local = rotate(v, spin, spin * 0.6);
            return rotate([c[0] + local[0], c[1] + local[1], c[2] + local[2]], ay, ax);
          });
          const normal = rotate(rotate(f.n, spin, spin * 0.6), ay, ax);
          const centre = corners.reduce<V3>((m, p) => [m[0] + p[0] / 4, m[1] + p[1] / 4, m[2] + p[2] / 4], [0, 0, 0]);
          // Back-face cull against the view ray from a camera at z = -D.
          if (normal[0] * centre[0] + normal[1] * centre[1] + normal[2] * (centre[2] + D) >= 0) continue;
          const pts = corners.map(([x, y, z]) => `${((x * D) / (z + D)).toFixed(1)},${((y * D) / (z + D)).toFixed(1)}`).join(' ');
          polys.push({ z: centre[2], pts, color: inner ? C.black : f.color });
        }
      }
  polys.sort((p, q) => q.z - p.z);
  const blur = Math.min(18, Math.abs(ease.cubicIn(clamp01((u - scatter) / 0.5)) - ease.cubicIn(clamp01((u - scatter - 1 / 60) / 0.5))) * 900);
  return (
    <Blur x={blur} y={blur * 0.6}>
      {polys.map((p, i) => (
        <polygon key={i} points={p.pts} style={{ fill: p.color, stroke: C.black }} strokeWidth={2} strokeLinejoin="round" />
      ))}
    </Blur>
  );
}

// ---- halftone: a ring of dots breathes and turns; a few accent dots light up -------------------

export function Halftone({ u, ink = C.cream, accent = C.red, w = 1000, h = 640 }: { u: number; ink?: string; accent?: string; w?: number; h?: number }) {
  const step = 30;
  const R = 200 + 24 * Math.sin(u * 4);
  const rot = u * 2.2;
  const grow = prog(u, 0, 0.45, ease.expoOut);
  const lit = prog(u, 0.6, 1.1, ease.linear);
  const dots: ReactNode[] = [];
  for (let gy = -Math.floor(h / 2 / step); gy <= Math.floor(h / 2 / step); gy++)
    for (let gx = -Math.floor(w / 2 / step); gx <= Math.floor(w / 2 / step); gx++) {
      const x = gx * step;
      const y = gy * step;
      const d = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      const ring = Math.exp(-(((d - R) / 95) ** 2)) * (0.45 + 0.55 * (0.5 + 0.5 * Math.cos(a - rot)));
      const r = 1.6 + 11.5 * ring * grow;
      const hash = Math.abs(Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453) % 1;
      const hot = hash < 0.08 * lit && ring < 0.2;
      dots.push(<circle key={`${gx},${gy}`} cx={x} cy={y} r={hot ? 4 : r} style={{ fill: hot ? accent : ink }} opacity={ring > 0.05 || hot ? 1 : 0.35} />);
    }
  return <g>{dots}</g>;
}

// ---- ribbon: striped tubes snake across the frame ----------------------------------------------

function ribbonPath(k: number): string {
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const s = i / 120;
    const x = lerp(-1150, 1150, s) + 220 * Math.sin(s * TAU * 1.5 + k) * Math.exp(-(((s - 0.45) / 0.18) ** 2));
    const y = 170 * Math.sin(s * TAU * 0.9 + k * 2) - 260 * Math.exp(-(((s - 0.45) / 0.12) ** 2)) * Math.cos(s * TAU * 3);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

function Tube({ d, head, tail, stripes }: { d: string; head: number; tail: number; stripes: [string, number][] }) {
  if (head <= tail) return null;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {stripes.map(([color, w], i) => (
        <path key={i} d={d} pathLength={1} strokeDasharray={`${head - tail} 3`} strokeDashoffset={-tail} style={{ stroke: color }} strokeWidth={w} />
      ))}
    </g>
  );
}

/** `settle`: the ribbons stop with their heads at the end of the path instead of running off. */
export function Ribbon({ u, settle = false }: { u: number; settle?: boolean }) {
  const lead = (v: number) => (settle ? ease.expoOut(clamp01(v / 1.3)) : ease.cubicInOut(clamp01(v / 1.15)) * 1.5);
  const a = lead(u);
  const b = lead(u - 0.18);
  const blur = Math.min(10, (lead(u) - lead(u - 1 / 60)) * 400);
  return (
    <Blur x={blur}>
      <g transform="translate(0 40)">
        <Tube d={ribbonPath(0.4)} head={a} tail={a - 0.75} stripes={[[C.red, 110], [C.pink, 72], [C.cream, 30]]} />
      </g>
      <g transform="translate(0 -60) rotate(8)">
        <Tube d={ribbonPath(2.1)} head={b} tail={b - 0.7} stripes={[[C.yellow, 110], [C.black, 82], [C.yellow, 60], [C.blue, 40], [C.cream, 14]]} />
      </g>
    </Blur>
  );
}

// ---- toggle: a cursor flies in, clicks, the switch turns on ------------------------------------

export function Toggle({ u, ink = C.black, on = C.red, click = 0.8 }: { u: number; ink?: string; on?: string; click?: number }) {
  const appear = prog(u, 0, 0.3, ease.backOut);
  const flip = prog(u, click, click + 0.28, ease.backOut);
  const fly = prog(u, 0.15, click, ease.expoOut);
  const press = u > click - 0.05 && u < click + 0.1 ? 0.82 : 1;
  const cx = lerp(420, -110, fly);
  const cy = lerp(380, 20, fly);
  const ring = clamp01((u - click) / 0.4);
  const knob = lerp(-110, 110, flip);
  return (
    <g>
      <g transform={`scale(${appear})`}>
        <rect x={-230} y={-120} width={460} height={240} rx={120} style={{ fill: flip > 0.5 ? on : 'none', stroke: flip > 0.5 ? on : ink }} strokeWidth={22} />
        <Blur x={(flip - prog(u - 1 / 60, click, click + 0.28, ease.backOut)) * 600}>
          <circle cx={knob} cy={0} r={86} style={{ fill: flip > 0.5 ? C.cream : 'none', stroke: flip > 0.5 ? C.cream : ink }} strokeWidth={22} />
        </Blur>
      </g>
      {ring > 0 && ring < 1 && <circle cx={-110} cy={0} r={90 + 160 * ease.expoOut(ring)} fill="none" style={{ stroke: on }} strokeWidth={4} opacity={1 - ring} />}
      <Blur x={(lerp(420, -110, fly) - lerp(420, -110, prog(u - 1 / 60, 0.15, click, ease.expoOut))) * -0.4}>
        <path
          d="M0 0L0 92L24 70L42 110L60 102L42 63L74 63Z"
          transform={`translate(${cx} ${cy}) scale(${press})`}
          style={{ fill: ink, stroke: C.cream }}
          strokeWidth={4}
          strokeLinejoin="round"
          opacity={prog(u, 0.15, 0.3)}
        />
      </Blur>
    </g>
  );
}

// ---- sun: black rays spin out of a red core ----------------------------------------------------

export function Sun({ u, ink = C.black }: { u: number; ink?: string }) {
  const grow = prog(u, 0, 0.45, ease.backOut);
  const spin = u * 1.4 + ease.expoOut(clamp01(u / 0.6)) * 1.2;
  const rays = (rot: number) => {
    let d = '';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU + rot;
      const len = 210 + (i % 3 === 0 ? 110 : i % 2 ? 40 : 70);
      const half = 0.06;
      d += `M${Math.cos(a - half) * 110} ${Math.sin(a - half) * 110}L${Math.cos(a) * len} ${Math.sin(a) * len}L${Math.cos(a + half) * 110} ${Math.sin(a + half) * 110}Z`;
    }
    return d;
  };
  return (
    <g transform={`scale(${grow})`}>
      <path d={rays(spin - 0.05)} style={{ fill: ink }} opacity={0.25} />
      <path d={rays(spin)} style={{ fill: ink }} />
      <circle r={120} style={{ fill: C.yellow }} />
      <circle r={96} style={{ fill: C.red }} />
    </g>
  );
}

// ---- orbit: a planet with two tilted orbits and two fast moons --------------------------------

export function Orbit({ u, ink = C.cream }: { u: number; ink?: string }) {
  const grow = prog(u, 0, 0.4, ease.expoOut);
  const moon = (rx: number, ry: number, w: number, color: string, phase: number) => {
    const a = phase + u * w;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    const vx = Math.abs(Math.sin(a) * rx * w) / 60;
    return (
      <Blur x={Math.min(16, vx * 0.6)}>
        <circle cx={x} cy={y} r={20} style={{ fill: color }} />
      </Blur>
    );
  };
  return (
    <g transform="rotate(-14)">
      <g opacity={grow}>
        <ellipse rx={420 * grow} ry={150 * grow} fill="none" style={{ stroke: ink }} strokeWidth={2.5} />
        <ellipse rx={290 * grow} ry={100 * grow} fill="none" style={{ stroke: ink }} strokeWidth={2.5} />
      </g>
      <circle r={88 * prog(u, 0.05, 0.45, ease.backOut)} style={{ fill: ink }} />
      {u > 0.2 && moon(420, 150, 3.2, C.pink, 2.6)}
      {u > 0.25 && moon(290, 100, -4.4, C.yellow, 0.4)}
    </g>
  );
}

export function MotifView({ motif, u, ink, accent }: { motif: Motif; u: number; ink: string; accent: string }) {
  switch (motif) {
    case 'ball':
      return <Ball u={u} color={accent} line={ink} />;
    case 'morph':
      return <Morph u={u} ink={ink} />;
    case 'cube':
      return <Cube u={u} split={1.2} scatter={99} />;
    case 'halftone':
      return <Halftone u={u} ink={ink} accent={accent} w={760} h={560} />;
    case 'ribbon':
      return <Ribbon u={u} settle />;
    case 'toggle':
      return <Toggle u={u} ink={ink} on={accent} />;
    case 'sun':
      return <Sun u={u} ink={ink} />;
    case 'orbit':
      return <Orbit u={u} ink={ink} />;
  }
}
