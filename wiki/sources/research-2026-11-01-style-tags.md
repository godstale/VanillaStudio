---
title: 'Research: Google Flow 스타일 태그 200종과 템플릿·스타일 분리'
type: source
tags: [research, templates, styles, design-tokens]
date: 2026-11-01
sources:
  - https://cocojuan.com/googleflow-image-style-tag/
last_updated: 2026-11-01
---

## Summary

cocojuan의 Google Flow 프리셋 태그 글에서 200개 태그를 수집했다(1~50 입체·공예, 51~100 회화·애니메이션, 101~150 레트로·디지털, 151~200 재질·사진). 결정은 [[decisions]]의 D-046.

## 발견

- 원문 태그는 Google Flow 전용 슬래시 명령이라 코드 에이전트에게는 의미가 없다. 그래서 태그마다 키워드·예시 문장을, 17개 구현 계열(family)마다 코드 기법을 붙였다.
- 태그 150번 `/silk screen`만 공백이 있고, 정규식 파싱에서 한 번 빠졌다. id는 `silk-screen`으로 정규화했다.
- 원문의 `thermalvision` 설명은 야간 투시경이라 id를 `night-vision`으로 바꿨다.
- 상표·저작물 지칭 태그 9개(`pixar3d`, `legominifig`, `funkopop`, `barbiebox`, `gtaart`, `simpsonized`, `studioghibli`, `timburton`, `disneyclassic`)는 중립 이름으로 바꾸고 `ipSensitive`로 표시했다.

## Pitfalls

- `applyMarkers`는 빠진 구간을 지우지 않는다. 스타일을 해제해도 낡은 내용이 남지 않도록 `styles` 구간은 비어 있어도 항상 렌더한다.
- `vanilla-agent.mjs`의 `orderSceneObject`는 모르는 키를 버린다. `scene.json` 필드를 추가하면 CLI도 함께 고쳐야 한다. 회귀는 `src/lib/styles/cliParity.test.ts`가 막는다.

## 후속: 예제 라이브러리

항목마다 코드 예제를 붙이는 구조를 D-047로 추가했다. 제작 규칙은 `resources/examples/README.md`, 진행표는 `Docs/Planning/Examples-Backlog.md`.

**교훈**: 앱 안에서 인라인 HTML을 재생하려면 배포판 CSP까지 검증해야 한다. 캡처 이미지로 표시하면 CSP를 넓히지 않고 개발판과 배포판의 동작을 맞출 수 있다.
