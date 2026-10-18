---
title: 'Research: awesome-opus5-5-videos Analysis & Decomposed Template Architecture'
type: source
tags: [research, templates, motion-graphics, opus-5-5, design-tokens]
date: 2026-10-18
sources:
  - https://github.com/yihui-dev/awesome-opus5-5-videos
  - https://skillry.dev/ai-videos/opus-5-5
last_updated: 2026-10-18
---

## Summary

`yihui-dev/awesome-opus5-5-videos` (MIT 라이선스, 총 703개 항목, 전문 프롬프트 496개) 저장소를 분석하여 [[VanillaStudio]] v2의 가이드 템플릿(`resources/guides/`), 분해형 세부 프리셋(`resources/opus/opus-catalog.json`), 용어집(`glossary.json`), 컬러 팔레트(`resources/palettes/opus-*.json`), 그리고 4대 매체 의도(`web` / `image` / `slide` / `motion`) 추천 엔진(`src/lib/guides/recommend.ts`)으로 내재화한 리서치 및 설계 기록([[decisions]] D-035).

## 1. 원본 데이터셋 구조 및 아키텍처 발견

- **출처**: https://github.com/yihui-dev/awesome-opus5-5-videos (`data/videos.json`)
- **분포**: `motion`(369), `3d`(117), `explainer`(116), `interactive`(101). (D-006 원칙에 따라 생성형 AI 이미지 태그 항목은 제외하고 순수 코드 렌더링 항목만 채택)
- **미리보기 & 라이브 데모**:
  - 포스터 썸네일(`poster_url`): `https://media.skillry.dev/opus-5-5/<slug>/original.<hash>.webp`
  - 실시간 동작 리메이크(`skillry_url`): `https://skillry.dev/ai-videos/opus-5-5/<slug>` 및 원본 X 포스트(`post_url`)
- **고품질 프롬프트의 5대 구조적 특징**:
  1. **120BPM 비트 그리드 및 타임스탬프 아크**: 0.5초 단위 비트 동기화 및 연속 모핑 루프(`t = 0`과 `t = duration` 일치).
  2. **폐쇄형(Closed-Form) 감쇠 스프링 수식**: 프레임 누적 상태 없이 시간 `t`(`useTime()`)의 순수 함수로 위치·크기·곡률 계산([[SceneRuntimeContract]]와 100% 부합).
  3. **타이포그래피 스케일 대비**: `clamp(60px, 9vw, 128px)` 자간 `-0.04em` 모뉴멘털 산세리프 + `Instrument Serif Italic` 강조어 + `tabular-nums` 고정폭 수치 카운터.
  4. **Screen Studio형 커서 안무 & 포커스 줌**: 베지어 곡선 커서 궤적, 클릭 시 `0.88x` 수축 리플, 카메라 `1.6x` 포커스 줌.
  5. **명시적 금지 패턴(`banned`)**: 독립 부유 위젯 남발, 비결정론적 난수, 가짜 브라우저 크롬 등을 명시적으로 금지.

## 2. 세부 항목별 분해(Granular Decomposition) 반영

단일 시퀀스/신 전체 템플릿뿐 아니라 기존 어떤 신에도 조합할 수 있도록 5개 층위로 분해해 등록했다:

1. **내장 특화 가이드 템플릿 12종 (`resources/guides/<type>/opus-*@1`)**:
   - **Web (`static` / `3d`)**: `opus-interactive-hero@1`, `opus-simulator-canvas@1`, `opus-3d-explorer@1`
   - **Image (`motion`)**: `opus-kinetic-poster@1`, `opus-pixel-illustration@1`
   - **Slide (`static` `steps`)**: `opus-narrative-deck@1`, `opus-data-explainer-deck@1`
   - **Motion (`motion` / `3d`)**: `opus-ui-morph-loop@1`, `opus-keynote-launch@1`, `opus-kinetic-manifesto@1`, `opus-science-explainer@1`, `opus-shader-cinematic@1`
2. **세부 구성 프리셋 15종 (`resources/opus/opus-catalog.json` → `decomposedPresets`)**:
   - `scene-beats`: 120BPM 3비트 모프 루프(6초), 키노트 4단계 런치 아크(9초), 키네틱 매니페스토 3막(8초), 3Blue1Brown 수식 유도(10초), 키노트 4단 슬라이드 스텝 구조
   - `typography-style`: 모뉴멘털 키노트 디스플레이, 에디토리얼 세리프+그로테스크 대비, 스위스 그리드 무빙 포스터, 수식·다이어그램 HUD 텔레메트리
   - `motion-effects`: 감쇠 스프링+리퀴드 필 키트, Screen Studio 커서 안무+포커스 줌 키트, 마스크 라이즈+가변 웨이트 비트 펄스 키트, 인터랙티브 샌드박스 컨트롤 독 키트
   - `3d-stage`: 3D 익스플로디드 분해 뷰+PBR 턴테이블, 3D 프리즘 색수차 분산+GLSL 셰이더 달리
3. **컬러 팔레트 8종 (`resources/palettes/opus-*.json`, [[ColorPalette]] WCAG AA 통과)**:
   - Light 4종: `opus-keynote-lime`, `opus-cobalt-cyan`, `opus-spotify-editorial`, `opus-botanical-parchment`
   - Dark 4종: `opus-magnetic-monument`, `opus-orbital-coral`, `opus-cyber-magenta`, `opus-studio-mint`
4. **용어집 기법 20종 추가 (`glossary.json`)**:
   - `one-shape-ui-morph`, `keynote-continuous-launch`, `kinetic-spoken-manifesto`, `pixel-grid-procedural`, `beat-grid-120bpm`, `mask-line-rise`, `variable-weight-beat-pulse`, `orbital-trajectory-baseline`, `closed-form-spring-sum`, `edge-staggered-liquid-pill`, `direct-cursor-choreography`, `screen-studio-cursor-zoom`, `iridescent-conic-halo`, `color-flood-contract`, `interactive-parameter-sandbox`, `multiscale-zoom-comparison`, `stage-with-control-dock`, `spring-morph`, `exploded-cutaway-assembly`, `stained-glass-dispersion`

## Connections

- [[decisions]] — D-035
- [[DesignMd]] · [[ColorPalette]] · [[SceneRuntimeContract]] · [[ui-agent-centric]]
