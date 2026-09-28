---
title: 'PoC S2: 스틸 캡처(@2x) + 이미지 PPTX/PDF'
type: source
tags: [poc, phase-p3, export, slides, image]
date: 2026-09-29
source_file: spikes/s2-still-pptx/README.md
sources: [feasibility-risks, technical-design]
last_updated: 2026-09-29
---

## Summary

**결론: 통과.** 빌드된 슬라이드를 puppeteer-core와 HyperFrames가 관리하는 `chrome-headless-shell`로 캡처했다(`deviceScaleFactor=2`, 3840×2160 PNG). 캡처 시간은 슬라이드당 0.3~0.5초였다. `pptxgenjs`로 만든 이미지 PPTX와 `pdf-lib`로 만든 PDF는 실제 PowerPoint 16.0(COM)에서 정상으로 열리고 원본대로 보였다. 폰트·텍스처 준비 신호가 없으면 캡처가 틀린다는 것을 대조 실험으로 확인했다.

## 결과

| 기준 | 결과 |
| --- | --- |
| 특정 `t` 스틸 @2x | ✅ 3840×2160, 반복 캡처 픽셀 동일 |
| 폰트 로딩 누락 없음 | ✅ 준비 신호 후 `document.fonts.check` true. 폰트를 0.8초 늦춰도 결과 동일 |
| 텍스처·WebGL 누락 없음 | ✅ 준비 신호 후 텍스처 큐브 정상 |
| 이미지 PPTX | ✅ 535KB, PowerPoint에서 3장·960×540pt(16:9), 슬라이드당 그림 1개 |
| PDF | ✅ 435KB, 16:9 페이지 3장 |

**대조 실험 (준비 신호를 기다리지 않은 캡처)**

| 조건 | 슬라이드 1(폰트) | 슬라이드 2(텍스처·WebGL) | 슬라이드 3(DOM 차트) |
| --- | --- | --- | --- |
| 폰트가 로컬에서 즉시 로드 | 같음 | **3D 오브젝트가 통째로 빠짐** | 같음 |
| 폰트 다운로드 0.8초 지연 | **대체 폰트로 캡처** | 다름 | **대체 폰트로 캡처** |

## 발견 (Pitfalls)

1. **`document.fonts.ready`만으로는 부족하다.**
   - 원인: 웹 폰트는 텍스트가 실제로 쓸 때 요청된다. 쓰이기 전에는 `fonts.ready`가 먼저 끝날 수 있다.
   - 해결: 런타임이 `DESIGN.md` typography의 폰트 목록으로 `document.fonts.load()`를 명시적으로 호출한 뒤 `fonts.ready`를 기다린다.
2. **텍스처·Canvas는 비동기로 준비된다.** 준비 약속(텍스처 로더 Promise + Canvas `onCreated`) 뒤에 2프레임을 페인트하고 나서 캡처한다. S1의 `sceneReady`와 같은 개념이므로 런타임에 `registerAsset(promise)` API 하나로 통합한다.
3. **HyperFrames `snapshot`의 한계와 위험**
   - 한계: 전체 프레임 @2x 옵션이 없다(`--zoom-scale`은 영역 확대 캡처 전용).
   - 위험: `GEMINI_API_KEY`가 있으면 기본으로 **Gemini 비전 분석**을 실행한다(`--describe`). 생성형 AI 배제(D-006)와 데이터 외부 전송 문제가 있으므로, 쓸 때는 항상 `--describe false`를 붙이고 워커 환경에서 `GEMINI_API_KEY`를 제거한다.
   - 결론: 스틸은 puppeteer-core 직접 캡처로 한다.
4. **PowerPoint COM 자동화로 검증할 수 있다.** 이 PC에서 `PowerPoint.Application` COM으로 열기·도형 수·텍스트 프레임 확인·슬라이드 PNG 내보내기가 된다. S5(편집 가능 PPTX)와 P5 회귀 테스트에 쓸 수 있다(개발 PC 한정, 앱 기능 아님).

## 설계 반영

- 기술 설계서:
  - §2.3 스틸 캡처 ⚠️를 해소했다: puppeteer-core + HyperFrames 관리 `chrome-headless-shell`.
  - §7 image·slides 처리 순서에 준비 신호를 넣었다.
  - §4.1 런타임에 `registerAsset` 준비 API를 추가했다.
- 리스크 문서 §3 진행 현황을 갱신했다.

## Connections

- [[ExportPipeline]], [[DeterministicRendering]], [[HyperFrames]], [[DomToPptx]], [[technical-design]]
