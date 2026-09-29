---
version: alpha
name: Showcase Ember
description: Dark-stage cinematic system for the 3D Product Showcase Video template.
colors:
  canvas: "#1C1410"
  surface: "#2A2019"
  ink: "#F0E4D4"
  ink-muted: "#B9A892"
  primary: "#E8837A"
  on-primary: "#1C1410"
  secondary: "#8FA3C7"
  accent: "#E0B26A"
  line: "#453729"
typography:
  display:
    fontFamily: Arial
    fontSize: 110px
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: -0.02em
  heading:
    fontFamily: Arial
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.1
  body-md:
    fontFamily: Arial
    fontSize: 26px
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
  callout:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
---

# Showcase Ember

## Overview

A dark stage for product films: warm near-black canvas, ember primary,
brass accent. The product turns on a slow turntable; light beats mark
the story. After plan approval the token values below belong to the
user: change them only when explicitly asked.

## Colors

- **Canvas:** the stage — warm near-black. Never pure black; the
  product silhouette must read against it.
- **Surface:** callout cards and lower-third bands floating above the
  stage.
- **Ink / Ink-muted:** primary and secondary text.
- **Primary / On-primary:** rim-light beats, the hero badge, and the
  text placed on them.
- **Secondary:** cool fill light for captions and secondary labels.
- **Accent:** brass highlight — price, CTA, one hero detail.
- **Line:** faint dividers on the stage floor.

## Typography

One grotesque voice (Arial Black weights of the system sans), bold
display with tight tracking, calm sans body. Titles must survive the
smallest export height without clipping.

## Layout

Product center-stage, floor line at 78% height. Lower thirds rise from
the floor; callouts dock left or right with 96px margins. See
`references/motion.md` for the beat map and `frame.md` for pacing.

## Components

Badges are primary pills with on-primary text (feature flags, prices).
Callouts are surface cards with a primary edge tick.

## Do's and Don'ts

- Do stage one product and at most three beats per film.
- Do complete every entrance inside its scene range; loops must join
  seamlessly for looping exports.
- Don't hard-code colors, fonts or spacing in scene code; read them
  from these tokens (CSS `var(--color-*)` or `useDesign()`).
- Don't use generative video or images; the turntable, light and type
  are all code.
