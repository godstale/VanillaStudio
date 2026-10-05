# Rules: static page (web page)

You build a page that a person reads and operates. It is not a video: **nothing advances on its own**. Time, timers, autoplay and auto-advance are not allowed. The page moves forward only when the user gives input (click, key, or choice). You implement it as code under `src/` (entry `src/index.html`) from `scene.json`.

## 0. Contract

- The page has two modes, set in `mode`:
  - `scroll`: one long page. It counts as one step; the sequence moves on when the user scrolls to the end and presses the page's own continue control, or gives the input the sequence edge asks for.
  - `steps`: a slide-like sequence of full-screen steps from `steps[]`. The user moves between steps by input only.
- Canvas size (aspect and resolution) comes from `workspace.json`; design for that frame, then make it hold at the breakpoints in `breakpoints`.
- Colors, type scale and spacing come only from `DESIGN.md` tokens (CSS `var(--color-*)`).
- No network or CDN dependencies at runtime. Bundle what you need. Record every external resource in `CREDITS.md`.
- Report ready when fonts and assets are loaded.

## 1. Layout

- Fields: `layout`, `sections`.
- Choose one layout pattern (single column, split, grid, bento, sidebar, stacked cards) and keep one visual grid. Align everything to it.
- Sections follow the page's purpose: hero, feature grid, testimonial, pricing, FAQ, call to action, footer, gallery, timeline, stats. Each section has one job.
- Keep generous, consistent spacing from the spacing tokens. No element touches the frame edge without a reason.

## 2. Typography

- Use the type tokens: a clear hierarchy of at most four levels on a screen (display, heading, body, caption).
- Body text 16 px equivalent or larger, line length 45–80 characters, line height 1.4–1.7. Korean text uses a clean sans-serif with correct Hangul glyphs; never split syllable blocks.
- On-screen copy is **immutable**: render every string exactly as written in `scene.json` (spacing, punctuation, capitalization, numerals). No rewriting, translating or "fixing".

## 3. Responsive behavior

- Field: `breakpoints`. The layout must reflow, not shrink: stack columns, resize type with `clamp()`, keep tap targets at least 44 px.
- Test every listed breakpoint. Nothing overflows horizontally; images keep their aspect ratio.

## 4. Accessibility

- Field: `accessibility`. Meet WCAG AA contrast (text 4.5:1, large text 3:1), use semantic landmarks and heading order, provide alt text for meaningful images, keep a visible focus ring, and make everything reachable and operable by keyboard.
- Respect `prefers-reduced-motion`: replace movement with a plain state change.
- Announce step changes to assistive technology (`aria-live="polite"` on the step title).

## 5. Copy

- One idea per section, short sentences, verbs first on buttons. Do not invent facts, numbers, claims or testimonials the user did not provide; use clearly marked placeholders only when the user asked for a layout draft.

## 6. Interaction and steps

- Fields: `steps[]` with `id`, `title`, `copy`, `layout`, `enter`, `advance`.
- `advance` is **only** one of: `click`, `key:<Key>` (for example `key:ArrowRight`), or `choice:<label>`. Never use a timer, an `end` event or any automatic progress.
- Show a small hint for the advance input on every step (for example "Click or press →"). For `choice:`, render the choices as real buttons.
- `enter` describes how the step appears (fade, slide, zoom, mask wipe, cut). Implement it as a short, deterministic transition; the final state of the step must be complete without animation.
- The last step's input hands control back to the sequence. Expose it exactly as the playground expects: after the last step's input, report that the page is finished.
- Stepping backwards (`ArrowLeft`, back control) is allowed when it does not break the story.

## 7. Write-back

- You may fill the fields on the write-back whitelist (`mode`, `steps`, `sections`, `layout`, `breakpoints`, `accessibility`, `status`) when they are empty. Never overwrite what the user filled and never touch `copy` text the user wrote.

## 8. Output

- Deliver working code under `src/` and the filled `scene.json` fields. No commentary, alternatives or summaries unless the user asked.
