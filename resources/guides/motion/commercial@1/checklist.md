# Checklist: commercial motion graphic

Run through every item before you finish and record the result in `.vanilla/self-check.md`.

## Contract
- [ ] `src/index.html` loads without console errors and reports ready only when frames are complete.
- [ ] Every animation is a pure function of `t` (no wall clock, no unseeded randomness, no free-running CSS animation).
- [ ] Canvas size and fps are not hard-coded; the total length equals `duration.seconds`.
- [ ] Colors, type and spacing come only from `DESIGN.md` tokens.

## Timing
- [ ] `beats` start at 0, are contiguous, and the last `end` equals `duration.seconds`.
- [ ] Beat count fits the length (5 s: 3–4, 10 s: 4–6, 15 s: 5–7).
- [ ] The end card holds steadily for at least 0.7 s and nothing new appears in the hold.

## Copy
- [ ] Every on-screen string equals its source in `copy.items` / `beats[].copy` character for character.
- [ ] No pseudo-text, no translated or rewritten copy, repeated text is spelled identically.
- [ ] Character assembly uses whole syllable blocks.
- [ ] No claim, number or function that the user did not provide.

## Identity and references
- [ ] References are not shown or embedded; only their identifying traits are kept.
- [ ] Product silhouette, proportions, color, logo and material stay consistent across beats.
- [ ] Nothing was added that the brief did not ask for (`noUnspecifiedElements`).

## Files
- [ ] External resources are recorded in `CREDITS.md` with source and open license.
- [ ] Only whitelisted `scene.json` fields were changed; user-filled fields were not overwritten.
