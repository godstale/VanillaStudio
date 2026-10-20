# Checklist: 3D animation scene

Run through every item before you finish and record the result in `.vanilla/self-check.md`.

## Determinism
- [ ] Everything is driven by `t` from `useTime()`: transforms, materials, lights, camera.
- [ ] No wall-clock reads, no frame-delta accumulation, no unseeded randomness.
- [ ] The same `t` renders the same frame (check two frames at the same `t`).
- [ ] A frame is complete (textures and shaders ready) before ready is reported.

## Timing
- [ ] `beats` start at 0, are contiguous, and the last `end` equals `duration.seconds`.
- [ ] The final composition holds still for at least 0.7 s.

## Look
- [ ] Colors come from `DESIGN.md` tokens, not hard-coded values.
- [ ] Composition, materials, lighting and camera path match `scene.json`.
- [ ] Text, if any, equals the source copy exactly.

## Performance
- [ ] The scene stays within `performanceBudget` (triangles, lights, shadows, texture sizes).
- [ ] No per-frame allocations; repeated objects are instanced; unused resources are disposed.

## Files
- [ ] External models, textures and HDRIs are recorded in `CREDITS.md` with source and open license.
- [ ] Only whitelisted `scene.json` fields were changed; user-filled fields were not overwritten.
