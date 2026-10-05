# Rules: motion graphic scene

> Skeleton. Full rules are written in V3 (T3.5/T3.7/T3.9).

## Core

Implement the scene as deterministic code: every animation is a pure function of time `t` from `useTime()`; the same `t` must render the same frame.

## Rules

- Copy in `copy.items` is immutable: render it exactly, character for character (Text Fidelity).
- Keep the beats in `scene.json.beats` as the timeline; do not change timings.
- Hold the end card for at least 0.7 seconds.
- Use only elements listed in the brief when `constraints.noUnspecifiedElements` is true.
