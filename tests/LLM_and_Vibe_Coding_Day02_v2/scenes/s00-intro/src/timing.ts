// Shared timing for picture and soundtrack, so every hit in the music lands on the frame it belongs to.
// 96 BPM: one bar = 2.5 s = one shot.

export const DURATION = 15;
export const BEAT = 0.625;
export const BAR = 2.5;

/** Shot boundaries (seconds): prompt, code, blueprint, gears, tests, title. */
export const SHOT = [0, 2.5, 5, 7.5, 10, 12.5, 15] as const;

export const CODE = ['function game() {', '  let score = 0', '  while (playing) {', '    move(player)', '    score += 1', '  }', '}'] as const;
export const KEYWORDS = new Set(['function', 'let', 'while']);
/** Typing in the code shot, local to SHOT[1]. */
export const TYPE_START = 0.15;
export const TYPE_RATE = 58; // chars per second
export const TYPE_TOTAL = CODE.reduce((n, l) => n + l.length, 0);

/** Gear train in the gears shot: angle (deg) of the driving gear at global time t. */
export const GEAR_START = SHOT[3] + 0.6;
const GEAR_W = 80;
const GEAR_RAMP = 0.5;
export function gearAngle(t: number): number {
  const s = t - GEAR_START;
  if (s <= 0) return 0;
  return s < GEAR_RAMP ? (GEAR_W * s * s) / (2 * GEAR_RAMP) : GEAR_W * (s - GEAR_RAMP / 2);
}
export const GEAR_TEETH = [24, 16, 12] as const;

/** Test shot, local to SHOT[4]. Row 3 fails first, is erased and then passes. */
export const CHECKS = { pass: [0.55, 0.8, 1.6, 1.85], fail: 1.0, erase: 1.3, done: 2.05 } as const;

/** Prompt shot: the send button press, local to SHOT[0]. */
export const SEND_PRESS = 2.15;
