# frame.md — pacing a showcase film

Motion and pacing guidance for `video` projects built from this
template. The film is cut from light, not from edits.

## The beat map (13s default)

| Beat | Range | What happens |
| --- | --- | --- |
| Reveal | 0–4s | Stage fades up, product rises from the floor line, turntable eases to full rate, rim sweep crosses once |
| Detail | 4–9s | Callout cards dock (left, then right), accent pulse on the hero detail, rotation continues |
| Payoff | 9–13s | Product centers and slows, name + claim + price lock in, end card holds 1.5s |

## Pacing rules

- Ease everything (`expoOut` for entrances, `inOut` for moves).
  Linear motion reads as broken render, not intention.
- Entrances complete inside their scene range; at the film's last
  frame the stage rests in a calm state a poster could use.
- Overlaps between scenes are 0.4–0.6s and carry light only (rim
  sweep, floor glow) — the product never jumps.
- 24 or 30fps, 1080p default. Duration changes rescale beats, never
  reorder them.

## Determinism

- Every visible value derives from `t`. Seeded helpers
  (`useSeededRandom`, `noise2D`) for grain and shimmer; never
  `Math.random`, clocks, or ambient loops.
- The loop point (`t = duration`) must equal `t = 0` for looping
  exports: rotation angle wraps on whole turns, pulses decay to zero.
