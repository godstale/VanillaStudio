# Showcase motion principles

How things move on the dark stage. All motion is a pure function of
the scene-local time `t`.

## The turntable

- Rotation angle `angle = turn * t * speed`, with `turn` chosen so the
  product completes whole turns per scene (no loop jump).
- Ease the rate in over the first second (`clamp01(t)`) rather than
  starting at full speed.
- Render the product as layered token surfaces in CSS perspective:
  front face, edge thickness, floor shadow ellipse. It reads as 3D in
  every renderer with zero WebGL cost.

## Light beats

- A rim sweep is a gradient band whose position crosses the stage once
  per beat: `pos = remap(t, beatStart, beatEnd, -20%, 120%)`.
- Accent pulses decay: `glow = accent * exp(-3 * sinceBeat)`. They must
  reach ~0 before the scene ends.

## Callouts

- Dock from the floor: rise 48px + fade, `expoOut`, stagger 0.4s.
- One primary edge tick (4px) per card; card fill is `surface`.
- Never more than two callouts on stage at once.
