---
title: 'UserParameters'
type: concept
tags: [review, customization]
sources: [product-spec, feasibility-risks]
last_updated: 2026-09-29
---

요구사항의 "사용자 수동 조절"을 구현 가능한 형태로 만든 개념(D-007). 기획서(`plan.json`)에 조절 가능 범위를 파라미터로 선언 → 코드에서 `defineScene`의 `params`로 등록 → 검수 스튜디오 파라미터 패널에서 폼으로 조절 → `params/<scene>.values.json`에 저장. 에이전트는 요청 없이 값 파일을 덮어쓰지 않는다(원칙 P5). 타입: color, number, text, select, boolean, vec2, vec3. `color` 기본값으로 토큰 참조 `{colors.<role>}`를 권장하며, 우선순위는 코드 기본값 < [[DesignMd]] 토큰 < 사용자 값이다. 팔레트 교체와의 관계는 [[ColorPalette]]. 관련: [[SceneRuntimeContract]]

## Discussed In

- [[product-spec]] — §3.5, §7.1
- [[feasibility-risks]] — §2.3
- [[decisions]] — D-007
