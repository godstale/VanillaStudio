---
title: 'DomToPptx'
type: entity
tags: [export, pptx]
sources: [research-2026-09-28-agents-rendering]
last_updated: 2026-09-29
---

`dom-to-pptx`: HTML 요소를 편집 가능한 PPTX 슬라이드로 변환하는 클라이언트 사이드 라이브러리(PptxGenJS 기반). Vanilla Studio의 편집 가능 PPTX export(Beta, D-003) 후보. 품질 검증은 PoC S5. 관련: [[ExportPipeline]]

## Appearances

- [[decisions]] — D-003
- [[feasibility-risks]] — PoC S5

## PoC S5 결과 ([[poc-s5]])

- 2.1.2, MIT. 텍스트는 편집 가능한 상자로 들어가고 위치도 정확하다. SVG는 벡터, 캔버스는 그림이 된다.
- Pitfalls:
  - 텍스트 상자 폭이 DOM과 똑같아서 PowerPoint에서 줄이 넘어간다 → `wrap="none"` 후처리.
  - 임베드 웹 폰트를 PowerPoint가 쓰지 않는다 → 설치 폰트가 조건이다.
  - 그라데이션 각도·그림자는 근사치다.
  - npm 의존성에 puppeteer 전체가 들어 있다 → 브라우저 번들만 벤더링한다.
