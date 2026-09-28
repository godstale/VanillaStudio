---
title: 'PoC S7: DESIGN.md 토큰 파이프라인 + 팔레트 교체'
type: source
tags: [poc, phase-p3, design-system, palette]
date: 2026-09-29
source_file: spikes/s7-design-tokens/README.md
sources: [feasibility-risks, technical-design, research-2026-09-29-design-md-hyperframes]
last_updated: 2026-09-29
---

## Summary

**결론: 통과(설계 4곳 수정).** Vite 가상 모듈로 `DESIGN.md`를 읽어 CSS 변수와 `useDesign()`으로 제공하는 방식을 확인했다.

- Bridge 팔레트 교체는 p95 34ms(2프레임 대기 포함)였다. DOM과 R3F가 함께 바뀌었고, 레이아웃은 그대로였으며, 원래 팔레트로 되돌리면 픽셀 단위로 같았다.
- `DESIGN.md` 파일을 수정하면 HMR로 약 26ms 안에 반영됐다.
- `colors` 교체 후에도 본문과 다른 토큰은 바이트 단위로 보존됐다.
- HyperFrames 팔레트 18종 모두 Vanilla 역할로 표현했고, 대비 검사를 통과했다.

## 결과

| 기준 | 결과 |
| --- | --- |
| 가상 모듈 + CSS 변수·`useDesign()` | ✅ 생성 파일 없이 동작. R3F 재질은 `useDesign().colors` 사용 |
| 교체 반영 < 100ms (DOM·R3F) | ✅ p50 32.6ms / p95 33.8ms (40회) |
| 색만 바뀌고 형태 유지 | ✅ 요소 5개의 위치·크기 동일, 픽셀은 다름 |
| 되돌리기 | ✅ override 해제 시 원래 화면과 픽셀 동일 |
| 파일 수정 → HMR | ✅ p50 26ms / max 39ms |
| `colors`만 다시 쓰기 | ✅ 본문·다른 front matter 바이트 보존, 왕복 시 파일 완전 복원, CRLF 유지 (단위 테스트 10개) |
| 공식 CLI `lint` | ✅ errors 0. 경고는 `orphaned-tokens`뿐(Scene 코드가 쓰는 역할 토큰이라 예상된 경고) |
| 표준 역할로 프리셋 표현 | ✅ HyperFrames 팔레트 18종(프리셋 12 + 범용 6) 모두 대비 기준 통과 |

## 설계 수정 사항

1. **CSS 변수 이름**: `--ds-*` 대신 공식 CLI `export --format css-vars`와 같은 `--color-<name>`, `--spacing-<name>`, `--rounded-<name>`을 쓴다. 표준 도구·Tailwind v4와 이름이 맞는다.
2. **색 역할**: 필수 8개 → **핵심 4개 필수(`canvas`·`ink`·`primary`·`accent`) + 파생 5개**(`surface`·`ink-muted`·`line`·`secondary`·`on-primary`)로 바꿨다.
   - 파생 역할은 없을 때만 OKLCH 혼합으로 채운다.
   - `ink-muted`는 canvas 대비 3:1 이상이 될 때까지 혼합 비율을 줄인다.
   - `on-primary`는 ink·canvas·흰색·검정 중 대비가 가장 큰 것을 고른다.
   - 고정 비율로 파생하면 18종 중 2종이 대비 미달이었다.
3. **본문 hex 규칙**: "본문에 hex 금지"는 표준과 맞지 않는다(명세 예제가 `Primary (#1A1C1E)`처럼 적는다). 팔레트를 적용할 때 **본문에 적힌 이전 색 값을 새 값으로 함께 바꾼다**(`updateProse`, 샘플에서 3곳 갱신).
4. **front matter 없는 DESIGN.md**: HyperFrames 저장소의 `DESIGN.md`처럼 표만 있는 산문 파일이 실제로 있다.
   - 파서는 "토큰 없음"으로 알린다.
   - 앱은 본문을 그대로 둔 채 front matter를 앞에 추가하거나, 에이전트에게 토큰 작성을 요청한다.

## 발견 (Pitfalls)

- **역할 이름의 의미가 생태계마다 다르다.**
  - `primary`: Google 명세 예제에서는 글자색, Material에서는 브랜드색, HyperFrames에서는 배경(라이트)이거나 글자(다크)다.
  - HyperFrames의 `tertiary`는 surface가 아니라 중간 톤 보조색이다. surface로 매핑하면 ink/surface 대비가 1.28까지 떨어졌다.
  - 그래서 Vanilla는 기능 이름(canvas·ink)을 쓴다. 외부 팔레트는 밝기와 scheme 기준으로 매핑한다.
- **HyperFrames 프리셋 모델**(사이트 번들 분석): 프리셋(형태)마다 `defaultPalette`·`defaultFontPairId`·`scheme`·`density`·`supportedTones`·`colorTokens`(추가 색)를 가진다. 팔레트는 `{primary, secondary, tertiary, accent} + extras`다. **형태·팔레트·폰트 페어 분리**가 D-016·F-DSN-08과 같은 구조임을 확인했다.
- **CLI는 stdin이 열려 있으면 멈춘다.** `npx @google/design.md spec`이 입력을 기다리며 멈췄다. 앱의 워커는 stdin을 닫고(`stdio: ['ignore', …]`) 실행한다.
- **Vite 가상 모듈 HMR 요령**: 가상 모듈은 `handleHotUpdate`에서 무효화하고 모듈을 반환한다. 런타임 쪽에서는 `import.meta.hot.accept('virtual:vanilla/design', …)`로 받는다. 파일이 깨졌을 때는 마지막 정상 토큰을 유지하고 경고만 낸다.

## 설계 반영

- 상세 기획서 §8.1·§8.2: 역할 표(4+5), 본문 hex 갱신 규칙, CSS 변수 이름을 고쳤다.
- 기술 설계서 §4.4: ⚠️를 해소하고 파생 규칙·lint 필터·CLI 실행 방식을 추가했다.
- 결정 기록 D-016에 S7 확정 내용을 추가했다.
- 리스크 문서 §2.10을 갱신했다.

## Connections

- [[DesignMd]], [[ColorPalette]], [[HyperFrames]], [[research-2026-09-29-design-md-hyperframes]], [[technical-design]], [[product-spec]]
