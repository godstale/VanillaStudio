---
name: product-showcase-video
description: 'Build a dark-stage 3D product film in a Vanilla Studio project: slow turntable reveal, rim-light beats, spec callouts. Use when the brief asks for a product launch, feature spot or any short deterministic video.'
---

# product-showcase-video

You build a `video` deliverable: scenes on one global timeline, every
frame a pure function of the scene-local time `t` (clock contract —
same `t` gives the same frame, so two renders are identical). Read
`vanilla-core` first; it owns the runtime contract, the `DESIGN.md`
rules and the pipeline file rules. This skill only adds the showcase
staging, the beat map and the scene inventory. Read `frame.md` for
pacing before planning.

Contract versions covered here: `template.json` v1, `palette.json` v1.
If a file carries a newer `version` than you know, stop and ask the user.

## 1. When to use it

- Product launches, feature spots, 6–20s looping showcase films.
- Do not use it for slides, the web, or stills.

## 2. Style principles

- Dark stage, one product, three beats max: reveal → detail → payoff.
- Light is the edit: rim-light sweeps and accent pulses mark beats,
  never hard cuts mid-motion.
- The turntable never stops abruptly; rotation eases and loops join
  seamlessly (`t` wraps without a jump).
- Type is large and few: a name, a claim, a price or CTA.

## 3. Plan stage

- `plan.json`: `outputType: "video"`, `format` with `width`, `height`,
  `fps` and `durationSec`; `design.file: "DESIGN.md"`.
- Scenes carry `duration` in seconds (e.g. reveal 4s, detail 5s,
  payoff 4s) on the `timeline` layout with small overlaps for light
  transitions.
- `params[]`: product `name`/`claim` text, stage colors as token
  references, a `speed` number for turntable rate, and a `detail`
  select for the callout angle. Name colors by token in `plan.md`.

## 4. Build stage

- Start from `examples/showcase.tsx` (turntable reveal) and
  `examples/detail.tsx` (spec callout). The 3D is CSS perspective and
  layered token surfaces — deterministic in every renderer with no
  WebGL needed. Reach for `VanillaCanvas` + three.js only when the
  brief demands true geometry, and keep it `frameloop="never"` driven
  by `t`.
- Motion is `timeline()` keyframes or eased `t` segments; see
  `references/motion.md` for the beat map.
- Register async work (product art, fonts) with `registerAsset` so the
  first rendered frame is final.

## 5. Verify before finishing

- `check_scene` passes: no `Date.now`, no unseeded `Math.random`, no
  own `requestAnimationFrame`, no hard-coded colors.
- Render twice and compare: frames must be identical. Scrub the full
  duration: entrances complete, the loop point has no jump.
