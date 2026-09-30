---
title: 'Milestone M6: 템플릿·플레이그라운드 (스킬·내장 3종·팔레트 24종·갤러리·플레이그라운드)'
type: source
tags: [milestone, phase-p4, m6]
date: 2026-09-30
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, parallel-execution, decisions, technical-design]
last_updated: 2026-09-30
---

## Summary

M6은 품질을 끌어올리는 템플릿과 결과 보관(플레이그라운드)을 구현했다. 웨이브 4 레인 K(T6.1) → 웨이브 5 레인 T2(T6.2) → 웨이브 6 레인 Q1(T6.3·T6.9)·Q2(T6.4·T6.5·T6.6·T6.7)·Q3(T6.8·T6.10) → 웨이브 7 레인 W2(T6.11, 본 항목)로 진행했고, 모두 `feat/m2-agents` 계열에 병합했다. T6.11 데모는 계획서 M6 완료 기준 ①~④를 자동화 가능한 범위에서 수행했다(실제 에이전트 Build→export 품질 확인·PowerPoint·깨끗한 VM은 제외하고 명시). main 병합·push는 사용자 승인 대기.

## 한 일

| 레인 | 항목 | 결과 |
| --- | --- | --- |
| K 스킬 (W4) | T6.1 | `vanilla-core` 스킬(`resources/skills/vanilla-core/SKILL.md`: 런타임 계약·DESIGN.md 규칙·파이프라인 파일 규칙·심미 체크리스트, 계약 버전 명시) |
| T2 템플릿 설치 (W5) | T6.2 | `template.json`·`palette.json` 스키마 + 설치 계획(`src/lib/templates/*`: 필수 파일 검증·안전 경로·`.claude/skills`+`.agents/skills` 이중 기록, 바이트 복사는 Rust 측) |
| Q1 팔레트 확장 (W6) | T6.3·T6.9 | 내장 팔레트 24종(`resources/palettes/*.json`, 라이트/다크·무드 태그, 대비 전부 통과) + 추출·조화 생성·비교 스냅샷(`src/lib/design/extract.ts`·`harmony.ts`) |
| Q2 템플릿·갤러리 (W6) | T6.4·T6.5·T6.6·T6.7 | 내장 템플릿 3종(에디토리얼 슬라이드·3D 제품 쇼케이스 영상·키네틱 타이포 웹, 각 DESIGN.md·palette.json·예제·미리보기·SKILL.md·CREDITS.md) + 갤러리(`src/components/templates/*`, 미리보기·태그·유형·팔레트 바꿔 보기) |
| Q3 플레이그라운드 (W6) | T6.8·T6.10 | 저장소·인덱스·플레이어(`src/lib/playground/*`, `src/components/playground/*`: 웹 iframe·video·이미지·PDF) + 템플릿 가져오기·태그·검색·`frame.md`·DESIGN.md IO·사용자 팔레트 IO |
| W2 마무리 (W7) | T6.11 | 데모 ①~④ 자동화 범위 수행 + 본 기록 |

## 데모 ①~④ (계획서 M6 완료 기준)

| # | 데모 | 자동화 수행 결과 |
| --- | --- | --- |
| ① | 내장 템플릿 3종으로 새 프로젝트 | `builtin.test.ts`(3종 × 5 계약 검사) 통과: 필수 스킬 파일 존재·`template.json` 유효·manifest 포인터(designFile·preview) 해결·예제 tsx 존재·`palette.json` 유효+`defaultPalette` 일치·DESIGN.md 파싱 이슈 0+대비 전부 통과·미리보기 SVG CSS 변수 리틴트·예제 `defineScene`+금지 시간 API 0건+`param.*` 노출+색 리터럴 0건. 설치 트리는 `install.test.ts`(안전 경로·필수 파일·이중 skill root) 통과. 실제 마법사 클릭·Build·export 품질 확인은 제외 |
| ② | 템플릿 갤러리 | `TemplateGallery.test.tsx`·`TemplatesPanel.test.tsx`(4: 첫 탭 갤러리 표시·내장 팔레트 검색·scheme 필터) 통과. 갤러리→마법사 선택 배선은 웨이브 7 레인 W1 인계(본 레인 범위 밖) |
| ③ | 내장 팔레트 24종 | `resources/palettes/` 24파일 존재 확인 + `palettes.test.ts`(스키마·검색·대비)·`design.test.ts`(S7 이관 10개)·`extract.test.ts`·`harmony.test.ts` 통과. Q1 병합 시 "대비 전부 통과" 기록 유효 |
| ④ | export 결과를 플레이그라운드에서 재생 | `playgroundRepo`·`store`·`PlaygroundContext`·`PlaygroundPanel`(완료된 export 작업 추가·재생)·`PlayerTab`(웹·video·이미지·PDF)·`PlaygroundExtras`(태그·검색)·`templateImport`·`frameMd`·`designIo`·`paletteIo` 테스트 통과. M6 영역 22파일 124테스트 전부 통과 |

**제외 항목(자동화 불가, 명시)**: 실제 에이전트로 템플릿 3종 × 팔레트 2종 Build→export 품질 비교, PowerPoint에서 편집 PPTX 확인(M5 이월과 동일), 깨끗한 Windows VM(T7.2). 수동 확인은 T7.2·사용자 확인으로 이월한다.

## 검증(최종)

- `pnpm lint` 통과(경고 0), `pnpm typecheck` 통과(루트+`packages/runtime`·`packages/export-worker`)
- `pnpm test`: 107파일 722테스트 전부 통과(M6 영역 22파일 124테스트 포함)
- Rust 변경 없음(`cargo test` 재실행 제외, 웨이브 5~6 기록 유효: 165 통과·0 실패·4 ignored)

## 결정·문제·해결

- 새 결정 불필요. D-006(생성형 AI 배제: 템플릿 전부 자체 제작 코드+CC0 표기)·D-008(스킬 이중 기록)·D-011(시간 함수 계약)·D-015/D-016(토큰·팔레트 계약) 준수, 위반 없음
- W1 인계 확인(본 레인에서 고치지 않음): 갤러리 onSelect → NewProjectWizard 적용 배선, `vanilla-export.mjs` 번들 연결, `slidesEditable` evaluate·`cwd=projectDir` 수정 — 웨이브 7 레인 W1·W3 범위
- Pitfalls
  - 미리보기 SVG는 팔레트 바꿔 보기를 위해 하드코딩 fill 없이 `var(--color-*)`로만 칠한다(`builtin.test.ts`가 강제)
  - 예제 코드의 색 리터럴은 `param.color` 폴백 또는 `// ds-ignore`(셰이더·투명 오버레이)만 허용한다. HTML 엔티티(`&#9670;` 등)는 검사에서 제외된다
  - `BUILT_IN_PALETTES`는 명시 import 목록이다. `resources/palettes/`에 파일을 추가하면 `src/lib/design/palettes.ts`에도 한 줄을 추가한다

## 남은 일(M6 이후)

- 수동 확인 이월: 템플릿 3종 × 팔레트 2종 결과 비교, PowerPoint 편집 PPTX 확인, 깨끗한 VM 설치·실행 — T7.2·사용자 확인
- 코드 잔여 없음: T6.1~T6.10 전부 체크, T6.11 본 항목으로 마감. M6 이후는 M7 릴리스 준비(T7.1·T7.3·T7.4, T7.2·T7.5는 사용자·인증서 필요)

## Connections

[[implementation-plan]] · [[parallel-execution]] · [[decisions]] · [[technical-design]] · [[DesignTemplateSkill]] · [[ColorPalette]] · [[Playground]] · [[DesignMd]] · [[SceneRuntimeContract]] · [[milestone-m5]]
