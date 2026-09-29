# Kinetic type motion vocabulary

How words move on the page. Free mode allows real-time animation, but
every pattern below stays a function of `t` so captures match the
live page.

## Staggered hero

- Split the headline into words. Word `i` enters with
  `p = expoOut(clamp01((t * speed - i * 0.09) / 0.6))`: fade + 0.6em
  rise + slight rotate (2deg → 0).
- The emphasised word takes `colors.accent`; the rest is ink. Never
  emphasise two words in one headline.

## Masked line reveal

- Each line sits in an `overflow: hidden` mask and slides up from
  110% to 0. Stagger lines by 0.12s. Good for manifesto statements.

## Marquee

- Duplicate the line twice, translate from 0 to -50% over
  `length / speed` seconds, linear, infinite. The midpoint must match
  the start exactly (identical halves).
- Ink band, canvas text, one line high. One marquee per page.

## Scroll hints

- Prefer in-view once-entrances (IntersectionObserver is fine in
  free mode) over scroll-linked transforms; they survive export
  capture. Keep a calm resting state for `prefers-reduced-motion`.
