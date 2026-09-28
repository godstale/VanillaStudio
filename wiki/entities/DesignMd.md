---
title: 'DesignMd'
type: entity
tags: [design-system, format, standard]
sources: [research-2026-09-29-design-md-hyperframes, product-spec, technical-design]
last_updated: 2026-09-29
---

**DESIGN.md**는 코딩 에이전트에게 디자인 시스템을 전달하는 Google Labs의 오픈 형식이다(Apache-2.0, 2026-04 공개, `alpha`).

- 구조: YAML front matter 토큰(`colors`·`typography`·`spacing`·`rounded`·`components`, 토큰 참조 `{colors.primary}`)과 마크다운 본문(Overview → Colors → Typography → Layout → Elevation & Depth → Shapes → Components → Do's and Don'ts)으로 이루어진다.
- CLI: `@google/design.md`(`lint`·`diff`·`export`·`spec`).

**Vanilla Studio에서의 역할** (D-015)

- 프로젝트 루트 `DESIGN.md`가 색·타이포·간격의 단일 진실 공급원이다.
- 흐름: 템플릿의 DESIGN.md → Brief 단계에서 팔레트를 적용한 초기본 → Plan 단계에서 에이전트가 다듬고 사용자가 승인 → 이후 토큰 값은 사용자 소유.
- 바인딩: 런타임 Vite 플러그인이 CSS 변수 `--ds-*`와 `useDesign()`으로 제공한다(기술 설계서 §4.4).
- 영상 프로젝트는 HyperFrames의 `frame.md`로 모션·페이싱 지침을 보조한다.
- 팔레트 교체는 `colors`만 바꾼다. → [[ColorPalette]]

## Pitfalls

- alpha 형식이라 바뀔 수 있다. 자체 스키마로 관대하게 읽고, 모르는 키는 보존하고, CLI는 버전을 고정한다.
- 본문에 hex를 적으면 팔레트 교체 후 설명과 값이 어긋난다. 본문에서는 역할 이름으로만 색을 설명한다.

## Appearances

- [[research-2026-09-29-design-md-hyperframes]] — 형식 조사
- [[product-spec]] — §8.1
- [[technical-design]] — §4.4
- [[decisions]] — D-015
