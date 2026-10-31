<!-- vanilla:generated scene-hash=9a5db63c7d13f42053c2122f682f8440fdeb718e586dcf84299ccf50a478b639 body-hash=c9b05a57f48ed034b2600cb48a32c3a37711c54c6a1718e0a467e95649605cc5 -->
# Bumper — 04. 특이점 — Guide

Generated from `scene.json` for workspace "LLM_and_Vibe_Coding_Day02_v2". Read-only: change the scene in the app or in `scene.json`, not here.

Template: opus-science-explainer@1 · Type: motion · Status: needs-revision

## Brief

- **subject**: Chapter 04 — 특이점
- **goal**: 4 s chapter bumper in the intro's chalk-on-blueprint style, played right before chapter 04
- **audience**: 중학생 이상 일반인
- **message**: Next: chapter 04 특이점
- **language**: ko

## Timing

- **duration**: 4 seconds
- **structure**: continuous
- **adStructure**: transformation
- **creativeMode**: hand-drawn-explainer, kinetic-type

## Brand voice

- warm
- technical
- minimal

## Visual style

- **medium**: Chalk-on-blueprint SVG line drawing: strokes draw themselves, static grain erodes every line
- **lighting**: Deep navy board (canvas-deep) with cream chalk (paper) and a single amber accent (primary)
- **typography**: Display serif (Playfair Display) for the chapter number, mono (JetBrains Mono) for the kicker, Pretendard 800 for the Korean chapter title
- **density**: One chapter card, generous negative space
- **cameraFeeling**: Slow push-in, then a zoom-through dive into the ring
- **mood**: Curious, crafted, optimistic

## Motion vocabulary

- **typography**: handwrite-reveal, typewriter
- **object**: line-draw, check-draw
- **camera**: push-in, zoom-through
- **material**: chalk-grain
- **transition**: zoom-through

## Beats

### number · 0s – 1.2s · hook

- copy: 04
- visual: Amber spark at the top of a chalk ring that draws itself with ruler ticks; the serif chapter number writes itself inside
- motion: line-draw, handwrite-reveal
- camera: push-in
- transitionOut: match-cut
- notes: Number lands on the impact at 0.94 s.

### title · 1.2s – 3.35s · end-card

- copy: CHAPTER / 특이점
- visual: Kicker types in amber mono, an amber bar draws, the Korean title is handwritten with an amber dot; the chapter rail checks past chapters and sparks the current one
- motion: typewriter, handwrite-reveal, check-draw
- camera: push-in
- transitionOut: zoom-through
- notes: Hold from 2.4 s; nothing new appears after 2.6 s.

### exit · 3.35s – 4s · transition

- copy: _(empty)_
- visual: Board dives through the ring and fades to the clean canvas
- motion: zoom-through
- camera: zoom-through
- transitionOut: crossfade
- notes: Ends on the empty board so the next slide crossfades in cleanly.

## Copy (text fidelity: adapt)

Render these exactly, character for character.

- "CHAPTER"
- "04"
- "특이점"
- "바이브 코딩의 시작까지"
- "LLM을 에이전트로"
- "에이전트의 날갯짓"
- "특이점"
- "맺음말"

## Identity

- **product**: Vibe Coding for Beginners (lecture)
- **character**: _(empty)_
- **mustKeep**: amber dot after the title, chalk grain, zoom-through exit

## End card

- **holdSeconds**: 0.9
- **elements**: chapter number in ring, chapter title, chapter rail

## Audio (recorded only)

- **voiceOver**: _(empty)_
- **soundDesign**: Spark chime, whoosh as the ring draws, key clicks for the kicker, impact when the number lands, bell for the dot and the rail spark, reverse whoosh on the exit
- **music**: Procedural Web Audio (code, no samples, no generative AI): 96 BPM pad + plucks on the intro progression, one chord per chapter (Bm, G, A, D). Rendered offline from a fixed seed, synced to the scene clock.

## Constraints

- **avoid**: subtitles or narration, voice-over, unlabeled decorative clutter
- **noUnspecifiedElements**: true

## References

_(empty)_

## User prompt

_(empty)_

## Fields you may fill

`duration`, `creativeMode`, `structure`, `adStructure`, `brandVoice`, `visualStyle`, `motionVocabulary`, `beats`, `identity`, `endCard`, `audio`, `constraints`, `status`
