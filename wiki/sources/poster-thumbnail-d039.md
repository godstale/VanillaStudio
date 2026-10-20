---
title: '신 공유 썸네일 poster.svg (D-039)'
type: source
tags: [thumbnail, poster, scene-guide, v2]
date: 2026-10-21
source_file: Docs/Planning/Decisions.md
sources: [decisions, refactor-spec-v2, technical-design]
last_updated: 2026-10-21
---

## 문제

미리보기를 한 번도 열지 않은 신은 시퀀스 화면·신 카드에 썸네일이 비어 보인다.
기존 썸네일은 미리보기 Bridge 캡처를 `scenes/<slug>/.vanilla/thumb.png`에 저장하는 방식이라
로컬 전용·공유 제외이며, 각 신을 미리보기로 열어 `ready`가 되어야 생성된다.
27개 신 슬라이드 워크스페이스(`tests/LLM_and_Vibe_Coding_Day01_v2`)가 전부 비어 있던 원인이다.

## 결정 (D-039 Proposed)

- 신 폴더에 `poster.svg`(16:9, 코드로 그린 SVG, `DESIGN.md` 토큰만 사용)를 두고 커밋·공유한다.
- 생성형 이미지/영상 AI 금지(D-006 준수): 셰이프·텍스트로 그리며 레퍼런스 픽셀·외부 파일을 넣지 않는다.
- 앱 표시 순서: 자동 캡처(`thumb.png`) 우선, 없으면 `poster.svg` 폴백. `scene.json` 스키마 변경 없음.

## 구현

- `src/lib/scene/thumbnail.ts`: `posterRel`·`loadPoster`·`loadSceneThumbnail` 추가.
- `src/components/scene/SceneWorkspace.tsx`: `loadThumbnail` → `loadSceneThumbnail` 교체.
- `src/lib/guides/agentsMd.ts`: Output contract에 `poster.svg` 작성 지침 추가(전 타입 공통).
- `resources/guides/static/web-page@1/rules.md`·`checklist.md`: 포스터 지침·체크 추가(`opus-narrative-deck@1` 등 자식 템플릿에 병합 전파).
- `Docs/Planning/Decisions.md`: D-039 Proposed 추가. `Docs/Planning/Refactor-Spec-v2.md` §4 파일 트리에 `poster.svg` 추가.
- 테스트: `thumbnail.test.ts`(폴백 순서·SVG 거부), `render.test.ts`(전 타입 contract 언급). 전체 `pnpm lint`·`typecheck`·`test`(1030) 통과.

## 남은 일

- D-039 사용자 승인(Proposed → Accepted).
- 기존 워크스페이스는 `pnpm vanilla sync-guides <slug>` 재렌더 후 에이전트에게 포스터 생성을 시켜야 반영된다.
- fix 브랜치의 새 신 화면(Scenes/Playground 갤러리)에도 `loadSceneThumbnail` 적용 필요(해당 브랜치 병합 시).
