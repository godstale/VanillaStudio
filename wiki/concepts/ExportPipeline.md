---
title: 'ExportPipeline'
type: concept
tags: [export]
sources: [technical-design, product-spec]
last_updated: 2026-09-29
---

export 요청 → 체크포인트 확인 → vite build → 유형별 처리 → `exports/<ts>-<fmt>/` → (선택) [[Playground]]. web/interactive: 정적 zip·임베드 패키지(Web Component + React 래퍼), image: 헤드리스 Chrome 캡처, slides: 캡처→pptxgenjs/PDF, 편집 PPTX는 [[DomToPptx]], video: [[HyperFrames]].

## Discussed In

- [[technical-design]] — §7
- [[product-spec]] — §2, §3.6

## Pitfalls

- 스틸·슬라이드 캡처는 런타임 준비 신호(`__vanillaReady`)를 기다린다. 기다리지 않으면 WebGL 오브젝트가 통째로 빠지거나 대체 폰트로 찍힌다 → [[poc-s2]]
- HyperFrames `snapshot`은 `GEMINI_API_KEY`가 있으면 Gemini 비전 분석을 자동 실행한다. `--describe false`를 붙이고 워커 환경에서 키를 제거한다.
