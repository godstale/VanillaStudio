---
title: 'Milestone V1: 기반 정리'
type: source
tags: [milestone, v2, foundation]
date: 2026-10-05
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, issue-v2-legacy-removal, poc-r5]
last_updated: 2026-10-05
---

브랜치 `feat/v2-foundation`. TODO T1.0~T1.13 완료. 계획: [[implementation-plan]].

## 한 일

- `v1-final` 태그, 문서 브랜치를 main에 fast-forward(T1.0, push 전).
- 레거시 제거(T1.3·T1.4): ACP `agent_host`·MCP 서버·체크포인트·프로젝트 스캐폴딩(Rust), 파이프라인·검수 UI·ACP 세션·프로젝트 마법사·탭 시스템(TS). 보존 목록과 사용자 확인 내용은 [[issue-v2-legacy-removal]]. `vanilla.json` 읽기 스키마는 `src/lib/migrate/legacy-schema.ts`로 이관.
- 기반: canonical 직렬화(T1.5), `workspace.json` zod·캔버스 프리셋(T1.6), DB 0005·0006 + `workspacesRepo`(T1.7), Rust 워크스페이스 명령(T1.8), 스캐폴딩 템플릿(T1.9).
- UI: v2 앱 셸(T1.10), 온보딩(T1.11), 스위처 + 전환 가드(T1.12), `@xyflow/react` 빈 캔버스와 뷰포트 저장(T1.13).
- PoC R-5 통과([[poc-r5]]): 100노드 60fps.

## 검증

`pnpm lint`·`typecheck`·`test`(80 파일 536 테스트)·`pnpm build`·`cargo test`(68) 통과. 스캐폴딩 결과물에서 `pnpm install && pnpm dev` 기동 확인.

## 데모 상태 (계획서 §2 V1)

| 데모 | 상태 |
| --- | --- |
| ① `v1-final` 태그 | 확인됨 |
| ② 폴더 선택 → `workspace.json`·`AGENTS.md`·`DESIGN.md` 생성 | Rust 테스트(생성·식별 헤더)와 컴포넌트 테스트(온보딩 흐름)로 검증. **실제 `pnpm tauri dev` GUI 실행은 하지 않음** |
| ③ 빈 캔버스 | jsdom 테스트(격자·미니맵·컨트롤·뷰포트 복원)와 스파이크 스크린샷으로 확인. 앱 GUI 실행은 하지 않음 |
| ④ 워크스페이스 전환 | 컴포넌트 테스트로 확인. GUI 실행은 하지 않음 |

GUI 데모 3건은 사람이 `pnpm tauri dev`로 한 번 확인해야 한다.

## 결정·문제·교훈

- 마이그레이션 번호: 설계서의 "0004"는 v1 플레이그라운드가 이미 사용 중이라 0005·0006으로 했다(설계서 갱신).
- 레거시 셸·탭·파이프라인이 서로 얽혀 U1~U4를 한 번에 제거하고 셸을 임시 화면으로 교체한 뒤 T1.10에서 새 셸을 올렸다. 모듈 단위 커밋 원칙은 Rust(1)·TS(1)로만 나눴다.
- 신뢰 확인은 기존 `WorkspaceContext`(localStorage+설정 DB)를 유지하고 `workspaces.trusted`는 아직 쓰지 않는다. V2에서 일원화 여부를 정한다.
- `react-hooks/set-state-in-effect` 린트 규칙 때문에 비동기 로드 결과는 `{root, ws}` 상태에 담아 파생한다.
- Windows bash 환경에서 heredoc의 백슬래시가 소실될 수 있어 정규식·경로가 든 파일은 Edit/Write 도구로 쓴다.
- Claude in Chrome 확장이 연결되지 않으면 puppeteer-core + 로컬 Chrome으로 측정할 수 있다.

See: [[implementation-plan]], [[poc-r5]], [[issue-v2-legacy-removal]]
