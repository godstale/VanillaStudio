---
title: 'Research 2026-09-29: DESIGN.md·HyperFrames 프리셋·카탈로그'
type: source
tags: [research, design-system, palette, template, phase-p2]
date: 2026-09-29
source_file: ''
sources: []
last_updated: 2026-09-29
---

## Summary

P2 보강 때 조사한 자료다. 사용자가 두 가지를 요청했다. 하나는 컬러 팔레트 기능과 `DESIGN.md` 표준 활용을 기획에 넣는 것, 다른 하나는 HyperFrames 예제 두 곳을 템플릿 참고 자료로 보관하는 것이다. 조사 결과는 기획서 §8, 결정 D-015~D-017, PoC S7로 반영했다.

## 1. DESIGN.md 형식 ([[DesignMd]])

- 출처: https://github.com/google-labs-code/design.md (Google Labs, Apache-2.0)
- 공개 시점: 2026-04-21, Stitch 내부 형식을 오픈소스로 공개했다. 현재 버전은 `alpha`이며 스키마·CLI가 계속 바뀌고 있다.
- 파일 구조: YAML front matter(기계용 토큰)와 마크다운 본문(의도·사용 원칙)으로 이루어진다.
  ```yaml
  version: alpha
  name: <string>
  description: <string>
  colors:      { <token>: "#1A1C1E" | "oklch(62% 0.18 250)" }
  typography:  { <token>: { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, fontFeature, fontVariation } }
  rounded:     { <level>: 8px }
  spacing:     { <level>: 16px | number }
  components:  { <name>: { <token>: "{colors.primary}" } }   # 토큰 참조
  ```
- 본문 절 순서: Overview → Colors → Typography → Layout → Elevation & Depth → Shapes → Components → Do's and Don'ts. 절은 선택이며, 쓰는 경우 이 순서를 지킨다.
- CLI `@google/design.md`:
  - `lint`: 구조를 검사하고 결과를 JSON으로 출력한다. 대비(WCAG) 검사도 포함한다.
  - `diff`: 두 파일을 비교하고, 회귀가 있으면 exit 1로 끝난다.
  - `export`: `json-tailwind`·`css-tailwind`·`dtcg` 형식으로 내보낸다.
  - `spec`: 형식 명세를 출력한다.
- 참고 기사: https://the-decoder.com/googles-open-source-design-md-gives-ai-agents-a-prompt-ready-blueprint-for-brand-consistent-design/

## 2. HyperFrames FRAME.MD와 디자인 프리셋 ([[HyperFrames]])

- 출처: https://www.hyperframes.dev/design (설명: https://www.therundown.ai/tools/frame-md)
- FRAME.MD(`frame.md`, 소문자 파일명)의 역할:
  - `design.md`의 브랜드를 16:9 영상 프레임에 맞게 옮긴 사양이다. 구도·스케일·타이포·색·간격에 더해 **페이싱·체류 시간(dwell)·모션**을 담는다.
  - 형식은 YAML 토큰과 마크다운 의도로 DESIGN.md와 같다.
  - 두 파일이 모두 있으면 HyperFrames는 frame.md를 우선 적용한다.
  - 웹 변환기에 design.md를 올리거나 프리셋을 고르면 frame.md를 받을 수 있다. Fine-tune으로 조정도 가능하다.
- 라이선스: 소개 자료 기준 Apache-2.0이다. ⚠️ 프리셋별 폰트 라이선스는 확인해야 한다.
- **프리셋 12종** (내장 DESIGN.md·팔레트·타이포 페어링의 참고)

  | 프리셋 | 스타일 요약 |
  | --- | --- |
  | Biennale Yellow | 따뜻한 양피지 + 태양빛 노랑, Instrument Serif 디스플레이, 인디고 잉크, 1px 헤어라인 |
  | BlockFrame | 맥시멀 네오브루탈리즘: 두꺼운 검은 테두리, 하드 오프셋 그림자, 캔디 악센트 |
  | Blue Professional | 코퍼레이트 양피지 + 코발트 주색, Space Grotesk 디스플레이, Inter 본문 |
  | Bold Poster | Shrikhand 기울인 디스플레이 + 크림 위 레드: 잡지 표지 느낌 |
  | Broadside | 산업용 신문 포스터: 잉크 위 크림, Barlow 디스플레이, 파이어 오렌지 |
  | Capsule | 알약형 에디토리얼: 크림 종이, 캔디 팔레트, Bodoni Moda 헤드라인 |
  | Cartesian | 미니멀·여백: 따뜻한 양피지, 잉크 디스플레이, 토프 악센트, 헤어라인 |
  | Cobalt Grid | 에디토리얼 양피지 + 코발트 그리드, Newsreader 디스플레이, Hanken Grotesk 본문 |
  | Coral | Bebas Neue 대문자 헤드라인 + 크림 위 코랄, Inter 본문 |
  | Creative Mode | 크림 + 채도 높은 캔디 악센트, Archivo Black 디스플레이, JetBrains Mono 데이터 |
  | Daisy Days | 정원 파스텔, 3px 차콜 외곽선, 하드 오프셋 그림자, Fredoka + Quicksand |
  | Editorial Forest | 그린/핑크/크림 3색, Source Serif 4 디스플레이, JetBrains Mono, 헤어라인 |

- 관찰: 12종 모두 **캔버스(종이색) + 잉크 + 악센트 1~2개 + 헤어라인** 구조다. [[ColorPalette]]의 표준 역할(`canvas`·`ink`·`accent`·`line` 등)로 표현할 수 있어 보인다. S7에서 확인한다.
- HyperFrames가 DESIGN.md를 쓰는 방식:
  - 출처: https://github.com/heygen-com/hyperframes/blob/main/docs/guides/open-design-hyperframes.md
  - DESIGN.md의 palette·typography를 `:root`에 그대로 바인딩한다(`--bg: var(--ds-canvas)`, `--ink: var(--ds-foreground)`, `--accent: var(--ds-accent)`).
  - 원칙은 "never hard-code a hex from memory"다. Vanilla의 토큰 바인딩(기술 설계서 §4.4)과 같은 발상이다.

## 3. HyperFrames 카탈로그

- 출처: https://hyperframes.heygen.com/catalog
- 참고 문서: 전체 색인 https://hyperframes.heygen.com/_llms/catalog.md, 기여 가이드 https://hyperframes.heygen.com/contributing/catalog.md, 검색 https://hyperframes.heygen.com/developers/catalog-search.md
- **분류(항목 수)**

  | 분류 | 항목 수 |
  | --- | --- |
  | 3D Motion | 7 |
  | Carousels | 25 |
  | Text & Captions | 73 |
  | Code | 12 |
  | Transitions | 31 |
  | Data & Charts | 18 |
  | Scenes & Demos | 95 |
  | Motion & Effects | 94 |
  | Surfaces | 18 |
  | Blocks | 14 |

  - 3D Motion 예: Canopy Part Title, Code Slice Hero, Cuboid Carousel, Frost Sequence Camera Orbit, Glass Shard Title, Orbit Card, Wireframe Portal Title
  - Carousels 예: Circle·Orbit·Path·Text+Circle·Vision 계열, 계열마다 5종
  - 텍스트 모션 예: Per-Word Rise, Kinetic Slam, Headline Slam. 캡션 스타일: Neon Glow, Glitch RGB, Particle Burst, Emoji Pop, 손글씨
- 항목 구조:
  - 위치: `registry/blocks/<name>/`(독립 컴포지션, 크기·길이 고정) 또는 `registry/components/<name>/`(다른 컴포지션에 삽입, `demo.html` 포함)
  - `registry-item.json` 필드: `name, type, title, description, tags`, 블록은 `dimensions, duration`. 선택 필드: `params`(color·text·number·select), `author`, `license`, `registryDependencies`
- 기술 조건:
  - `window.__timelines`에 등록한 **paused GSAP timeline**
  - `Date.now()`·시드 없는 `Math.random()`·실시간 루프 금지
  - 어느 프레임으로 이동해도 정확히 그려져야 한다
- 설치·검색: `npx hyperframes add <name>`, `hyperframes catalog --query "<text>"`(로컬 임베딩 검색)

## Vanilla Studio에 주는 시사점

- 에이전트 공통 디자인 전달 파일로 `DESIGN.md`를 채택했다(D-015). 영상에는 `frame.md`를 보조로 쓴다.
- 팔레트는 DESIGN.md `colors` 토큰의 교체로 구현한다(D-016). 프리셋 12종의 구조가 역할 기반 팔레트 모델을 뒷받침한다.
- 카탈로그 항목의 `params`는 우리 [[UserParameters]]와 같은 개념이다. 결정성 규칙도 [[SceneRuntimeContract]]와 같다. 참고 가치가 높다.
- 다만 카탈로그 항목은 GSAP 기반이므로 **참고만 하고 런타임으로 재구현**한다. 항목별 라이선스도 확인한다(D-017, [[GSAP]]).

## Connections

- [[DesignMd]], [[ColorPalette]], [[HyperFrames]], [[DesignTemplateSkill]], [[decisions]], [[product-spec]]
