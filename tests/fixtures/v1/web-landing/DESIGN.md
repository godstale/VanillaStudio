---
version: alpha
name: Vanilla Default
description: Neutral, readable default design system for a new Vanilla Studio project.
colors:
  canvas: "#FAF7F0"
  surface: "#EFEADD"
  ink: "#1F2430"
  ink-muted: "#5B6170"
  primary: "#E8A93B"
  on-primary: "#1F2430"
  secondary: "#3F6E8C"
  accent: "#C8553D"
  line: "#D5CEBD"
typography:
  display:
    fontFamily: Georgia
    fontSize: 96px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: -0.02em
  heading:
    fontFamily: Arial
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.15
  body-md:
    fontFamily: Arial
    fontSize: 24px
    fontWeight: 400
    lineHeight: 1.5
spacing:
  sm: 8px
  md: 16px
  lg: 32px
rounded:
  md: 12px
components:
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
---

# {{projectName}}

## Overview

A calm, paper-like default. Replace the palette from the app or ask the agent to refine this file
during planning; after the plan is approved the token values belong to the user.

## Colors

- **Canvas:** page and frame background.
- **Surface:** cards and panels sitting on the canvas.
- **Ink / Ink-muted:** primary and secondary text.
- **Primary / On-primary:** the single focal highlight and the text placed on it.
- **Secondary, Accent:** supporting emphasis; use sparingly.
- **Line:** borders and dividers.

## Typography

Display type is large and tight; headings are bold and compact; body text stays calm and readable.

## Layout

Generous margins; content sits on an 8px rhythm (`spacing` tokens).

## Components

Badges use the primary color with on-primary text.

## Do's and Don'ts

- Do use the primary color for one focal element per scene.
- Don't hard-code colors, fonts or spacing in scene code; read them from these tokens
  (CSS `var(--color-*)` or `useDesign()`).
