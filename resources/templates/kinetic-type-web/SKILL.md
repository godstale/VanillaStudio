---
name: kinetic-type-web
description: 'Build a kinetic-typography single-page site in a Vanilla Studio project: staggered hero reveals, scrolling manifestos, seamless marquees. Use when the brief asks for a landing page, announcement page or any web deliverable led by moving type.'
---

# kinetic-type-web

You build a `web` deliverable: sections in a column, each with its own
local time (free mode — real-time animation is allowed, but parameter
and token rules still apply). Read `vanilla-core` first; it owns the
runtime contract, the `DESIGN.md` rules and the pipeline file rules.
This skill only adds the kinetic-type vocabulary and the section
inventory.

Contract versions covered here: `template.json` v1, `palette.json` v1.
If a file carries a newer `version` than you know, stop and ask the user.

## 1. When to use it

- Landing pages, announcement pages, event pages, single-page stories.
- Do not use it for video, slides, or stills.

## 2. Style principles

- Type is the visual: display headlines at 10vw+, body copy quiet.
- Animate words, never whole paragraphs: per-word stagger, masked
  line reveals, one marquee per page.
- Loops join seamlessly; every loop has a calm resting state for
  `prefers-reduced-motion`.
- One emphasised word per section in `colors.accent`; links and
  badges in `colors.primary`.

## 3. Plan stage

- `plan.json`: `outputType: "web"`, `format: { width: 1440, height: 900 }`,
  one scene per section (`hero`, `manifesto`, `marquee`, `footer`),
  `design.file: "DESIGN.md"`.
- `params[]`: headline/body `text`, headline colors as token
  references, `speed` numbers for stagger and marquee rate, a `density`
  select where sections vary. Name colors by token in `plan.md`.

## 4. Build stage

- Start from `examples/hero.tsx` (staggered hero) and
  `examples/manifesto.tsx` (scrolling statement). Free mode means
  `useTime()` returns elapsed live time and rAF-style motion is
  allowed — but keep it a function of `t` anyway so captures and
  posters stay deterministic.
- `src/composition.tsx`: `defineComposition({ scenes: [...], time: "free",
  layout: "sections" })`.
- Fluid display sizes with `clamp()`; verify the narrowest viewport
  (360px) for clipped or overflowing text.

## 5. Verify before finishing

- `check_scene` passes: no hard-coded colors outside token-driven
  params, no external URLs without `CREDITS.md`.
- Read every section at 1440px and 360px: no overflow, line length
  comfortable, one idea per screen.
