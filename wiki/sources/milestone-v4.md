---
title: 'Milestone V4: 터미널 실행·재생'
type: source
tags: [milestone, v2, terminal, preview]
date: 2026-10-06
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, milestone-v3, technical-design, poc-agent-terminal]
last_updated: 2026-10-06
---

브랜치 `feat/v2-run`. TODO T4.1~T4.11 완료(GUI·실제 에이전트 데모는 사람 확인 대기). 이전: [[milestone-v3]]. 계획: [[implementation-plan]].

## 한 일

- **에이전트·터미널(T4.1~T4.4)**: 레지스트리(고정 argv, 편집 시 확인), 신뢰된 폴더에서만 시작하는 PTY(`run_agent`), 터미널 도크(신별 탭·재연결), 프롬프트 클립보드 전달과 선택적 auto-paste.
- **결과 판정(T4.5)**: `scene.json` 재검증·엔트리 확인·화이트리스트 밖 변경 경고·`.vanilla/history/` 스냅샷·diff 승인/되돌림.
- **런타임·미리보기(T4.6, T4.7)**: Bridge v2(`step`·`done`·`choice`·`next`·`prev`), canvas 주입, 프리뷰 서버(워크스페이스 루트 멀티 서빙), 신 미리보기 패널.
- **썸네일(T4.8)**: 헤드리스 브라우저 없이 미리보기 Bridge의 기존 `capture`를 써서 `.vanilla/thumb.png`에 저장(Rust `write_binary_base64`/`read_binary_base64`, 워크스페이스 스코프 검사 동일). 미리보기가 `ready`가 될 때(HMR 포함) 갱신하고 motion·3d는 길이의 30% 지점에서 찍는다.
- **계약 검사(T4.9)**: `resources/workspace-template/scripts/check-scene{,-core}.mjs`. 앱 [검사] 버튼과 `pnpm check:scene`이 같은 코어를 공유하고 `.vanilla/self-check.md`를 쓴다. 금지 시간 API·하드코딩 색(경고)·`defineScene`·beats/endCard·Text Fidelity(`exact`).
- **상태 머신·재생성(T4.10)**: needs-revision이면 노드 버튼이 [재생성]이 되고 revise 프롬프트에 마지막 확정본 대비 바뀐 필드를 싣는다(`scene/revision.ts`). 신 폴더 밖 쓰기 경고를 UI에 연결(실행 중 신이 여럿이면 어느 신에도 속하지 않는 경로만).
- **통합·E2E(T4.11)**: 목 에이전트 통합 테스트와 `pnpm test:e2e:agent`. 매트릭스: [[poc-agent-terminal]].

## 검증

`pnpm lint`·`typecheck`·`test`(119 파일 848 테스트)·`cargo test`(99 통과)·`pnpm test:e2e:scene`·`pnpm test:e2e:agent` 통과. 이전 세션의 `export-worker/web.test.ts` zip 결정성 테스트 실패는 이번 전체 실행에서 재현되지 않았다(병렬 실행 시 간헐 실패로 의심, 원인 미확인).

## 결정·문제·교훈

- 썸네일은 TODO 문구(헤드리스 `capture`)와 달리 앱 내 Bridge capture를 썼다. 새 프로세스·Chrome 의존 없이 같은 렌더 경로를 재사용하기 때문이다. 대신 **썸네일은 미리보기 패널이 열렸을 때만 갱신**된다.
- 계약 검사는 eslint 플러그인이 아니라 의존성 없는 순수 `.mjs`로 만들었다. 신 폴더(워크스페이스)에 eslint가 없고, 앱과 CLI가 같은 코드를 쓰게 하기 위해서다. 기존 `packages/runtime/eslint-plugin`은 그대로 둔다.
- Text Fidelity는 렌더 DOM이 아니라 소스 텍스트 포함 여부로 근사한다. 동적 검사(같은 `t` 두 번 렌더 비교)·DOM 비교는 후속이다.
- 환경: Windows bash heredoc에서 따옴표가 섞인 긴 코드는 실패하는 경우가 있어 Write 도구를 쓴다([[milestone-v3]] 교훈과 동일).

## 알려진 한계

- 실제 Claude Code·Codex로 신을 생성하는 데모는 하지 못했다(GUI 필요, Codex 미설치).
- `pnpm tauri dev` GUI 실행은 한 번도 하지 않았다.
- 동적 결정성 검사·DOM Text Fidelity 미구현.

See: [[milestone-v3]], [[poc-agent-terminal]], [[implementation-plan]]
