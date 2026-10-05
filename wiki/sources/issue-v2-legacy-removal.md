---
title: 'v2 Legacy Removal Plan'
type: source
tags: [v2, refactor, legacy, removal]
sources: []
last_updated: 2026-10-05
---

T1.2 산출물. v1 코드 중 제거·보존·이관 대상과 순서. 근거: [[decisions]] D-022·D-027·D-033, 계획 [[implementation-plan]] R-6. **실행(T1.3)은 사용자 확인 후.** 복구 기준점: 태그 `v1-final`.

## 보존(삭제 금지)

| 대상 | 이유 |
| --- | --- |
| `src/lib/design/`·`components/design/`, `lib/templates/palette.ts`·`resources/palettes` | DESIGN.md 토큰·팔레트(D-015·D-016) |
| `src/lib/playground/`·`components/playground/` | 플레이그라운드(V5에서 재사용) |
| `src/lib/export/`·`components/export/`·`packages/export-worker` | 코드 보존, 앱 호출만 제거(D-027) |
| `components/doctor/`·`components/terminal/`·PTY(`pty_commands.rs`)·`process/` | 터미널·환경 점검(D-022 실행 경로) |
| `src/lib/agents/registry.ts`(+test) | V4 에이전트 레지스트리 시드. 나머지 `lib/agents/*`는 제거 |
| `resources/runtime/`, `resources/workers/` | v1 Scene 런타임 — V4에서 신 런타임으로 대체할 때까지 유지 |
| `lib/db`·`lib/i18n`·`components/ui`·`context`(일부) | 앱 셸 기반 |

## 제거 단위(순서 = 말단 → 상위, 각 단위 끝에 lint·typecheck·test·`cargo test`)

| 단위 | 대상 | 외부 참조(끊어야 할 곳) | 위험 |
| --- | --- | --- | --- |
| U1 에이전트 호스트(Rust+TS 동시) | `src-tauri/src/{agent_host,mcp_server}`, `commands/agent_commands.rs`, `lib.rs` 핸들러, Cargo 의존성(`rmcp`·`schemars`·`axum`·`agent-client-protocol`·`tokio-util` 사용처 확인 후), `src/lib/agents/{hostApi,session,SessionContext,sessionContextValue,sessionErrors,sessionReducer,types}*`, `components/agents/` | `pages/Workspace.tsx`, `components/layout/WorkspaceLayout.tsx`, pipeline·review가 `lib/agents`를 import | Rust와 TS를 한 커밋에서 같이 제거해야 빌드 유지. `hostApi.ts`가 `components/doctor`·`lib/project`를 참조 |
| U2 파이프라인 | `src/lib/pipeline/`, `components/pipeline/` | `components/design/DesignTab.tsx`, `playground/PlaygroundExtras.tsx`, `lib/design/palettes.ts`, `lib/playground/frameMd.ts`, `components/review/DesignPanel.tsx`, `sidepanel/SidePanel.tsx`, `workspace/CenterWorkspace.tsx` | 보존 모듈이 pipeline 타입을 import — 필요한 타입만 보존 모듈로 이동하거나 참조 삭제 |
| U3 검수 스튜디오 | `components/review/`, `src/lib/review/` | `components/templates/TemplatesPanel.tsx`, `workspace/CenterWorkspace.tsx` | **결정 필요**: `bridgeProtocol`·`previewServer`·`hmrGuard`·`watchClient`·`previewLayout`·`timeline`는 V5 플레이그라운드에서 재사용 가능 → 보존 후 이관 권장 |
| U4 프로젝트 마법사·템플릿 갤러리 | `components/project/`, `components/templates/`, `lib/templates/{builtin,…}`(palette 제외), `resources/project-template/`, `project_commands.rs`의 `scaffold_project`·체크포인트 | `layout/TopMenuBar.tsx`, `workspace/WelcomeGuide.tsx`, `pages/Workspace.tsx`, `lib/playground/templateImport.ts` | 체크포인트(git 자동 커밋, D-013)는 v2 범위 밖이면 함께 제거 |
| U5 `lib/project` | `vanilla.json` 읽기 스키마만 `src/lib/migrate/legacy-schema.ts`로 이관(T1.4), 나머지 삭제 | `lib/context/WorkspaceTabsContext.test.tsx` 외 U1~U4에서 이미 제거된 곳 | 마이그레이션 입력 테스트 선행 |
| U6 탭·셸 | `WorkspaceTabsContext`, `components/workspace/CenterWorkspace`, `sidepanel/`, `pages/Workspace.tsx`, 파이프라인 레이아웃 | T1.10 앱 셸과 교체 | T1.10과 같은 브랜치에서 순차 진행 |

## 의존 순서

U1 → U2 → U3 → U4 → U5(T1.4) → U6(T1.10). U2는 U1 이후(runner·planStep이 `lib/agents`를 사용), U3는 U2 이후(`review/*`가 `lib/pipeline`을 사용).

## 영향 표(각 단위 완료 시 확인)

| 확인 | 명령 |
| --- | --- |
| 타입 | `pnpm typecheck` |
| 린트 | `pnpm lint` (미사용 import 포함) |
| 테스트 | `pnpm test` — 삭제 단위의 테스트도 함께 삭제되므로 총 개수 감소 정상 |
| Rust | `cargo test` (U1·U4) |
| 참조 0건 | 삭제 경로명 `grep -rn` |

## 사용자 확인 필요

1. U3에서 Bridge·프리뷰 서버 계열 보존(권장) vs 전부 삭제(TODO 원안).
2. U4에서 체크포인트(git 자동 커밋) 기능 제거 여부.
3. `resources/project-template`·`resources/runtime`: V4까지 유지(권장).

See: [[implementation-plan]], [[decisions]]
