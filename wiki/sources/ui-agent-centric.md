---
title: 'Agent-Centric UI: 시퀀스·신·템플릿·갤러리 개편'
type: source
tags: [ui, agent-centric, sequence, scenes, templates, playground, comments]
date: 2026-10-17
source_file: Docs/Planning/Decisions.md
sources: [decisions, technical-design, refactor-spec-v2]
last_updated: 2026-10-17
---

사용자 요청(2026-10-17)으로 앱을 에이전트 중심 UI로 개편했다. 브랜치 `feat/agent-centric-ui`. 결정: [[decisions]] D-034. 설계 반영: [[technical-design]] v1.1.

## 한 일

- **코멘트 계약**: `src/lib/scene/comments.ts` — `scenes/<slug>/comments.json` zod 스키마·순수 함수(추가·수정·done/reopen·삭제, history 기록)·정규화 직렬화·파일 입출력. 에이전트가 인식하는 수정 요청 파일(D-034).
- **코멘트 툴박스**: `src/components/comments/CommentToolbox.tsx` — 시퀀스 화면 오버레이와 신 화면에서 함께 쓰는 목록·작성·처리 내역 UI.
- **시퀀스 화면**(기존 워크스페이스): 노드의 에이전트 실행 버튼 제거, 재생 → 신 화면 이동, 신 삭제(휴지통 + `removeNode`), 엣지 편집 플로팅, 코멘트 오버레이. 인스펙터·실행 배선 제거.
- **신 화면**(`/scenes` 구현): 좌측 신 리스트, 가운데 미리보기·계약 검사·코멘트, 인스펙터·터미널은 크기 조절 플로팅 박스(`FloatingPanel`). 분석 실행·diff 검토는 여기서 이어받는다.
- **셸**: 우측 인스펙터·하단 도크 제거, 설정 최하단, 템플릿 메뉴 추가(`/templates`: 종류별 가이드·규칙·체크리스트·용어, 팔레트 24종, 예제는 후속).
- **플레이그라운드**: 썸네일 갤러리 + 기존 시퀀스 재생 유지(온라인 탐색·등록은 후속 문구).
- **검증**: `pnpm lint`·`typecheck`·`test` 통과(1144건).

## 남은 일(후속)

- 신 `AGENTS.md` 렌더에 `comments.json` 읽기 규칙 명시(가이드 템플릿 변경).
- `shell.nav.workspace`·`shell.inspector`·`shell.dock` 등 미사용 문구 정리.
- GUI(`pnpm tauri dev`)·클린 VM·실제 에이전트 데모는 사람 확인 대기(V7과 동일).
