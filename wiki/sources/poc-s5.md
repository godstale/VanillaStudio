---
title: 'PoC S5: dom-to-pptx 편집 가능 PPTX 품질'
type: source
tags: [poc, phase-p3, export, slides, pptx]
date: 2026-09-29
source_file: spikes/s5-dom-to-pptx/README.md
sources: [feasibility-risks, technical-design]
last_updated: 2026-09-29
---

## Summary

**결론: 조건부 통과 — Beta 유지(D-003).** `dom-to-pptx` 2.1.2(MIT)로 슬라이드 3장을 약 0.24초 만에 편집 가능한 PPTX(약 1.1MB)로 바꿨고, PowerPoint 16.0에서 열어 확인했다.

- 잘 된 점:
  - 모든 텍스트가 편집 가능한 텍스트 상자로 들어갔다.
  - 위치는 DOM 좌표를 0.5배 환산한 값과 정확히 같았다.
  - SVG는 벡터로 들어갔고, 이미지·2D·WebGL 캔버스는 그림으로 들어갔다.
- 두 가지 조건이 필요하다.
  1. **폰트**: 대상 PC에 설치된 폰트여야 한다. 웹 폰트를 임베드해도 PowerPoint가 화면에 쓰지 않았다.
  2. **줄바꿈 후처리**: 한 줄짜리 텍스트 상자에 `wrap="none"`을 넣어야 한다.

## 결과 (PowerPoint COM 검사)

| 요소 | 결과 |
| --- | --- |
| 제목·본문·목록 텍스트 | ✅ 편집 가능한 텍스트 상자(슬라이드 1: 3개, 슬라이드 2: 7개, 슬라이드 3: 1개), 굵게·기울임 유지 |
| 위치 | ✅ 예: 제목 DOM (120, 260)px → PPT (60, 130)pt (0.5pt/px) |
| 카드(그라데이션·둥근 모서리·테두리) | △ 벡터 그래픽(SVG, type 28)으로 변환. 도형 편집 불가, **그라데이션 각도 틀어짐**, **그림자 소실** |
| 막대(div) | ✅ 도형 |
| 인라인 SVG | ✅ 벡터 |
| 이미지(둥근 모서리) | ✅ 그림 |
| 2D·WebGL 캔버스 | ✅ 그림. WebGL은 `preserveDrawingBuffer: true`여야 캡처됨 |
| 웹 폰트(Instrument Serif) | ❌ PPTX에 임베드되고 PowerPoint도 `Embedded=True`로 인식하지만 화면에는 대체 폰트가 쓰였다(창 없음·있음 모두) |
| 줄바꿈 | ❌ → ✅ 원래 상태에서는 제목·부제목이 두 줄로 넘어가 겹쳤다. 시스템 폰트(Georgia·Arial)로도 같았다. `wrap="none"` 후처리 후 정상 |

## 발견 (Pitfalls)

1. **텍스트 상자 폭이 DOM 폭과 똑같다.**
   - PowerPoint의 글자 폭이 조금만 넓어도 줄이 넘어가 다른 요소와 겹친다. 폰트 문제와는 별개다.
   - 대응: 후처리(`fix-wrap.mjs`)로 "문단당 한 줄 높이"인 상자에 `wrap="none"`을 넣는다(11개 상자 적용).
2. **임베드 웹 폰트를 PowerPoint가 쓰지 않는다.**
   - 원인은 미확정이다(`.fntdata` 형식 호환 문제로 추정). ⚠️
   - 대응: 편집 PPTX용 슬라이드는 **시스템 폰트 또는 사용자가 설치한 폰트**를 쓴다.
   - export 결과 폴더에 폰트 파일과 "설치 필요 폰트" 안내를 같이 둔다.
   - 템플릿 `DESIGN.md`에 "편집 PPTX 호환 폰트" 필드를 둘지 M5에서 결정한다.
3. **그라데이션 각도·그림자**: CSS 160° 그라데이션의 방향이 바뀌었고 `box-shadow`는 사라졌다. 편집 PPTX는 "근사치"라고 UI에 명시하고, 정확한 모습이 필요하면 이미지 PPTX를 쓰도록 안내한다.
4. **의존성 무게**: npm 패키지가 `puppeteer` 전체(설치 시 Chrome 다운로드)와 `@puppeteer/browsers`까지 끌어온다. 앱은 브라우저 번들 `dist/dom-to-pptx.bundle.js`(3.6MB)만 export 워커 리소스로 벤더링한다. 설치할 때는 `PUPPETEER_SKIP_DOWNLOAD=true`.
5. **변환은 빠르다**: 슬라이드 3장에 약 0.24초. 캔버스 선변환(`rasterized-canvas`)은 결과 차이가 없어 필요 없다.

## 설계 반영

- 기술 설계서 §2.3(dom-to-pptx 행)·§7 slides: 번들 벤더링, `wrap` 후처리, 폰트 조건, WebGL `preserveDrawingBuffer`.
- 상세 기획서 F-EXP-05 설명: "시스템/설치 폰트 조건, 근사치"를 추가했다.
- 리스크 문서 §2.4·§2.9(dom-to-pptx MIT 확인)·§3 진행 현황을 갱신했다.

## Connections

- [[DomToPptx]], [[ExportPipeline]], [[poc-s2]], [[technical-design]], [[feasibility-risks]]
