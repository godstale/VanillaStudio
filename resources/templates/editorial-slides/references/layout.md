# Editorial layout principles

How slides in this template are composed. Keep every new scene inside
these rails so the deck reads as one document.

## The page

- Canvas 1920×1080. Safe inset 120px on all sides; nothing structural
  may cross it. Captions may sit on the inset edge, never outside it.
- One left rail at x = 240px: kicker, title, body and footer all start
  there. Right-aligned elements (page numbers) mirror at x = 1680px.

## The inventory (pick per slide, never mix two)

| Kind | Anatomy |
| --- | --- |
| Cover | Kicker (accent badge) + display title + primary rule + subtitle + footer line |
| Statement | Kicker + heading + 1–3 body lines + page number |
| Figure | Heading + one large numeral or short list + caption on the rail |
| Quote | Primary rule + large serif quote + attribution, nothing else |
| Closer | Display line + accent marker + contact or next-step line |

## Type scale (1920×1080)

- Display: 120px Georgia, tight (`lineHeight` 1.02). Titles up to
  ~40 characters; longer titles drop to the 64px heading size.
- Heading: 64px Georgia. Body: 28px Arial, `lineHeight` 1.55, max
  ~140 characters.
- Kicker: 24px Arial, uppercase, letter-spaced, primary or badge.

## Motion

- Slides are clock scenes: entrance only, as a pure function of `t`.
- Fade + 24px rise, `ease.expoOut`, complete by `t = 1`. Stagger
  siblings by 0.12s each. Nothing loops, nothing exits — a captured
  slide is the design.
