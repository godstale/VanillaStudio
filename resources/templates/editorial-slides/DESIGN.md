---
version: alpha
name: Editorial Paper
description: Print-inspired reading system for the Minimal Editorial Slides template.
colors:
  canvas: "#FAF6EC"
  surface: "#F1EAD9"
  ink: "#1F2A5A"
  ink-muted: "#5A5F86"
  primary: "#8E4394"
  on-primary: "#FAF6EC"
  secondary: "#3F6E8C"
  accent: "#F2C230"
  line: "#D8CFB6"
typography:
  display:
    fontFamily: Georgia
    fontSize: 120px
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: -0.015em
  heading:
    fontFamily: Georgia
    fontSize: 64px
    fontWeight: 400
    lineHeight: 1.1
  body-md:
    fontFamily: Arial
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.55
spacing:
  sm: 8px
  md: 16px
  lg: 32px
rounded:
  md: 4px
components:
  rule:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.md}"
  badge:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
---

# Editorial Paper

## Overview

A calm, print-inspired system for slide decks that should read, not shout.
One serif display face (Georgia), one sans body face (Arial), generous
margins, and a single focal color per slide. After plan approval the token
values below belong to the user: change them only when explicitly asked.

## Colors

- **Canvas:** page background, warm paper white.
- **Surface:** inset panels and pull-quote bands sitting on the canvas.
- **Ink / Ink-muted:** primary and secondary text.
- **Primary / On-primary:** the single focal highlight per slide (rules,
  kickers, page numbers) and the text placed on it.
- **Secondary:** quiet supporting emphasis (captions, labels).
- **Accent:** sparing warmth marker — one element per deck at most.
- **Line:** hairline dividers and table rules.

## Typography

Display type is a large, tight serif; headings stay serif at a smaller
scale; body text is a calm sans with generous line height. At most two
families per deck. Sizes are fluid: they must fit the narrowest export
format without clipping.

## Layout

Content sits inside a 120px safe margin on 1920×1080. Align edges to a
single left rail. One idea per slide; a deck is a sequence of covers,
statements, quotes and closers (see `references/layout.md`).

## Components

Rules are short primary bars above the title. Badges are accent pills
with ink text, used for section labels only.

## Do's and Don'ts

- Do give every slide one focal element in the primary color.
- Do keep body copy under ~140 characters per slide.
- Don't hard-code colors, fonts or spacing in scene code; read them from
  these tokens (CSS `var(--color-*)` or `useDesign()`).
- Don't add shadows, gradients or decorative shapes; the paper and the
  type carry the design.
