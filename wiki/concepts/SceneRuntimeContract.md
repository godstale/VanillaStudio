---
title: 'SceneRuntimeContract'
type: concept
tags: [runtime, architecture]
sources: [technical-design]
last_updated: 2026-09-29
---

`@vanilla/runtime`이 정의하는 생성물 코드 계약(D-011, Accepted 2026-09-29). **유형별 시간 모드**: `video`·`image`·`slides`는 clock 계약(아래 순수 함수 규칙 필수), `web`·`interactive`는 free 모드(실시간 애니메이션 허용, 스크러버 없음). 파라미터·디자인 토큰 규칙은 모든 유형에 공통. Scene은 `defineScene({id, duration, params, Component})`로 등록하는 React 컴포넌트, 애니메이션은 `useTime()`의 `t`에 대한 순수 함수, 파라미터는 `useParams()`, 입력은 `useInput()`. 모드: preview(호스트 제어)·render(HyperFrames seek)·live(실시간). 금지 API: `Date.now`, `performance.now`, 시드 없는 `Math.random`, 자체 rAF 루프. R3F는 `frameloop="demand"`. 검사 도구 `check_scene`(v0.2부터 하드코딩 색상 경고 포함). 디자인 토큰: CSS `var(--ds-*)`, JS `useDesign()`. `DESIGN.md`는 런타임 Vite 플러그인이 가상 모듈로 읽는다(§4.4, [[DesignMd]]).

관련: [[DeterministicRendering]], [[VanillaBridge]], [[UserParameters]]

## Discussed In

- [[technical-design]] — §4
- [[product-spec]] — §7.3
