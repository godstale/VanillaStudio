// Shared timing for the chapter bumper picture and its sting (120 BPM, one beat = 0.5 s).

export const DURATION = 4;
/** Color field wipes in from the right. */
export const WIPE = { a: 0, b: 0.32 } as const;
/** Chapter number slams in from the left and lands on the first downbeat. */
export const NUMBER = { a: 0.2, dur: 0.42, hit: 0.5 } as const;
export const MOTIF_START = 0.35;
/** Korean title words rise one by one; the serif line reveals left to right, then its dot pops. */
export const TITLE = { a: 0.72, step: 0.07, dur: 0.55 } as const;
export const SERIF = { a: 1.1, dur: 0.45 } as const;
export const DOT = 1.5;
export const RULE = { a: 1.3, b: 1.9 } as const;
export const FOOTER = 1.55;
/** Everything whips left and the deck background wipes in, so the next slide crossfades from a clean board. */
export const EXIT = { a: 3.3, b: 3.85 } as const;
