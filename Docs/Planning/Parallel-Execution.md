# 병렬 실행 가이드 (여러 에이전트 세션으로 구현하기)

- 문서 버전: v1.0 (2026-09-29)
- 대상: P4 구현을 **여러 세션(에이전트)에서 동시에** 진행할 때의 작업 배치·실행 규칙
- 작업 원본: `Docs/Planning/TODO.md` (항목 ID `T*.*`) · 계획: `Docs/Planning/Implementation-Plan.md`
- 이 문서의 "레인 상태" 표는 **조정 세션**(사용자 또는 사용자가 지정한 메인 세션)만 갱신한다.

---

## ▶ 현재 진입점

| 순서 | 무엇을 | 누가 | 브랜치 / 워크트리 |
| --- | --- | --- | --- |
| 완료 | M1 웨이브 0~2 (T1.1~T1.18) | — | `feat/m1-foundation`(병합 완료) |
| **다음** | `feat/m1-foundation` → main 병합(사용자 승인 후), 그다음 M2 에이전트 + M3 병렬 가능분 + T4.9 레인 구성 | 조정 세션 | M2 레인 배치는 별도 갱신 |

--- | --- | --- | --- |
| **1 (지금)** | **웨이브 0**: T1.1 기준선 확인 → T1.3 pnpm 워크스페이스 도입 | 단독 세션 1개 | `feat/m1-foundation`(통합 브랜치, main에서 생성) → 작업 브랜치 `feat/m1-w0-workspace` |
| 2 | 웨이브 0 병합 후 **웨이브 1**: 레인 A·B·C·D 동시 시작 | 세션 4개 | 레인별 워크트리 (§3) |
| 3 | 웨이브 1의 선행 항목이 끝나면 **웨이브 2**: M1 통합 레인 B′·C′ | 세션 2개 | §3 |
| 4 | T1.18 M1 마무리 → 사용자 확인 → main 병합 | 조정 세션 | — |

웨이브 0을 먼저 하는 이유: T1.3이 루트 `package.json`·`pnpm-workspace.yaml`·`tsconfig`·`eslint.config.js`·vitest 설정을 바꾼다. 모든 레인이 공유하는 파일이라 병렬 작업 전에 확정해야 충돌이 없다.

---

## 1. 모든 세션이 먼저 읽을 파일

| 순서 | 파일 | 왜 |
| --- | --- | --- |
| 1 | `AGENTS.md` | 기술 스택·코딩 규칙·git 규칙·보안·wiki·단계 규칙(필수) |
| 2 | 이 문서 `Docs/Planning/Parallel-Execution.md` | 내 레인, 소유 경로, 공유 파일 규칙, 완료 보고 형식 |
| 3 | `Docs/Planning/TODO.md` | 내 항목의 대상 파일·완료 판정·선행 항목 |
| 4 | `Docs/Planning/Implementation-Plan.md` | 마일스톤 목표·완료 기준·테스트 계획·완료 정의(§7) |
| 5 | `Docs/Planning/Technical-Design.md` | 구현 방식의 진실 공급원(해당 절만) |
| 6 | `wiki/index.md` → 관련 `poc-*`·개념 페이지 | PoC에서 이미 확인한 방식과 함정(Pitfalls) |
| 7 | `Docs/Planning/Product-Spec.md`, `Docs/Planning/Decisions.md` | 기능 정의(F-ID), 결정(D-001~D-018) |
| 8 | 템플릿 문서 `Docs/Architecture.md`, `Docs/Project-Structure.md`, `Docs/Extension-Guide.md`, `DESIGN.md` | 기존 앱 셸 구조·확장 절차·UI 토큰 |

**레인별 추가 참고 파일**

| 레인 | 추가로 읽을 것 |
| --- | --- |
| A 앱 셸 | `Docs/Extension-Guide.md`(탭·패널 등록), `BRANDING.md`, `src/lib/db/client.ts`·`migrations/0001_init.sql`, 설계서 §8·§10 |
| B Rust 프로세스·Doctor | `spikes/s6-doctor/src/main.rs`(초안), `wiki/sources/poc-s6.md`, 설계서 §2.4·§6, `src-tauri/src/commands/shell_commands.rs`(기존 run_shell) |
| C 프로젝트 모델 | 상세 기획서 §6(폴더 구조)·§7(데이터 계약)·§8.1, 설계서 §8·§9, `spikes/s7-design-tokens/DESIGN.md`(샘플 형식) |
| D 런타임·디자인 | `spikes/s7-design-tokens/src/**`(디자인 라이브러리·런타임 초안), `spikes/s1-hyperframes-r3f/src/clock.ts`, `spikes/s2-still-pptx/src/main.tsx`(준비 신호), `wiki/sources/poc-s1·s2·s4·s7.md`, 설계서 §4·§5 |

---

## 2. 웨이브와 레인 배치 (M1 + M4a 선행)

```
웨이브 0 (단독):  T1.1 → T1.3
                     │
웨이브 1 (병렬):  ┌─ A 앱 셸:        T1.2 → T1.4 → T1.5 → T1.17 → T1.6
                  ├─ B Rust·Doctor:  T1.8 → T1.9 → T1.10
                  ├─ C 프로젝트 모델: T1.7 → T1.12
                  └─ D 런타임·디자인: T3.5 → T4.1 → T4.2 → T4.7 → T4.4 → T4.3 → T4.5 → T4.6 → T4.8
                     │
웨이브 2 (병렬):  ┌─ B′ Doctor UI·설치:  T1.11 (A 완료 + T1.10 필요) → T1.15 (T1.14 필요, C′ 이후)
                  └─ C′ 스캐폴딩·마법사: T1.13 (T1.12 + T1.8) → T1.14 (A 완료 필요) → T1.16
                  (D 계속:            T4.9 (T1.12 필요))
                     │
마무리:           T1.18 (조정 세션)
```

| 레인 | TODO 항목 | 소유 경로(이 레인만 생성·수정) | 선행 조건 |
| --- | --- | --- | --- |
| **A 앱 셸** | T1.2, T1.4, T1.5, T1.17, T1.6 | `src/components/{layout,brand,workspace,sidepanel}/**`, `src/pages/**`, `src/lib/db/**`, `src/components/{collections,extensions}`·`src/lib/{collections,extensions}`(삭제), `src-tauri/tauri.conf.json`, `src-tauri/capabilities/**` | 웨이브 0 |
| **B Rust·Doctor** | T1.8, T1.9, T1.10 | `src-tauri/src/process/**`, `src-tauri/src/commands/doctor_commands.rs` | 웨이브 0 |
| **C 프로젝트 모델** | T1.7, T1.12 | `src/lib/project/**`, `src/lib/types/project.ts`, `resources/project-template/**`, `resources/design/**` | 웨이브 0 |
| **D 런타임·디자인** | T3.5, T4.1, T4.2, T4.7, T4.4, T4.3, T4.5, T4.6, T4.8 (+웨이브 2에 T4.9) | `packages/runtime/**`, `src/lib/design/**` | 웨이브 0 |
| **B′ Doctor UI·설치** | T1.11, T1.15 | `src/components/doctor/**`, `src-tauri/src/commands/process_commands.rs` | A·B 병합 후 |
| **C′ 스캐폴딩·마법사** | T1.13, T1.14, T1.16 | `src-tauri/src/commands/project_commands.rs`, `src/components/project/**` | A·B·C 병합 후 |

M2(에이전트)와 M3(파이프라인)의 레인 배치는 M1을 마무리할 때(T1.18) 이 문서에 추가한다. 예정 구성은 다음과 같다.

| 레인 | 항목 | 비고 |
| --- | --- | --- |
| M2 레인 | T2.1~T2.13 | |
| M3 레인 | T3.1, T3.2, T3.3, T3.4, T3.8, T3.9, T3.12 | M2와 무관해서 먼저 진행할 수 있다 |
| M3 후속 | T3.6, T3.14 | T2.7 이후에 진행한다 |

---

## 2b. 웨이브 3 (M2 + M3·M4a 선행분 + M1 이월) — 통합 브랜치 `feat/m2-agents`

M1은 main에 병합했다. 웨이브 3은 통합 브랜치 `feat/m2-agents`(main에서 생성)에 레인 5개를 병합한다. M3·M4a 항목도 이 브랜치에 병합한다(M3·M4의 마무리는 각 마일스톤 항목 완료 뒤).

| 레인 | 브랜치 / 워크트리 | TODO 항목 | 소유 경로 | i18n 접두어 |
| --- | --- | --- | --- | --- |
| **E 에이전트 호스트** | `feat/m2-e-host` / `../VanillaStudio-m2-e` | T2.1 → T2.2 → T2.3 → T2.4 → T2.5 → T2.6 | `src/lib/agents/registry*`, `src-tauri/src/agent_host/**`, `src-tauri/src/commands/agent_commands.rs`, `src-tauri/src/commands/process_commands.rs`(T2.2), 전역 DB `agents` 사용 | `agent.*` |
| **G MCP·PTY** | `feat/m2-g-mcp-pty` / `../VanillaStudio-m2-g` | T2.10 → T2.11 | `src-tauri/src/mcp_server/**`, `src-tauri/src/commands/pty_commands.rs`, `src/components/terminal/**` | `terminal.*` |
| **H 파이프라인 UI** | `feat/m3-h-pipeline` / `../VanillaStudio-m3-h` | T3.4 → T3.12 → T3.1 → T3.3 → T3.2 → T3.8 → T3.9 | `src/lib/pipeline/**`, `src/components/pipeline/**`, `src/components/design/**` (탭 등록은 `shellRegistry.ts`·`CenterWorkspace.tsx` 최소 수정) | `pipeline.*`, `design.*` |
| **R 런타임·워커** | `feat/m4-r-runtime` / `../VanillaStudio-m4-r` | T4.9 → T3.7 | `packages/runtime/**`, `packages/export-worker/**`, `resources/runtime/**`, `resources/project-template/**`(런타임 부트스트랩 교체) | 없음 |
| **S 셸 이월** | `feat/m1-s-shell-fixes` / `../VanillaStudio-m1-s` | 이월 3건(프로젝트별 탭 저장소, 마법사로 만든 프로젝트 자동 신뢰, 템플릿 표기 정리) | `src/lib/context/**`, `src/components/workspace/**`, `src/components/project/NewProjectWizard.tsx`, `LICENSE`·`README.md` | `shell.*` |

- 병합 순서: S → G → E → R → H (공유 파일 충돌이 적은 순). 웨이브 4(T2.7~T2.9, T2.12, T2.13, T3.6, T3.11, T3.13~)는 E 병합 후 배치한다.
- `Cargo.lock`·`pnpm-lock.yaml` 충돌은 병합 시 재생성한다.

---

## 2c. 웨이브 4 (M2 후속 + M3·M4b·M5 선행분) — 통합 브랜치 `feat/m2-agents`

웨이브 3(S·G·E·R·H)은 병합 완료. 웨이브 4는 같은 통합 브랜치에 레인 5개를 병합한다.

| 레인 | 브랜치 / 워크트리 | TODO 항목 | 소유 경로 | i18n 접두어 |
| --- | --- | --- | --- | --- |
| **F 에이전트 프런트** | `feat/m2-f-agent-ui` / `../VanillaStudio-m2-f` | T2.7 → T2.8 → T2.9 | `src/lib/agents/SessionContext*`·리듀서, `src/components/agents/**`, 우측 도크(`src/components/layout/*` 최소 수정), `src/pages/Workspace.tsx` Provider 한 줄 | `agentPanel.*` |
| **E2 호스트 후속** | `feat/m2-e2-host-followup` / `../VanillaStudio-m2-e2` | MCP 세션 연결(T2.10 판정), T2.13, T2.12 | `src-tauri/src/agent_host/**`, `src-tauri/src/commands/agent_commands.rs`, `src-tauri/src/mcp_server/**`, `wiki/sources/poc-s3.md`(T2.12만) | — |
| **K 체크포인트·스킬** | `feat/m3-k-checkpoint` / `../VanillaStudio-m3-k` | T3.10 → T3.15 → T6.1 | `src-tauri/src/commands/project_commands.rs`(checkpoint), `src/lib/project/checkpoint*`, `src/components/pipeline/prompts/TaskGraph.tsx`, `resources/skills/vanilla-core/**` | `checkpoint.*` |
| **V 검수 스튜디오** | `feat/m4-v-review` / `../VanillaStudio-m4-v` | T4.10 → T4.11 → T4.12 → T4.13 → T4.14 → T4.21 | `resources/workers/vite-runner.mjs`, `src-tauri/src/commands/process_commands.rs`(프리뷰 job), `src-tauri/src/watch.rs`, `src/lib/review/**`, `src/components/review/**`, `tests/e2e/**` | `review.*` |
| **X Export 워커** | `feat/m5-x-export` / `../VanillaStudio-m5-x` | T5.1 → T5.3 → T5.4 → T5.5 → T5.6 → T5.8 | `packages/export-worker/**`, `resources/workers/**`(vite-runner 제외) | 없음 |

- 웨이브 5(에이전트 의존 흐름): T3.6, T3.11, T3.13, T3.14, T4.15~T4.20, T5.2, T5.7, T5.9, T6.x (아래 §2d).
- 웨이브 4 병합 순서(완료): K → E2 → X → V → F.
- 사람이 확인할 항목(자동화 불가): 실제 Claude Code·Codex·AGY 대화, PowerPoint에서 편집 PPTX, 깨끗한 Windows VM.

---

## 2d. 웨이브 5 (M3·M4b·M5·M6 의존 흐름) — 통합 브랜치 `feat/m2-agents`

| 레인 | 브랜치 / 워크트리 | TODO 항목 | 소유 경로 | i18n 접두어 |
| --- | --- | --- | --- | --- |
| **P 파이프라인 흐름** | `feat/m3-p-flow` / `../VanillaStudio-m3-p` | T3.6 → T3.13 → T3.11 → T3.14 | `src/lib/pipeline/planStep.ts`, `src/lib/pipeline/runner.ts`, `src/components/pipeline/prompts/*`(편집기·승인), 기획서 뷰어 승인 배선(최소 수정) | `pipeline.*` |
| **D2 디자인·팔레트** | `feat/m4-d2-palette` / `../VanillaStudio-m4-d2` | T4.15 → T4.16 → T4.17 | `src/components/review/DesignPanel.tsx`, `src/lib/design/palettes.ts`, `resources/palettes/`, `src/components/design/PaletteEditor.tsx`, 템플릿 사이드패널 탭(최소 수정) | `palette.*` |
| **R2 수정요청·MCP** | `feat/m4-r2-revision` / `../VanillaStudio-m4-r2` | T4.20 → T4.18 → T4.19 | `src-tauri/src/mcp_server/tools/*`, `src/lib/review/revision.ts` + 수정요청 UI, `src/components/review/Compare.tsx` | `review.*` |
| **X2 Export UI** | `feat/m5-x2-export-ui` / `../VanillaStudio-m5-x2` | T5.2 → T5.9 → T5.7 | `src/lib/export/*`, `src/components/export/*`, `packages/export-worker/src/slidesEditable.ts`, `resources/workers/vendor/**` | `export.*` |
| **T2 템플릿 설치** | `feat/m6-t2-templates` / `../VanillaStudio-m6-t2` | T6.2 | `src/lib/templates/*` | `templates.*` |

- 의존: R2의 T4.18은 P의 T3.14 인터페이스(runner 상태·`task_runs`)를 전제로 한다. 병합 순서: T2 → D2 → X2 → P → R2 (R2는 P 병합 후 rebase·재검증).
- T2.14 M2 마무리는 조정 세션이 직접 수행한다(코드 전부 병합됨, 데모+`milestone-m2.md`).

---

## 3. 브랜치·워크트리

```powershell
# 조정 세션(또는 웨이브 0 세션)이 1회
git checkout main
git checkout -b feat/m1-foundation            # M1 통합 브랜치

# 웨이브 0
git checkout -b feat/m1-w0-workspace feat/m1-foundation
# ... T1.1, T1.3 완료 → 조정 세션이 feat/m1-foundation에 --no-ff 병합

# 웨이브 1: 레인마다 워크트리(같은 브랜치에서 두 세션이 작업하지 않는다, AGENTS.md §6)
git worktree add ../VanillaStudio-m1-a -b feat/m1-a-shell    feat/m1-foundation
git worktree add ../VanillaStudio-m1-b -b feat/m1-b-process  feat/m1-foundation
git worktree add ../VanillaStudio-m1-c -b feat/m1-c-project  feat/m1-foundation
git worktree add ../VanillaStudio-m1-d -b feat/m1-d-runtime  feat/m1-foundation

# 웨이브 2 (A·B·C 병합 후)
git worktree add ../VanillaStudio-m1-b2 -b feat/m1-b2-doctor-ui  feat/m1-foundation
git worktree add ../VanillaStudio-m1-c2 -b feat/m1-c2-scaffold   feat/m1-foundation

# 레인 종료 후
git worktree remove ../VanillaStudio-m1-a
```

- **워크트리마다 `pnpm install`이 필요하다**(`node_modules`는 워크트리별).
- **Rust 빌드**: 워크트리마다 `src-tauri/target`이 따로 생겨 첫 빌드가 오래 걸린다. 디스크를 아끼려면 `CARGO_TARGET_DIR`를 하나로 공유할 수 있지만, 동시 빌드 시 잠금 대기가 생긴다.
- **병합**: 레인 세션은 자기 브랜치에 커밋만 한다. `feat/m1-foundation`으로의 병합은 **조정 세션**이 한다.
  - 병합 전: 레인 브랜치를 최신 `feat/m1-foundation`에 rebase하고, 검증을 다시 돌린다.
  - 병합 순서(웨이브 1): C → B → A → D. 파일이 겹치는 정도가 적은 순서다.
  - main 병합과 **push는 사용자 승인 후**에만 한다.

---

## 4. 공유 파일 규칙 (충돌 방지)

| 파일 | 규칙 |
| --- | --- |
| `src/lib/i18n/dictionaries/ko.ts`·`en.ts` | 레인별 **키 접두어**를 쓴다: A `shell.*`·`settings.*`, B′ `doctor.*`, C′ `project.*`, D는 앱 문구 없음. 자기 블록 안에서만 추가하고, 기존 키는 수정·재정렬하지 않는다. 충돌하면 양쪽을 모두 살린다 |
| `src-tauri/src/lib.rs`(`mod`·`generate_handler!`) | **한 줄 추가만** 한다. 레인 B: `process`, `doctor_commands` / C′: `project_commands` / B′: `process_commands` |
| `src-tauri/Cargo.toml`, 루트·패키지 `package.json` | 의존성은 `cargo add`·`pnpm add`로 **자기 레인에 필요한 것만** 추가한다. 버전 충돌은 조정 세션이 병합할 때 해결한다 |
| DB 마이그레이션 | **레인 A만** 추가한다(`0002_*`, `0003_*`). 다른 레인이 테이블이 필요하면 레인 A 항목(T1.6)에 요청하거나, 웨이브 2 이후 다음 번호를 쓴다 |
| `Docs/Planning/TODO.md` | **자기 항목의 체크박스만** 바꾼다(`[ ]` → `[x]`). 순서·문구는 바꾸지 않는다 |
| `Docs/Planning/*.md`(설계 문서) | 레인에서 직접 고치지 않는다. 설계와 다르게 해야 하면 **멈추고 보고한다**(AGENTS.md §8). 조정 세션이 반영한다 |
| `wiki/log.md` | 맨 아래에 추가만 한다. 충돌하면 양쪽 모두 시간 순으로 남긴다 |
| `wiki/index.md`, `wiki/overview.md` | 레인에서 고치지 않는다. 조정 세션이 마일스톤 마무리 때 갱신한다 |
| `Docs/Project-Structure.md` | 새 디렉터리를 만든 레인은 완료 보고에 "구조 변경"을 적는다. 문서 반영은 조정 세션이 한다 |

**소유 경로 밖 파일을 고쳐야 하면**: 작업을 멈추고, 필요한 변경과 이유를 완료 보고(또는 중간 보고)에 적는다. 조정 세션이 해당 레인에 넘기거나 순서를 조정한다.

---

## 5. 레인 세션 운영 규칙

1. 시작: `git status -sb`, `git branch --show-current`로 워크트리·브랜치를 확인한다. `pnpm install`을 실행하고 기준선 검증(`pnpm lint`·`typecheck`·`test`)을 돌린다.
2. 항목 단위로 진행: 대상 파일 구현 → 완료 판정 확인 → 검증 통과 → **항목당 1커밋 이상**(Conventional Commits, 메시지에 항목 ID 포함, 예: `feat(doctor): T1.9 dependency checks`) → TODO 체크.
3. 선행 항목이 다른 레인에 있으면 기다리지 말고 보고한다. 그 사이 목(mock)이나 인터페이스로 진행할 수 있는지 판단해 적는다.
4. PoC 코드(`spikes/**`)는 참고용이다. 그대로 복사하지 말고, 테스트와 함께 앱 규칙(TS strict, `any` 금지, i18n, 시맨틱 토큰)에 맞게 다시 쓴다.
5. 금지: push, 다른 레인 브랜치·워크트리 수정, `--no-verify`, 소유 경로 밖 대규모 수정, 설계 문서 직접 변경.
6. 끝: 아래 형식으로 보고한다.

**완료 보고 형식**

```text
레인: {{LANE}} / 브랜치: {{BRANCH}} / 워크트리: {{PATH}}
완료 항목: T… (커밋 해시)
검증: pnpm lint / typecheck / test (+ cargo test) 결과
완료 판정 근거: 항목별 한 줄
구조 변경·새 의존성: …
설계와 달라진 점·결정 필요: …
다음 레인에 넘길 것(인터페이스·주의점): …
wiki 기록 제안(Pitfalls 등): …
```

---

## 6. 세션 시작 프롬프트 (복사해서 사용)

### 6.1 웨이브 0 (단독)

```text
Vanilla Studio P4 구현 웨이브 0을 수행하라.
- 먼저 AGENTS.md, Docs/Planning/Parallel-Execution.md, Docs/Planning/TODO.md(M1), Docs/Planning/Implementation-Plan.md를 읽어라.
- main에서 feat/m1-foundation을 만들고, 거기서 feat/m1-w0-workspace 브랜치를 만든다.
- TODO T1.1(pnpm tauri dev 기준선), T1.3(pnpm 워크스페이스: packages/runtime, packages/export-worker 빈 패키지, 루트 lint·typecheck·test가 패키지까지 통과)을 순서대로 수행하라.
- spikes/는 lint·test 대상에서 계속 제외한다.
- 끝나면 Parallel-Execution.md §5 형식으로 보고하고, feat/m1-foundation 병합은 승인 후에 하라. push 금지.
```

### 6.2 웨이브 1·2 레인 (레인마다 값만 바꿔서)

```text
Vanilla Studio P4 구현, 레인 {{LANE}}을 수행하라.
- 워크트리: {{WORKTREE}} / 브랜치: {{BRANCH}} (feat/m1-foundation 기준). 이 워크트리 밖은 수정하지 않는다.
- 먼저 AGENTS.md와 Docs/Planning/Parallel-Execution.md(§1 공통 + 레인 {{LANE}} 추가 참고, §4 공유 파일 규칙, §5 운영 규칙)를 읽어라.
- 담당 항목: {{TODO_IDS}} (Docs/Planning/TODO.md의 대상·완료 판정·선행을 따른다).
- 소유 경로: {{OWNED_PATHS}}. 그 밖의 파일이 필요하면 멈추고 보고하라.
- 참고 PoC: {{SPIKES}} (복사 금지, 테스트와 함께 다시 작성).
- 항목마다 검증 → 커밋(항목 ID 포함) → TODO 체크. push·병합 금지.
- 끝나면 §5 완료 보고 형식으로 보고하라.
```

| {{LANE}} | {{WORKTREE}} | {{BRANCH}} | {{TODO_IDS}} | {{SPIKES}} |
| --- | --- | --- | --- | --- |
| A 앱 셸 | `../VanillaStudio-m1-a` | `feat/m1-a-shell` | T1.2, T1.4, T1.5, T1.17, T1.6 | `spikes/s4-webview-iframe/src-tauri/tauri.conf.json`(CSP) |
| B Rust·Doctor | `../VanillaStudio-m1-b` | `feat/m1-b-process` | T1.8, T1.9, T1.10 | `spikes/s6-doctor` |
| C 프로젝트 모델 | `../VanillaStudio-m1-c` | `feat/m1-c-project` | T1.7, T1.12 | `spikes/s7-design-tokens/DESIGN.md` |
| D 런타임·디자인 | `../VanillaStudio-m1-d` | `feat/m1-d-runtime` | T3.5, T4.1, T4.2, T4.7, T4.4, T4.3, T4.5, T4.6, T4.8 | `spikes/s7-design-tokens`, `spikes/s1-hyperframes-r3f`, `spikes/s2-still-pptx`, `spikes/s4-webview-iframe/preview-app` |
| B′ Doctor UI·설치 | `../VanillaStudio-m1-b2` | `feat/m1-b2-doctor-ui` | T1.11, T1.15 | `spikes/s6-doctor` |
| C′ 스캐폴딩·마법사 | `../VanillaStudio-m1-c2` | `feat/m1-c2-scaffold` | T1.13, T1.14, T1.16 | — |

### 6.3 조정 세션 (병합·기록)

```text
레인 {{LANE}}의 완료 보고를 검토하고 병합하라.
1. 레인 브랜치를 최신 feat/m1-foundation에 rebase하고, 검증(lint·typecheck·test·cargo test)을 다시 돌린다.
2. 공유 파일 충돌은 Parallel-Execution.md §4 규칙으로 해결한다.
3. feat/m1-foundation에 --no-ff로 병합하고, 이 문서의 레인 상태 표를 갱신한다.
4. 보고의 "설계와 달라진 점"은 Technical-Design·Decisions에 반영할지 사용자에게 묻는다.
5. wiki 기록 제안은 마일스톤 마무리(T1.18) 때 milestone-m1.md에 모은다. push 금지(승인 후).
```

---

## 7. 레인 상태 (조정 세션만 갱신)

| 웨이브 | 레인 | 브랜치 | 상태 | 병합 커밋 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 0 | 워크스페이스 | `feat/m1-w0-workspace` | 병합 완료 | `7b3453c` | |
| 1 | A 앱 셸 | `feat/m1-a-shell` | 병합 완료 | `a692f2b` | |
| 1 | B Rust·Doctor | `feat/m1-b-process` | 병합 완료 | `996bfbf` | |
| 1 | C 프로젝트 모델 | `feat/m1-c-project` | 병합 완료 | `7cd0327` | |
| 1 | D 런타임·디자인 | `feat/m1-d-runtime` | 병합 완료 | `9c9084c` | M4a 선행분(T4.9는 이월) |
| 2 | B′ Doctor UI·설치 | `feat/m1-b2-doctor-ui` | 병합 완료 | `7ac1c99` | 마법사 연결은 조정 세션 |
| 2 | C′ 스캐폴딩·마법사 | `feat/m1-c2-scaffold` | 병합 완료 | `93d6fe0` | |
| — | M1 마무리(T1.18) | `feat/m1-foundation` → main | 완료, main 병합 승인 대기 | — | 사용자 확인 |
| 3 | S 셸 이월 | `feat/m1-s-shell-fixes` | 병합 완료 | — | `feat/m2-agents`에 병합 |
| 3 | G MCP·PTY | `feat/m2-g-mcp-pty` | 병합 완료 | — | `feat/m2-agents`에 병합 |
| 3 | E 에이전트 호스트 | `feat/m2-e-host` | 병합 완료 | `2876209` | T2.1~T2.6 |
| 3 | R 런타임·워커 | `feat/m4-r-runtime` | 병합 완료 | — | T4.9·T3.7, `feat/m2-agents`에 병합 |
| 3 | H 파이프라인 UI | `feat/m3-h-pipeline` | 병합 완료 | `e961560` | `feat/m2-agents`에 병합 |
| 4 | F 에이전트 프런트 | `feat/m2-f-agent-ui` | 병합 완료 | `6492cd5` | T2.7·T2.8·T2.9 |
| 4 | E2 호스트 후속 | `feat/m2-e2-host-followup` | 병합 완료 | `6daac8a` | T2.10 판정(rmcp 확정)·T2.13·T2.12 |
| 4 | K 체크포인트·스킬 | `feat/m3-k-checkpoint` | 병합 완료 | `2682d41` | T3.10·T3.15·T6.1 |
| 4 | V 검수 스튜디오 | `feat/m4-v-review` | 병합 완료 | `886b80f` | T4.10·T4.11·T4.12·T4.13·T4.14·T4.21, notify 8.2.0 추가 |
| 4 | X Export 워커 | `feat/m5-x-export` | 병합 완료 | `aaac3eb` | T5.1·T5.3·T5.4·T5.5·T5.6·T5.8 |
| 5 | P 파이프라인 흐름 | `feat/m3-p-flow` | 병합 완료 | `50fea64` | T3.6·T3.13·T3.11·T3.14 |
| 5 | D2 디자인·팔레트 | `feat/m4-d2-palette` | 병합 완료 | `d23328e` | T4.15·T4.16·T4.17 |
| 5 | R2 수정요청·MCP | `feat/m4-r2-revision` | 진행 중 | — | T4.20→T4.18→T4.19, P 병합 후 rebase |
| 5 | X2 Export UI | `feat/m5-x2-export-ui` | 진행 중 | — | T5.2→T5.9→T5.7 |
| 5 | T2 템플릿 설치 | `feat/m6-t2-templates` | 병합 완료 | `4c1354c` | T6.2 |
