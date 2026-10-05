# Rules: 3D animation scene

> Skeleton. Full rules are written in V3 (T3.5/T3.7/T3.9).

## Core

Animate as a pure function of time `t`; no unseeded randomness and no wall-clock reads.

## Rules

- Describe composition, materials, lighting and camera path as in `scene.json`.
- Respect `performanceBudget`; prefer simple geometry and baked-looking materials.
- Keep camera motion on the path from `cameraPath`.
