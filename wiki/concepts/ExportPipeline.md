---
title: 'ExportPipeline'
type: concept
tags: [export]
sources: [technical-design, product-spec]
last_updated: 2026-09-28
---

export 요청 → 체크포인트 확인 → vite build → 유형별 처리 → `exports/<ts>-<fmt>/` → (선택) [[Playground]]. web/interactive: 정적 zip·임베드 패키지(Web Component + React 래퍼), image: 헤드리스 Chrome 캡처, slides: 캡처→pptxgenjs/PDF, 편집 PPTX는 [[DomToPptx]], video: [[HyperFrames]].

## Discussed In

- [[technical-design]] — §7
- [[product-spec]] — §2, §3.6
