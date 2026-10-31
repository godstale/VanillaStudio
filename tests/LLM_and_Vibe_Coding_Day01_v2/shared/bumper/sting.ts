// Bumper sting: a whoosh in, a hit on the number, a short groove under the title, a riser and a
// reverse whoosh out. Each chapter plays on the next chord of the intro progression.
import { BEAT, renderTrack, useTrack } from '../reel/audio';
import { DOT, DURATION, EXIT, NUMBER, WIPE } from './timing';

// A minor – F – C – G – Am – Dm – E – A major (resolves on the last bumper).
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
  [57, 60, 64],
  [50, 53, 57],
  [52, 56, 59],
  [57, 61, 64],
] as const;

function renderSting(index: number) {
  const k = Math.max(0, Math.min(CHORDS.length - 1, index));
  const chord = CHORDS[k];
  return renderTrack(DURATION, 300 + k, (kit) => {
    kit.whoosh(WIPE.a, WIPE.b - WIPE.a + 0.05, true, 0.28);
    kit.impact(NUMBER.hit, 0.75);
    kit.bass(NUMBER.hit, chord[0] - 24, BEAT * 2);
    kit.pad(NUMBER.hit, EXIT.b, chord.map((m) => m - 12), 0.035);
    for (let t = NUMBER.hit + BEAT / 2; t < EXIT.a; t += BEAT / 2) kit.hat(t, 0.12);
    for (const t of [1.0, 2.0, 3.0]) kit.clap(t, 0.45);
    for (const t of [1.5, 2.5]) kit.kick(t, 0.7);
    kit.bass(1.5, chord[0] - 24, BEAT);
    kit.bass(2.0, chord[1] - 24, BEAT * 2);
    kit.stab(1.0, chord, 0.08);
    kit.blip(DOT, chord[2] + 12, 0.2, 0.35);
    kit.blip(DOT + BEAT / 2, chord[0] + 24, 0.12, 0.4);
    kit.riser(2.7, EXIT.a, 0.15);
    kit.whoosh(EXIT.a, EXIT.b - EXIT.a, false, 0.3);
  });
}

export function useSting(index: number, enabled: boolean, volume: number): void {
  useTrack(`bumper-${index}`, () => renderSting(index), enabled, volume);
}
