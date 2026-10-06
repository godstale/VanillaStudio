---
title: 'v1 프로젝트 마이그레이션 출하 게이트 (T7.5)'
type: source
tags: [issue, v2, migration, release]
date: 2026-10-06
source_file: tests/e2e/v1-migration.mjs
sources: [implementation-plan, technical-design, refactor-spec-v2, milestone-v6]
last_updated: 2026-10-06
---

D-033: "샘플 프로젝트 3종 이상이 손실 없이 재생될 때만 마이그레이션을 출하한다. 미달이면 UI를 숨기고 'v1 앱으로 열기'를 안내한다." 이 문서는 그 판정 기록이다. 계획: [[implementation-plan]], 기획: [[refactor-spec-v2]] §11.1.

## 구현

- 읽기: Rust `read_v1_project`(읽기 전용, 파일 3000개·텍스트 1MB·깊이 12 제한, 심링크·`.vanilla`·`node_modules` 제외). 원본은 어떤 경로로도 쓰지 않는다(테스트가 파일 크기 목록으로 확인).
- 변환 계획: `src/lib/migrate/v1.ts`(순수 함수). 매핑은 `Refactor-Spec-v2.md` §11.1을 따른다.

| v1 | v2 |
| --- | --- |
| `outputType` web·slides / video·image / interactive | `static`(scroll·steps) / `motion` / 사용자 선택 |
| `format` | `workspace.json.canvas`(프리셋이면 프리셋 이름) |
| `src/**` | `scenes/<slug>/src/**` 그대로(+ 새 `src/index.html`) |
| `params/*.values.json` | `scenes/<slug>/params/` |
| `DESIGN.md` | 워크스페이스 `DESIGN.md` |
| `brief/brief.md` | `scene.json.brief` best-effort(목적·대상·메시지·주제), 원문은 `v1-archive/brief.md` |
| `brief/materials/*` | `references/materials/*`, 이미지·영상만 레퍼런스로 등록 |
| `plan/plan.json` | `beats`(영상) / `steps`(슬라이드) / `sections`(웹) 초안, 원문은 `v1-archive/plan.json` |
| `public/`, `assets/CREDITS.md` | 워크스페이스 `public/`, 신 `CREDITS.md` |
| `reviews/`·`exports/`·`prompts/`·`vanilla.json`의 palette·agents·template·runtime·createdAt | 가져오지 않음(변환 미리보기에 이유와 함께 표시) |

- 실행: `applyV1Migration` — 새 빈 폴더에 워크스페이스 생성 → 파일 쓰기·바이너리 복사 → `scene.json`과 가이드 생성물을 **새 workspaceId·sceneId로 다시 렌더**(D-029) → 시퀀스 노드 1개.
- UI: 온보딩의 "v1 프로젝트 가져오기…" 다이얼로그(미리보기 → 변환하지 못한 항목 목록 → 빈 폴더 선택).

## 판정 (2026-10-06)

`pnpm test:e2e:v1`: v1 샘플 3종(`tests/fixtures/v1/{web-landing,video-promo,slides-deck}`)을 앱의 변환기로 변환해 한 워크스페이스에 조립하고 실제 프리뷰 서버·Chrome에서 연다.

| 샘플 | 페이지 오류 | v1 사용자 조절값(params) 보존 | 신 내용 렌더 | 시계 |
| --- | --- | --- | --- | --- |
| web-landing(web → static scroll) | 없음 | "Welcome (tuned)" ✓ | Features 섹션 ✓ | – |
| video-promo(video → motion) | 없음 | "Intro (tuned)" ✓ | – | 흐름 ✓ |
| slides-deck(slides → static steps) | 없음 | "Opening (tuned)" ✓ | 슬라이드 3개 ✓ | – |

**판정: 3종 모두 손실 없이 재생 → 마이그레이션을 출하한다.**

## 한계(솔직한 기록)

- **샘플은 v1 폴더 구조를 따라 새로 만든 대표 샘플**이다(실제 v1 사용자 프로젝트는 이 저장소에 없다). 에이전트가 만든 실제 v1 프로젝트가 쓰는 모든 런타임 기능을 덮지는 못한다. 실제 프로젝트에서 재생이 어긋나면 변환 미리보기의 "변환하지 못한 항목"과 `v1-archive/`로 원인을 좁힌다.
- 변환은 **신 1개**로 합친다(v1 프로젝트 하나 = 신 하나 + 노드 하나, 스펙 §11.1). v1의 여러 Scene은 한 신의 `composition` 안에 그대로 남는다.
- `plan.json`의 에셋·애니메이션·파라미터 선언은 v2 신 스키마에 대응이 없어 보관만 한다.
- 이 변환을 하면서 **런타임 결함 하나를 고쳤다**: 신별 `params/`가 읽히지 않던 문제(`paramsForPath`). 이 수정 없이는 v1 조절값이 사라졌다.
- GUI(`pnpm tauri dev`)에서 온보딩 → 변환 → 열기 흐름은 실행해 보지 않았다.

See: [[implementation-plan]], [[refactor-spec-v2]], [[milestone-v6]]
