// Shared timing for the chapter bumper picture and its sting, so every hit lands on its frame.
// Same 96 BPM grid as the intro: 4 s = 6.4 beats.

export const DURATION = 4;
export const BEAT = 0.625;

/** Big serif chapter number writes itself inside the chalk ring and lands on HIT. */
export const NUMBER = { a: 0.15, b: 0.8 } as const;
export const HIT = BEAT * 1.5;
/** "CHAPTER" kicker types itself (mono). */
export const KICKER_START = 0.5;
export const KICKER_RATE = 18; // chars per second
/** Korean chapter label writes itself, then the amber dot pops. */
export const LABEL = { a: 0.9, b: 1.85 } as const;
export const DOT = 1.9;
/** Chapter rail: nodes draw in, the current one sparks. */
export const RAIL = { a: 1.2, b: 2.0 } as const;
export const RAIL_SPARK = 2.05;
/** Zoom-through exit into the ring, so the next slide crossfades in from a clean board. */
export const EXIT = 3.35;
