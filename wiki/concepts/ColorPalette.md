---
title: 'ColorPalette'
type: concept
tags: [design-system, palette, review]
sources: [product-spec, technical-design, research-2026-09-29-design-md-hyperframes]
last_updated: 2026-09-29
---

같은 형태(템플릿·코드)의 결과물도 팔레트만 바꿔 다른 느낌을 내게 하는 기능이다(D-016, 사용자 요청 2026-09-29).

- **모델**: 팔레트는 표준 색 역할에 색을 배정한 묶음(`palette.json`)이다.
  - 핵심(필수): `canvas`·`ink`·`primary`·`accent`
  - 파생(없으면 자동, 대비 보장): `surface`·`ink-muted`·`line`·`secondary`·`on-primary`
  - 선택: `data-1~6`
  - S7 확정 → [[poc-s7]]
- **적용**: [[DesignMd]] front matter의 `colors`를 교체하고, 본문은 이전 색 값이 적힌 곳만 갱신한다.
  - 미리보기: [[VanillaBridge]] `setDesign`으로 즉시 반영(< 100ms 목표)
  - 저장: `적용` 시 파일 쓰기와 체크포인트
  - 에이전트는 호출하지 않는다.
- **도구**: 내장 라이브러리(24종 이상), 편집기(OKLCH·잠금), WCAG 대비 경고, 기준색 조화 생성, 자료 이미지 색 추출, 팔레트 비교 스냅샷. 모든 계산은 로컬에서 하며 생성형 AI를 쓰지 않는다.
- **파라미터와의 관계**: `color` 파라미터 기본값이 `{colors.<role>}`이면 팔레트를 따라간다. 사용자가 직접 지정한 값은 교체 후에도 유지된다. → [[UserParameters]]
- **전제 조건**: 코드가 토큰만 써야 교체가 반영된다.
  - 장치: `vanilla-core` 규칙, `check_scene`의 하드코딩 색상 경고([[SceneRuntimeContract]])
  - three.js·셰이더는 `useDesign()`의 값을 uniform으로 받는다.
- **참고 자료**: HyperFrames 프리셋 12종은 모두 캔버스 + 잉크 + 악센트 + 헤어라인 구조다. → [[research-2026-09-29-design-md-hyperframes]]

## Discussed In

- [[product-spec]] — §8.2, §5.7(F-PAL-*)
- [[technical-design]] — §4.4, §5
- [[feasibility-risks]] — §2.10, PoC S7
- [[decisions]] — D-016
- [[poc-s7]] — 교체 p95 34ms, HyperFrames 팔레트 18종 매핑·대비 통과
