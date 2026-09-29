---
version: alpha
name: Solar Parchment
description: Warm editorial system for Vanilla Studio test scenes.
colors:
  canvas: "#E9E5DB"
  surface: "#DCD6C4"
  ink: "#1B2566"
  ink-muted: "#5A6190"
  primary: "#F1EE2E"
  secondary: "#E26B4A"
  accent: "#F0DA7C"
  line: "#B9B3A3"
typography:
  display:
    fontFamily: Georgia
    fontSize: 96px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: -0.02em
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
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
---

# Solar Parchment

## Overview

A warm, editorial look: parchment paper, deep indigo ink and a single solar highlight.

## Colors

- **Canvas (#E9E5DB):** warm parchment that carries every frame.
- **Ink (#1B2566):** deep indigo for headlines and body text.
- **Primary (#F1EE2E):** the solar highlight, used for one element per scene.
- Supporting roles (surface, ink-muted, line) stay close to the canvas and ink.

## Typography

Display type is set large and tight; body text stays calm and readable.

## Layout

Generous margins; content sits on an 8px rhythm.

## Components

Badges use the primary color with ink text.

## Do's and Don'ts

- Do use the primary color for a single focal element.
- Don't hard-code colors in scene code; use the tokens.
