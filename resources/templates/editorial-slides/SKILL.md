---
name: editorial-slides
description: 'Build a minimal, print-inspired slide deck in a Vanilla Studio project: quiet paper background, serif display type, one focal color per slide. Use when the brief asks for talks, lectures, reports or any deck that should read, not shout.'
---

# editorial-slides

You build a `slides` deliverable: an ordered array of scenes, each a pure
function of the scene-local time `t` (clock contract — same `t` gives the
same frame). Read `vanilla-core` first; it owns the runtime contract, the
`DESIGN.md` rules and the pipeline file rules. This skill only adds the
editorial look and the slide inventory.

Contract versions covered here: `template.json` v1, `palette.json` v1.
If a file carries a newer `version` than you know, stop and ask the user.

## 1. When to use it

- Talks, lectures, course intros, project reports, reading decks.
- Do not use it for video (see the product-showcase-video skill), the web
  (see the kinetic-type-web skill), or image variants.

## 2. Style principles

- One idea per slide. A deck is 5–12 slides: cover, 3–8 statements,
  0–2 quotes, closer. Cut before you decorate.
- Generous margins: 120px safe inset on 1920×1080, one left rail for
  every text edge.
- One focal element per slide in `colors.primary` — a rule, a kicker,
  a page number. Everything else is ink on paper.
- `colors.accent` appears at most once per deck (the closer, or one
  badge). If everything glows, nothing does.
- No shadows, no gradients, no decorative shapes. Paper and type carry
  the design.

## 3. Plan stage

- `plan.json`: `outputType: "slides"`, `format: { width: 1920, height: 1080 }`,
  one scene per slide, `design.file: "DESIGN.md"`.
- Scene ids read like a table of contents: `cover`, `thesis`,
  `evidence-1`, `quote-owusu`, `closer`.
- Slides scenes omit `duration`; the composition uses the `timeline`
  layout so `goto` and capture step through them in order.
- `params[]`: every slide exposes its key text (`text`), its focal
  color as a token reference (`color`, e.g. `{colors.primary}`), and a
  `speed` number for the entrance. Copy in `plan.md` names colors by
  token, never by value.

## 4. Build stage

- Start from `examples/cover.tsx` and `examples/quote.tsx`: token-only
  styling (`var(--color-*)`), entrance motion as a pure function of `t`
  that completes by `t = 1` (`ease.expoOut(clamp01(t / 1))`).
- Display face is Georgia, body is Arial — both system stacks, so the
  deck renders identically offline and exports without font embedding
  surprises. Never add a web font without a `CREDITS.md` entry.
- Keep body copy under ~140 characters per slide; check the narrowest
  export format for clipped text.
- `src/composition.tsx`: `defineComposition({ scenes: [...] })` with the
  default `timeline` layout (no `time` override — slides are clock mode).

## 5. Verify before finishing

- `check_scene` passes with zero hard-coded colors and zero forbidden
  time APIs.
- Capture every slide and read it: one focal element, aligned rail,
  no overflow, entrance at rest at the captured instant.
