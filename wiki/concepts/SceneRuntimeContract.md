---
title: 'SceneRuntimeContract'
type: concept
tags: [runtime, architecture]
sources: [technical-design]
last_updated: 2026-09-28
---

`@vanilla/runtime`이 정의하는 생성물 코드 계약(D-011, Proposed). Scene은 `defineScene({id, duration, params, Component})`로 등록하는 React 컴포넌트, 애니메이션은 `useTime()`의 `t`에 대한 순수 함수, 파라미터는 `useParams()`, 입력은 `useInput()`. 모드: preview(호스트 제어)·render(HyperFrames seek)·live(실시간). 금지 API: `Date.now`, `performance.now`, 시드 없는 `Math.random`, 자체 rAF 루프. R3F는 `frameloop="demand"`. 검사 도구 `check_scene`.

관련: [[DeterministicRendering]], [[VanillaBridge]], [[UserParameters]]

## Discussed In

- [[technical-design]] — §4
- [[product-spec]] — §7.3
