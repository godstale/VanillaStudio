# Checklist: static page

Run through every item before you finish and record the result in `.vanilla/self-check.md`.

## Contract
- [ ] `src/index.html` loads without console errors and reports ready when fonts and assets are loaded.
- [ ] Nothing advances by itself: no timers, no autoplay, no auto-advance.
- [ ] Every step's `advance` is `click`, `key:<Key>` or `choice:<label>`, and the page shows the matching hint.
- [ ] After the last step's input the page reports that it is finished.
- [ ] Colors, type and spacing come only from `DESIGN.md` tokens.

## Layout and type
- [ ] One layout pattern and one grid; spacing uses tokens.
- [ ] At most four type levels per screen; body text at least 16 px equivalent.
- [ ] The layout reflows at every listed breakpoint with no horizontal overflow.

## Copy
- [ ] Every string equals the source in `scene.json` character for character.
- [ ] No invented facts, numbers, claims or testimonials.

## Accessibility
- [ ] WCAG AA contrast, semantic landmarks, ordered headings, alt text where meaningful.
- [ ] Keyboard operable with a visible focus ring; step changes are announced.
- [ ] `prefers-reduced-motion` is respected.

## Files
- [ ] External resources are recorded in `CREDITS.md` with source and open license.
- [ ] Only whitelisted `scene.json` fields were changed; user-filled fields were not overwritten.
