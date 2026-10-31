// Shared timing for the intro picture and its soundtrack, so every hit lands on its frame.
// 120 BPM (one beat = 0.5 s); every cut sits on an eighth note.
import type { Field } from '../../../shared/reel/kit';

export const DURATION = 15;

/** Shot boundaries (s): signal, type, form, depth, attention, flow, prompt, scale, title, end. */
export const SHOT = [0, 1.75, 3.5, 5.0, 6.75, 8.0, 9.25, 10.75, 12.0, 15] as const;
export const FIELD: readonly Field[] = ['black', 'red', 'cream', 'blue', 'black', 'black', 'cream', 'yellow', 'cream'];
/** The scale shot cuts from the sun (yellow) to the orbit (blue) halfway. */
export const ORBIT_CUT = 11.375;

/** Ball shot: the drop starts 0.1 s in; landing times follow the same physics as motifs.tsx. */
export const BALL_LANDINGS = [0.547, 1.091, 1.428, 1.637] as const;
/** Type shot, local to SHOT[1]: MAKE, IT, THINK slam in, then the dot. */
export const WORDS = [0, 0.32, 0.66] as const;
export const MAKE_DOT = 1.08;
/** Cube shot, local to SHOT[3]. */
export const CUBE = { split: 0.7, scatter: 1.25 } as const;
/** Prompt shot, local to SHOT[6]. */
export const CLICK = 0.75;
/** Title shot, local to SHOT[8]: lines whip in, serif reveals, the red ball drops in as the full stop. */
export const TITLE = { line1: 0, line2: 0.14, serif: 0.42, drop: 0.7, land: 1.0, rule: 1.05, footer: 1.25 } as const;
