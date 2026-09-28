---
title: 'HyperFrames'
type: entity
tags: [rendering, video, oss]
sources: [research-2026-09-28-agents-rendering, research-2026-09-29-design-md-hyperframes]
last_updated: 2026-09-29
---

HeyGen의 오픈소스(Apache-2.0) HTML→영상 렌더 프레임워크. 헤드리스 Chrome + FFmpeg로 결정적 MP4 렌더. 컴포지션은 HTML + data 속성, `window.__timelines`에 paused 타임라인 등록. 어댑터: GSAP·CSS/WAAPI·Lottie·three.js(`hf-seek` 이벤트)·Anime.js·커스텀. Node 22+ 필요. CLI: init/preview/render/lint/snapshot/doctor.

**FRAME.MD**(`frame.md`): design.md의 브랜드를 16:9 영상에 맞게 옮긴 사양(페이싱·체류·모션). 디자인 프리셋 12종(https://www.hyperframes.dev/design)을 제공한다. **카탈로그**(https://hyperframes.heygen.com/catalog): 10개 분류, 약 390개 블록·컴포넌트. 항목은 GSAP paused timeline 기반이며 `npx hyperframes add`로 설치한다. Vanilla는 이 자료를 템플릿 참고용으로만 쓴다(D-017). → [[research-2026-09-29-design-md-hyperframes]]

Vanilla Studio의 동영상 렌더러(D-004). **PoC S1 통과**: React+R3F 빌드를 `hf-seek`로 구동해 결정적 MP4 렌더 확인 → [[poc-s1]]. 주의: MP4는 libx264(GPL FFmpeg) 필요, `data-no-timeline`으로 45초 대기 제거. React/R3F 빌드를 seek 계약에 연결하는 것이 PoC S1. 관련: [[DeterministicRendering]], [[ExportPipeline]]

## Appearances

- [[decisions]] — D-004
- [[feasibility-risks]] — PoC S1, S7
- [[poc-s1]] — 렌더 검증 결과
- [[research-2026-09-29-design-md-hyperframes]] — FRAME.MD·프리셋·카탈로그
- [[DesignMd]], [[ColorPalette]]
