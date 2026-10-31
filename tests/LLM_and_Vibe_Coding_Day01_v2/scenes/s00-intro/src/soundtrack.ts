// Intro soundtrack: sparse bounce plucks under the signal, then a 120 BPM groove with a hit on every
// cut and a sound for every motif, a riser into the title impact, and the ball's landing as the last note.
import { BEAT, renderTrack, useTrack } from '../../../shared/reel/audio';
import { BALL_LANDINGS, CLICK, CUBE, DURATION, MAKE_DOT, ORBIT_CUT, SHOT, TITLE, WORDS } from './timing';

// Am – Am – F – C – G – Am – Dm – E – A, one chord per shot.
const CHORDS = [
  [57, 60, 64],
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
  [57, 60, 64],
  [50, 53, 57],
  [52, 56, 59],
  [57, 61, 64, 69],
] as const;

function renderIntro() {
  return renderTrack(DURATION, 2026, (kit) => {
    // Signal: each bounce plucks a little lower and softer.
    kit.pad(0, SHOT[1] + 0.2, CHORDS[0].map((m) => m - 12), 0.03);
    BALL_LANDINGS.forEach((t, i) => kit.blip(t, 76 - i * 3, 0.24 * 0.75 ** i, 0.3));
    kit.riser(1.1, SHOT[1], 0.12);

    // Groove from the first cut to the title.
    for (let s = 1; s < 8; s++) {
      const a = SHOT[s];
      const b = SHOT[s + 1];
      const chord = CHORDS[s];
      kit.stab(a, chord, 0.07);
      kit.bass(a, chord[0] - 24, b - a - 0.05);
    }
    for (let t = SHOT[1]; t < SHOT[8] - 0.01; t += BEAT) {
      kit.kick(t, 0.85);
      kit.hat(t + BEAT / 2, 0.12);
      if (Math.round((t - SHOT[1]) / BEAT) % 2 === 1) kit.clap(t, 0.4);
    }
    kit.impact(SHOT[1], 0.7);

    // Type: a whoosh and a slam per word, a blip on the dot.
    WORDS.forEach((w, i) => {
      kit.whoosh(SHOT[1] + w - 0.12, 0.14, true, 0.25);
      kit.kick(SHOT[1] + w, 0.6 + i * 0.1);
    });
    kit.blip(SHOT[1] + MAKE_DOT, 81, 0.2);

    // Form: ticks as the shape snaps into the cross and the hexagon.
    for (const t of [SHOT[2] + 0.75, SHOT[2] + 1.4]) {
      kit.click(t, 0.4);
      kit.blip(t, 72, 0.1, 0.15);
    }

    // Depth: the cube splits, then scatters.
    kit.whoosh(SHOT[3] + CUBE.split - 0.1, 0.3, true, 0.22);
    kit.whoosh(SHOT[3] + CUBE.scatter, 0.45, false, 0.3);

    // Attention: sparkles as the accent dots light up.
    [0, 2, 4, 7, 9].forEach((n, i) => kit.blip(SHOT[4] + 0.6 + i * 0.1, 76 + n, 0.08, 0.2));

    // Flow: one long swish under the ribbons.
    kit.whoosh(SHOT[5], 1.0, true, 0.22);

    // Prompt: the cursor click.
    kit.click(SHOT[6] + CLICK, 0.6);
    kit.blip(SHOT[6] + CLICK, 84, 0.16, 0.2);

    // Scale: the sun hits, the orbit swooshes, then a riser into the title.
    kit.impact(SHOT[7], 0.45);
    kit.whoosh(ORBIT_CUT - 0.05, 0.4, true, 0.2);
    kit.riser(SHOT[7] + 0.45, SHOT[8], 0.2);

    // Title: impact, the ball drops in as the full stop, the last chord rings out.
    kit.impact(SHOT[8], 1);
    kit.whoosh(SHOT[8] + TITLE.drop - 0.1, 0.3, false, 0.18);
    kit.kick(SHOT[8] + TITLE.land, 0.7);
    kit.blip(SHOT[8] + TITLE.land, 81, 0.22, 0.6);
    kit.pad(SHOT[8], DURATION, CHORDS[8].map((m) => m - 12), 0.045);
    kit.bass(SHOT[8], CHORDS[8][0] - 24, 1.4, 0.3);
  });
}

export function useSoundtrack(enabled: boolean, volume: number): void {
  useTrack('intro', renderIntro, enabled, volume);
}
