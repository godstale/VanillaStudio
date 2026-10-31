// Easing functions and small numeric helpers. All map [0,1] -> [0,1] and clamp outside that range.
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Map `x` from [inMin, inMax] to [outMin, outMax] without clamping. */
export const remap = (x: number, inMin: number, inMax: number, outMin: number, outMax: number): number =>
  inMax === inMin ? outMin : outMin + ((x - inMin) / (inMax - inMin)) * (outMax - outMin);
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

type Fn = (x: number) => number;

const C1 = 1.70158;
const C2 = C1 * 1.525;
const C3 = C1 + 1;
const C4 = (2 * Math.PI) / 3;
const C5 = (2 * Math.PI) / 4.5;

const bounceOut: Fn = (x) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

const power = (n: number) => ({
  in: ((x) => x ** n) as Fn,
  out: ((x) => 1 - (1 - x) ** n) as Fn,
  inOut: ((x) => (x < 0.5 ? 2 ** (n - 1) * x ** n : 1 - (-2 * x + 2) ** n / 2)) as Fn,
});
const quad = power(2);
const cubic = power(3);
const quart = power(4);
const quint = power(5);

const raw = {
  linear: ((x) => x) as Fn,
  quadIn: quad.in,
  quadOut: quad.out,
  quadInOut: quad.inOut,
  cubicIn: cubic.in,
  cubicOut: cubic.out,
  cubicInOut: cubic.inOut,
  quartIn: quart.in,
  quartOut: quart.out,
  quartInOut: quart.inOut,
  quintIn: quint.in,
  quintOut: quint.out,
  quintInOut: quint.inOut,
  sineIn: ((x) => 1 - Math.cos((x * Math.PI) / 2)) as Fn,
  sineOut: ((x) => Math.sin((x * Math.PI) / 2)) as Fn,
  sineInOut: ((x) => -(Math.cos(Math.PI * x) - 1) / 2) as Fn,
  expoIn: ((x) => 2 ** (10 * x - 10)) as Fn,
  expoOut: ((x) => 1 - 2 ** (-10 * x)) as Fn,
  expoInOut: ((x) => (x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2)) as Fn,
  circIn: ((x) => 1 - Math.sqrt(1 - x * x)) as Fn,
  circOut: ((x) => Math.sqrt(1 - (x - 1) ** 2)) as Fn,
  circInOut: ((x) => (x < 0.5 ? (1 - Math.sqrt(1 - (2 * x) ** 2)) / 2 : (Math.sqrt(1 - (-2 * x + 2) ** 2) + 1) / 2)) as Fn,
  backIn: ((x) => C3 * x ** 3 - C1 * x * x) as Fn,
  backOut: ((x) => 1 + C3 * (x - 1) ** 3 + C1 * (x - 1) ** 2) as Fn,
  backInOut: ((x) => (x < 0.5 ? ((2 * x) ** 2 * ((C2 + 1) * 2 * x - C2)) / 2 : ((2 * x - 2) ** 2 * ((C2 + 1) * (x * 2 - 2) + C2) + 2) / 2)) as Fn,
  elasticIn: ((x) => -(2 ** (10 * x - 10)) * Math.sin((x * 10 - 10.75) * C4)) as Fn,
  elasticOut: ((x) => 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * C4) + 1) as Fn,
  elasticInOut: ((x) =>
    x < 0.5 ? -(2 ** (20 * x - 10) * Math.sin((20 * x - 11.125) * C5)) / 2 : (2 ** (-20 * x + 10) * Math.sin((20 * x - 11.125) * C5)) / 2 + 1) as Fn,
  bounceIn: ((x) => 1 - bounceOut(1 - x)) as Fn,
  bounceOut,
  bounceInOut: ((x) => (x < 0.5 ? (1 - bounceOut(1 - 2 * x)) / 2 : (1 + bounceOut(2 * x - 1)) / 2)) as Fn,
};

export type EaseName = keyof typeof raw;

const guard = (f: Fn): Fn => (x) => (x <= 0 ? 0 : x >= 1 ? 1 : f(x));

export const ease = Object.fromEntries(Object.entries(raw).map(([k, f]) => [k, guard(f)])) as Record<EaseName, Fn>;
