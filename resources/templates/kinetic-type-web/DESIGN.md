---
version: alpha
name: Kinetic Grove
description: Bright grove-fresh type system for the Kinetic Type Web template.
colors:
  canvas: "#F2F5EC"
  surface: "#E4EADA"
  ink: "#1E3320"
  ink-muted: "#4E6049"
  primary: "#0B7A4B"
  on-primary: "#F2F5EC"
  secondary: "#3F6E8C"
  accent: "#C2703D"
  line: "#C6D2B8"
typography:
  display:
    fontFamily: Arial
    fontSize: 128px
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: -0.03em
  heading:
    fontFamily: Arial
    fontSize: 56px
    fontWeight: 800
    lineHeight: 1.05
  body-md:
    fontFamily: Arial
    fontSize: 24px
    fontWeight: 400
    lineHeight: 1.6
spacing:
  sm: 8px
  md: 16px
  lg: 32px
rounded:
  md: 999px
components:
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  marquee:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.md}"
---

# Kinetic Grove

## Overview

A bright, grove-fresh system for single-page sites where the type is
the motion. Heavy display headlines stagger in, marquees keep rhythm,
and body copy stays quiet. After plan approval the token values below
belong to the user: change them only when explicitly asked.

## Colors

- **Canvas:** misty light green stage for the whole page.
- **Surface:** cards and section bands alternating with the canvas.
- **Ink / Ink-muted:** primary and secondary text.
- **Primary / On-primary:** headline highlights, badges, links, and
  the text placed on them.
- **Secondary:** quiet supporting labels and captions.
- **Accent:** warm clay for one emphasised word per section.
- **Line:** soft section dividers.

## Typography

One family, three weights of voice: ultra-heavy display with tight
tracking, bold headings, calm body. Display sizes are fluid
(`clamp()`) so headlines fit narrow viewports without clipping.

## Layout

Single column, full-bleed sections alternating canvas and surface.
Display type may bleed to the viewport edge; body copy stays inside a
720px measure. See `references/type-motion.md` for the motion
vocabulary.

## Components

Badges are primary pills with on-primary text. Marquees are ink bands
with canvas text, one line high, looping seamlessly.

## Do's and Don'ts

- Do animate words, never whole paragraphs at once.
- Do respect reduced motion: every loop has a calm resting state.
- Don't hard-code colors, fonts or spacing in scene code; read them
  from these tokens (CSS `var(--color-*)` or `useDesign()`).
- Don't add more than two families; weight and scale do the work.
