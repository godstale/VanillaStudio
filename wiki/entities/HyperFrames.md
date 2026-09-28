---
title: 'HyperFrames'
type: entity
tags: [rendering, video, oss]
sources: [research-2026-09-28-agents-rendering]
last_updated: 2026-09-28
---

HeyGen의 오픈소스(Apache-2.0) HTML→영상 렌더 프레임워크. 헤드리스 Chrome + FFmpeg로 결정적 MP4 렌더. 컴포지션은 HTML + data 속성, `window.__timelines`에 paused 타임라인 등록. 어댑터: GSAP·CSS/WAAPI·Lottie·three.js(`hf-seek` 이벤트)·Anime.js·커스텀. Node 22+ 필요. CLI: init/preview/render/lint/snapshot/doctor.

Vanilla Studio의 동영상 렌더러(D-004). React/R3F 빌드를 seek 계약에 연결하는 것이 PoC S1. 관련: [[DeterministicRendering]], [[ExportPipeline]]

## Appearances

- [[decisions]] — D-004
- [[feasibility-risks]] — PoC S1
