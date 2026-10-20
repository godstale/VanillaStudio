---
title: 'Milestone V2: Scene CRUD·지침 생성'
type: source
tags: [milestone, v2, scene, guides]
date: 2026-10-05
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, milestone-v1, technical-design]
last_updated: 2026-10-05
---

브랜치 `feat/v2-scenes`. TODO T2.1~T2.12 완료. 계획: [[implementation-plan]]. 이전: [[milestone-v1]].

## 한 일

- 데이터 계약: `scene.json` zod(static·motion·3d, 정규화 직렬화, `beats` 연속·합=duration, `endCard ≥ 0.7s`, static `advance`는 사용자 입력만), `sequence.json` 스키마(노드 위치 + 엣지 구조, 교차 검증은 V6).
- Rust: 신 폴더 명령(생성·이름 변경·휴지통 삭제·복제, slug 충돌·스코프·심링크 검사).
- 가이드 엔진(`src/lib/guides/`): 마커 렌더(밖 보존), 동기 SHA-256, 템플릿 로더(내장 번들, `<type>/<id>@<ver>`), 내장 템플릿 3종 골격, 신 `AGENTS.md`·`CLAUDE.md`, `GUIDE.md`(해시 헤더로 stale·수동 편집 감지), 프롬프트 조립, 되쓰기 화이트리스트.
- 신 서비스(`src/lib/scene/files.ts`): scene.json 쓰기 + 생성물 재렌더, 목록(검증 실패 보고), 상태 파생(`status.ts`: 엔트리 파일·GUIDE.md 해시 → draft/prompt-ready/generated/needs-revision).
- UI: Scene 노드(상태 배지·길이·레퍼런스 수·폴더 열기), 신 생성 다이얼로그(우클릭·`+`), 노드 위치 저장, 우측 인스펙터(개요·프롬프트 탭, 자동 저장, 이름 변경, 프롬프트 미리보기·복사), 앱 셸 슬롯 포털, 워크스페이스 설정(캔버스·기본 에이전트·templatesDir, 저장 시 전 신 가이드 재렌더), 파일 감시 연결.

## 검증

`pnpm lint`·`typecheck`·`test`(93 파일 645 테스트)·`pnpm build`·`cargo test`(77) 통과.

## 결정·문제·교훈

- 상태는 scene.json의 `status`에 저장하고 파일 상태에서 파생한다. 앱이 `status`를 쓰면 `sceneHash`가 바뀌므로 GUIDE.md도 같이 다시 써서 "stale" 신호가 앱 자신의 쓰기와 섞이지 않게 했다.
- 사용자·에이전트 텍스트 보존: AGENTS.md는 마커 구간만 갱신, CLAUDE.md는 있으면 건드리지 않는다. 처음 테스트 목(mock)이 파일을 목록에 안 보여 사용자 텍스트가 사라지는 것처럼 보였다 — `readOptionalFile`은 디렉터리 목록에 의존하므로 목이 파일도 돌려줘야 한다.
- ref 콜백을 렌더마다 새로 만들면 null↔요소 반복 호출로 무한 갱신이 된다(AppShell 슬롯). `useCallback`으로 고정.
- `react-hooks/set-state-in-effect`: 효과에서 상태 설정 함수를 직접 부르지 말고 `fetch().then(apply)` 형태로 쓴다.
- xyflow 노드는 측정 전까지 `visibility:hidden`이라 jsdom에서 role 쿼리에 `hidden: true`가 필요하다.

## 남은 것 / 알려진 한계

- 신 폴더 밖 쓰기 경고는 `outsideWrites` 헬퍼까지만 있다(활성 신 개념이 생기는 V4에서 UI 연결).
- 인스펙터는 선택한 동안 외부(에이전트) 수정을 반영하지 않는다(재선택 시 반영). 용어 드롭다운·가이드 폼은 V3.
- GUI 실행(`pnpm tauri dev`)과 실제 파일 감시 동작은 사람이 확인해야 한다.

See: [[milestone-v1]], [[implementation-plan]], [[technical-design]]
