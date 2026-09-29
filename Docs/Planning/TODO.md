# Vanilla Studio TODO

- 문서 버전: v1.0 (2026-09-29) · 계획: `Implementation-Plan.md`
- 각 항목은 1~2시간 단위이며, 다음 형식으로 적는다: `[ ] ID 작업 — 대상 · 완료 판정 · 선행 · (기능 ID)`
- 공통 완료 조건: `pnpm lint`·`typecheck`·`test`가 통과해야 한다(Rust 변경 시 `cargo test`도). UI 문구는 ko/en 사전에 추가하고, 색상은 시맨틱 토큰만 쓴다(AGENTS.md §3).
- 항목을 끝내면 체크하고 커밋한다. 마일스톤을 끝내면 `wiki/sources/milestone-mN.md`를 작성한다.

## ▶ 진입점 (2026-09-29)

- **M1 완료**(main 병합·push는 사용자 승인 대기). 기록: `wiki/sources/milestone-m1.md`.
- **다음 작업**: M2 에이전트(T2.1~) 브랜치 `feat/m2-agents`. M3의 T3.1·T3.2·T3.3·T3.4·T3.8·T3.9·T3.12와 M4a의 T4.9는 M2와 무관하게 병렬 진행 가능. 레인 배치는 `Docs/Planning/Parallel-Execution.md`(M2·M3 레인은 M1 마무리 때 추가)
- 항목의 `[레인 X · Wn]` 태그는 담당 레인과 웨이브를 뜻한다. 태그가 없는 항목(M2 이후)은 레인 배치 때 붙인다.

---

## M1 기반 (branch: `feat/m1-foundation`)

- [x] T1.1 [단독 · W0] `pnpm tauri dev` 기준선 확인, 실패 시 원인 기록 — 대상: 없음(실행) · 완료 판정: 앱 창이 뜬다, P0 로그 갱신 · 선행: —
- [x] T1.2 [레인 A · W1] 브랜딩 교체(앱 이름·identifier·창 제목·아이콘 자리) — 대상: `src-tauri/tauri.conf.json`, `BRANDING.md` 절차, `src/components/brand/*` · 완료 판정: 창 제목 "Vanilla Studio", identifier `dev.vanilla.studio` · 선행: T1.1
- [x] T1.3 [단독 · W0] pnpm 워크스페이스 도입 결정·구성(`packages/runtime`, `packages/export-worker` 빈 패키지) — 대상: `pnpm-workspace.yaml`, `packages/*/package.json`, 루트 `tsconfig`·`eslint.config.js`·vitest include · 완료 판정: 루트 lint·typecheck·test가 패키지까지 통과 · 선행: T1.1
- [x] T1.4 [레인 A · W1] 템플릿 예제 도메인 제거(collections, extensions: 컴포넌트·lib·i18n 키·DB 테이블·테스트) — 대상: `src/components/{collections,extensions}`, `src/lib/{collections,extensions}`, `src/lib/i18n/dictionaries/*`, 마이그레이션 · 완료 판정: 참조 0건(grep), 앱 실행 정상 · 선행: T1.1
- [x] T1.5 [레인 A · W1] 보안 기본값 조정: `assetProtocol.scope` 축소, CSP `frame-src http://127.0.0.1:*` — 대상: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/*` · 완료 판정: capability에 `remote.urls` 없음, 설계서 §10 표와 일치 · 선행: T1.2
- [x] T1.6 [레인 A · W1] 프로젝트 DB 경로 `.app-data` → `.vanilla`, 전역·프로젝트 마이그레이션 골격(agents, palettes, templates, playground_items, doctor_cache / pipeline_state, task_runs, agent_sessions, reviews, export_jobs) — 대상: `src/lib/db/migrations/*.sql`, `src/lib/db/client.ts` · 완료 판정: 마이그레이션 테스트 통과 · 선행: T1.4
- [x] T1.7 [레인 C · W1] `vanilla.json` zod 스키마 + 타입(유형·규격·템플릿·팔레트·에이전트·런타임 버전) — 대상: `src/lib/project/schema.ts`, `src/lib/types/project.ts` · 완료 판정: 유효·무효 예제 단위 테스트 · 선행: T1.3 · (F-PRJ-01)
- [x] T1.8 [레인 B · W1] Rust 프로세스 실행 공통 모듈: PATHEXT 해석, 레지스트리 fresh PATH, stdin 닫기, `CREATE_NO_WINDOW`, 타임아웃, Job Object 트리 종료 — 대상: `src-tauri/src/process/mod.rs` · 완료 판정: `cargo test`(해석·타임아웃), S6 `doctor-probe` 로직 이관 · 선행: T1.1
- [x] T1.9 [레인 B · W1] Doctor Rust 명령(`doctor_check`) — 대상: `src-tauri/src/commands/doctor_commands.rs` · 완료 판정: 13개 항목 JSON, S6 결과와 같은 판정, 테스트(버전 비교·FFmpeg 판정) · 선행: T1.8 · (F-ENV-01)
- [x] T1.10 [레인 B · W1] FFmpeg 다운로드 명령(진행률 Channel, SHA-256, 메이저 계열 고정, 해시 기록, 취소) — 대상: `doctor_commands.rs`, 앱 데이터 `tools/ffmpeg/` · 완료 판정: 실제 다운로드 후 `libx264=true`, 해시 불일치 시 삭제 테스트 · 선행: T1.9 · (F-ENV-01)
- [x] T1.11 [레인 B′ · W2] Doctor 화면(설정 탭 + 웰컴 요약 배지, 재점검, 설치 안내, 다운로드 동의 다이얼로그) — 대상: `src/components/doctor/*`, `src/pages/Settings/*`, i18n · 완료 판정: 최소 PATH 모의에서 누락 항목마다 해결 방법이 표시됨 · 선행: T1.10 · (F-ENV-01)
- [x] T1.12 [레인 C · W1] 프로젝트 스캐폴딩 원본(`resources/project-template/`: `vanilla.json`, `AGENTS.md`, `CLAUDE.md`, 기본 `DESIGN.md`, `package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `.gitignore`) — 대상: `resources/project-template/**`, `resources/design/DESIGN.md` · 완료 판정: 복사한 폴더에서 `pnpm install && pnpm dev` 동작 · 선행: T1.3
- [x] T1.13 [레인 C′ · W2] 스캐폴딩 Rust 명령(템플릿 복사, 변수 치환, 워크스페이스 스코프 검사) — 대상: `src-tauri/src/commands/project_commands.rs` · 완료 판정: `cargo test`로 결과 트리 검증, 스코프 밖 경로 거부 · 선행: T1.12, T1.8 · (F-PRJ-02)
- [x] T1.14 [레인 C′ · W2] 새 프로젝트 마법사 UI(유형·규격·템플릿(없음)·팔레트(기본)·에이전트·폴더) — 대상: `src/components/project/NewProjectWizard.tsx`, `src/lib/project/*`, i18n · 완료 판정: 마법사 완료 시 폴더 생성 + 탭 열림 · 선행: T1.7, T1.13 · (F-PRJ-01, F-DSN-01)
- [x] T1.15 [레인 B′ · W2] 앱 소유 프로세스: 의존성 설치(`pnpm install`, 마법사 1회 동의, `package.json` 변경 시 재확인) — 대상: `src-tauri/src/commands/process_commands.rs` · 완료 판정: 고정 argv만 허용(테스트), 진행 로그 표시 · 선행: T1.8, T1.14 · (D-012)
- [x] T1.16 [레인 C′ · W2] 프로젝트 열기·최근 프로젝트·폴더 신뢰 확인(템플릿 기능 재사용) — 대상: `src/lib/project/*`, `src/components/workspace/*` · 완료 판정: 재실행 후 최근 목록에서 열림, 신뢰 전에는 에이전트 기능 비활성 · 선행: T1.14 · (F-PRJ-03)
- [x] T1.17 [레인 A · W1] 액티비티바·탭 타입 등록(pipeline·explorer·agent·templates·playground, welcome·brief·plan·prompts·design·review·export 등 빈 뷰) — 대상: `src/components/layout/*`, `Docs/Extension-Guide.md` 절차 · 완료 판정: 모든 탭이 빈 상태로 열림 · 선행: T1.4
- [x] T1.18 [레인 조정 · 마무리] M1 마무리: 데모 수행, `wiki/sources/milestone-m1.md`, 문서 동기화 · 완료 판정: 계획서 §2 M1 데모 ①~④ · 선행: T1.1~T1.17

## M2 에이전트 (branch: `feat/m2-agents`)

- [x] T2.0 D-018(세션 격리) 사용자 결정 반영 — 대상: `Docs/Planning/Decisions.md` · 완료 판정: Accepted 기록(2026-09-29) · 선행: —
- [ ] T2.1 에이전트 레지스트리(기본값·사용자 설정, `sessionOptions`, 지원 등급) — 대상: `src/lib/agents/registry.ts`, 전역 DB `agents` · 완료 판정: 스키마 테스트 · 선행: T1.6, T2.0 · (F-AGT-05)
- [ ] T2.2 ACP 어댑터 설치(버전 고정 npm 패키지를 앱 데이터에 1회 설치, 앱 소유 프로세스) — 대상: `process_commands.rs` · 완료 판정: `claude-agent-acp` 설치·버전 확인 · 선행: T1.15
- [ ] T2.3 Rust `agent_host`: 프로세스 spawn(cwd=프로젝트), initialize(fs capability), session/new(격리 옵션·mcpServers), prompt, cancel — 대상: `src-tauri/src/agent_host/*.rs` · 완료 판정: 목 ACP 에이전트 통합 테스트 · 선행: T1.8, T2.1 · (F-AGT-01)
- [ ] T2.4 권한 정책 모듈(D-010 + S3 규칙: `locations` canonicalize, `mcp__vanilla__` 식별, `allow_always` 숨김) — 대상: `src-tauri/src/agent_host/permission.rs` · 완료 판정: S3 시나리오 분류표 단위 테스트 전부 통과 · 선행: T2.3 · (F-AGT-02)
- [ ] T2.5 fs 요청 핸들러(스코프 검사) + 세션 로그 `.vanilla/sessions/<id>.jsonl` — 대상: `agent_host/fs.rs`, `agent_host/log.rs` · 완료 판정: 스코프 밖 거부 테스트 · 선행: T2.3
- [ ] T2.6 Tauri 명령·Channel 이벤트(세션 업데이트·권한 요청 스트림) — 대상: `src-tauri/src/commands/agent_commands.rs` · 완료 판정: 프런트 목 구독 테스트 · 선행: T2.3
- [ ] T2.7 프런트 에이전트 세션 Context(세션 상태·메시지·도구 호출·diff·사용량) — 대상: `src/lib/agents/SessionContext.tsx` · 완료 판정: 이벤트 리듀서 단위 테스트 · 선행: T2.6
- [ ] T2.8 에이전트 패널·우측 도크 UI(입력, 스트리밍, 도구 호출 카드, diff 뷰, 중단) — 대상: `src/components/agents/*` · 완료 판정: 실제 Claude Code로 대화·취소 · 선행: T2.7 · (F-AGT-01, F-AGT-03)
- [ ] T2.9 권한 다이얼로그(셸 명령 전문 표시, 이번만 허용/거부) — 대상: `src/components/agents/PermissionDialog.tsx` · 완료 판정: S3 `shell` 시나리오가 다이얼로그로 뜸 · 선행: T2.8 · (F-AGT-02)
- [x] T2.10 MCP 서버 `vanilla-tools` 골격(Streamable HTTP 127.0.0.1, 세션별 토큰, ping 도구) + 구현 방식 확정(rmcp vs Node) — 대상: `src-tauri/src/mcp_server/*` · 완료 판정: 에이전트가 ping 호출, 토큰 없는 요청 401 · 선행: T2.3 · (F-AGT-06)
- [x] T2.11 PTY 폴백(portable-pty + xterm.js 탭, AGY 실행) — 대상: `src-tauri/src/commands/pty_commands.rs`, `src/components/terminal/*` · 완료 판정: AGY가 터미널 탭에서 대화 가능 · 선행: T1.8 · (F-AGT-04)
- [ ] T2.12 Codex 재검증(설치 후 `acp-probe`) + 지원 매트릭스 문서화 — 대상: `wiki/sources/poc-s3.md` 갱신 · 완료 판정: 매트릭스 표 · 선행: T2.3
- [ ] T2.13 세션 재개(loadSession) — 대상: `agent_host`, `agent_sessions` 테이블 · 완료 판정: 앱 재시작 후 이어서 대화 · 선행: T2.8 · (F-AGT-07, S)
- [ ] T2.14 M2 마무리: 데모, `milestone-m2.md` · 선행: T2.1~T2.12

## M3 파이프라인 (branch: `feat/m3-pipeline`)

- [x] T3.1 파이프라인 상태 Context·`pipeline_state` 저장·파이프라인 사이드패널 — 대상: `src/lib/pipeline/PipelineContext.tsx`, `src/components/pipeline/*` · 완료 판정: 단계 표시·전환 테스트 · 선행: T1.17
- [ ] T3.2 Brief 편집기(구조화 폼 + 자유 서술, 브랜드 색·폰트 입력) + 자료 업로드(`brief/materials/`, 라이선스 메모) — 대상: `src/components/pipeline/brief/*` · 완료 판정: `brief/brief.md` 생성·재열기 · 선행: T3.1 · (F-PIP-01)
- [x] T3.3 프롬프트 프리앰블(영문) Plan·Prompts·Build·Revision + 조립기(파일 경로 참조, 출력 언어) — 대상: `src/lib/pipeline/prompts/*.md`, `src/lib/pipeline/assemble.ts` · 완료 판정: 조립 결과 스냅샷 테스트 · 선행: T3.1
- [x] T3.4 `plan.json` zod 스키마(`design` 필드, 토큰 참조 기본값) — 대상: `src/lib/pipeline/schemas/plan.ts` · 완료 판정: 예제 유효·무효 테스트 · 선행: T1.7
- [x] T3.5 [레인 D · W1] `src/lib/design` 이관(S7 파서·재작성·역할 파생·대비) + 테스트 이관 — 대상: `src/lib/design/*` · 완료 판정: S7 테스트 10개 통과 · 선행: T1.3 · (F-DSN-02)
- [ ] T3.6 Plan 생성 흐름: 요청 → 파일 감시 → `plan.json`·`DESIGN.md` 검증 → 오류 자동 재요청(최대 2회) → 사용자 표시 — 대상: `src/lib/pipeline/planStep.ts` · 완료 판정: 목 에이전트로 재요청 루프 테스트 · 선행: T2.7, T3.3, T3.4, T3.5 · (F-PIP-02)
- [x] T3.7 DESIGN.md 공식 CLI lint(워커 경유, stdin 닫기, `orphaned-tokens` 필터, 버전 고정) — 대상: `packages/export-worker/src/designLint.ts` · 완료 판정: 샘플 lint 결과 JSON · 선행: T1.3 · (F-DSN-02)
- [ ] T3.8 기획서 뷰어(스토리보드 카드·Asset 목록·타임라인 막대·파라미터 표·디자인 요약·`plan.md` 미리보기) — 대상: `src/components/pipeline/plan/*` · 완료 판정: 샘플 `plan.json` 렌더 · 선행: T3.4 · (F-PIP-03)
- [ ] T3.9 디자인 탭(토큰 시각화·원문 편집·검사 결과) — 대상: `src/components/design/DesignTab.tsx` · 완료 판정: 샘플 DESIGN.md 표시·수정 저장 · 선행: T3.5 · (F-DSN-04)
- [ ] T3.10 git 체크포인트(초기화·자동 커밋·히스토리 목록, git 없으면 폴더 스냅샷) — 대상: `src-tauri/src/commands/project_commands.rs`(checkpoint) · 완료 판정: 승인 시 커밋 생성 테스트 · 선행: T1.13 · (F-PRJ-04, D-013)
- [ ] T3.11 승인·수정 요청 흐름(Plan) — 대상: `planStep.ts`, 뷰어 · 완료 판정: 승인 → 체크포인트 → 다음 단계 활성화 · 선행: T3.8, T3.10 · (F-PIP-03)
- [x] T3.12 `tasks.json` 스키마 + 위상 정렬 + 순환 검출 — 대상: `src/lib/pipeline/schemas/tasks.ts`, `topo.ts` · 완료 판정: 단위 테스트 · 선행: —
- [ ] T3.13 Prompts 단계: 생성 요청, 트리 편집기(CodeMirror), 승인 — 대상: `src/components/pipeline/prompts/*` · 완료 판정: 샘플 트리 편집·승인 · 선행: T3.6, T3.12 · (F-PIP-04)
- [ ] T3.14 태스크 실행기(자동·한 단계씩, 일시정지·재시도, `task_runs` 기록, 태스크 후 체크포인트) — 대상: `src/lib/pipeline/runner.ts` · 완료 판정: 목 에이전트로 3개 태스크 순차 실행 테스트 · 선행: T3.12, T2.7, T3.10 · (F-PIP-05)
- [ ] T3.15 (S) 태스크 그래프 시각화(의존성·상태) — 대상: `src/components/pipeline/prompts/TaskGraph.tsx` · 완료 판정: 샘플 `tasks.json` 그래프 표시 · 선행: T3.12 · (F-PIP-06)
- [ ] T3.16 M3 마무리: 샘플 브리프로 Build까지 데모, `milestone-m3.md` · 선행: T3.1~T3.14

## M4 검수·런타임 (branch: `feat/m4-runtime` → `feat/m4-review`)

M4a 런타임 패키지 (`packages/runtime`, M2·M3와 병렬 가능)

- [x] T4.1 [레인 D · W1] `defineScene`·`param.*`·`useParams`(우선순위: 코드 < 토큰 < 사용자 값) — 대상: `packages/runtime/src/scene.ts`, `params.ts` · 완료 판정: 단위 테스트 · 선행: T1.3
- [x] T4.2 [레인 D · W1] 시계: clock 모드(preview·render, `hf-seek`+`waitUntil`) / free 모드(live), 전체 ↔ Scene 로컬 시간 — 대상: `packages/runtime/src/clock.ts` · 완료 판정: 시간 변환 테스트, S1 렌더 재현 · 선행: T4.1
- [x] T4.3 [레인 D · W1] 준비 신호 `registerAsset`, 폰트 `fonts.load`, Canvas `onCreated`, `__vanillaReady` — 대상: `packages/runtime/src/ready.ts` · 완료 판정: S2 대조 실험 재현(대기 없는 캡처와 다름, 대기 캡처 반복 동일) · 선행: T4.2
- [x] T4.4 [레인 D · W1] `<VanillaCanvas>`(render=never+advance, preview=demand, `preserveDrawingBuffer` 옵션) — 대상: `packages/runtime/src/canvas.tsx` · 완료 판정: S1 결정성 테스트 · 선행: T4.2
- [x] T4.5 [레인 D · W1] 디자인 토큰 Vite 플러그인 + `DesignProvider`·`useDesign`·CSS 변수 `--color-*` — 대상: `packages/runtime/src/design/*`, `packages/runtime/vite.ts` · 완료 판정: S7 측정 재현(교체 < 100ms) · 선행: T3.5 · (F-DSN-03)
- [x] T4.6 [레인 D · W1] Bridge 클라이언트(ready·time·error·hmr 보고, init·play·pause·seek·setParams·setDesign·goto·capture·reload 처리, origin 고정) — 대상: `packages/runtime/src/bridge.ts` · 완료 판정: 메시지 단위 테스트 · 선행: T4.2, T4.5
- [x] T4.7 [레인 D · W1] 결정성 도우미(`useSeededRandom`, `noise`, `ease`, `timeline`), `useInput` — 대상: `packages/runtime/src/helpers/*` · 완료 판정: 같은 시드 → 같은 값 테스트 · 선행: T4.1
- [x] T4.8 [레인 D · W1] `check_scene` 정적 규칙(ESLint 플러그인: 금지 시간 API(clock 유형), 하드코딩 색, `defineScene` 누락) — 대상: `packages/runtime/eslint-plugin/*` · 완료 판정: 규칙별 테스트 · 선행: T4.1 · (F-DSN-05)
- [x] T4.9 [레인 D · W2] 런타임 빌드·배포 경로(`resources/runtime`, 스캐폴딩에 포함) — 대상: `packages/runtime/package.json`, 빌드 스크립트 · 완료 판정: 새 프로젝트에서 런타임 import 성공 · 선행: T4.1~T4.6, T1.12

M4b 검수 스튜디오

- [ ] T4.10 프리뷰 서버 프로세스(`vite-runner.mjs`, 127.0.0.1, 포트 보고, 재시작) — 대상: `resources/workers/vite-runner.mjs`, `process_commands.rs` · 완료 판정: 프로젝트 열면 서버 기동, 종료 시 정리 · 선행: T1.15
- [ ] T4.11 미리보기 iframe + Bridge 호스트 Context(origin 검사, 비율 유지·확대·배경·기기 폭) — 대상: `src/lib/review/BridgeContext.tsx`, `src/components/review/Preview.tsx` · 완료 판정: CDP E2E로 ready 수신 · 선행: T4.10, T4.6 · (F-REV-01, F-REV-06)
- [ ] T4.12 HMR 누락 감지(Rust 파일 감시 + `hmr` 보고 비교 + `reload`/`init` 복원) — 대상: `src-tauri/src/watch.rs`, `BridgeContext.tsx` · 완료 판정: S4 30ms 연속 쓰기에서 최종본 표시 · 선행: T4.11
- [ ] T4.13 타임라인 스크러버(clock 유형: 재생·정지·프레임 이동·구간 반복·Scene 경계, free 유형: 재생/정지) — 대상: `src/components/review/Scrubber.tsx` · 완료 판정: 키보드 조작, 컴포넌트 테스트 · 선행: T4.11 · (F-REV-02)
- [ ] T4.14 파라미터 패널(스키마 → 폼, 즉시 반영, 저장 `params/*.values.json` + 체크포인트) — 대상: `src/components/review/ParamsPanel.tsx` · 완료 판정: 반영 < 100ms(CDP 측정) · 선행: T4.11 · (F-REV-03)
- [ ] T4.15 디자인 패널: 팔레트 교체(미리보기 `setDesign` → 적용 시 `colors` 재작성 + 본문 hex 갱신 + 체크포인트), 대비 경고 — 대상: `src/components/review/DesignPanel.tsx` · 완료 판정: 교체·되돌리기, 파일 바이트 보존 · 선행: T4.11, T3.5 · (F-PAL-02, F-PAL-04)
- [ ] T4.16 팔레트 라이브러리(내장 팔레트 로드, 검색·필터, `palette.json` 스키마) — 대상: `src/lib/design/palettes.ts`, `resources/palettes/`, 템플릿 사이드패널 탭 · 완료 판정: 목록·적용 · 선행: T4.15 · (F-PAL-01)
- [ ] T4.17 팔레트 편집기 탭(역할별 색, OKLCH 슬라이더, 잠금, 대비 표) — 대상: `src/components/design/PaletteEditor.tsx` · 완료 판정: 저장·재사용 · 선행: T4.16 · (F-PAL-03)
- [ ] T4.18 수정 요청(대상·시각·코멘트·스크린샷 `capture`, `reviews/R-NNN.md`, 계획서 Revision 절, 에이전트 요청) — 대상: `src/lib/review/revision.ts`, UI · 완료 판정: 목 에이전트로 R-001 생성·반영 흐름 · 선행: T4.11, T3.14 · (F-REV-04)
- [ ] T4.19 체크포인트 전/후 비교(스크린샷 나란히) — 대상: `src/components/review/Compare.tsx` · 완료 판정: 두 체크포인트 비교 표시 · 선행: T4.18, T3.10 · (F-REV-05, S)
- [ ] T4.20 MCP 도구 실구현: `snapshot_scene`(헤드리스 캡처), `check_scene`, `get_review`, `update_task_status` — 대상: `src-tauri/src/mcp_server/tools/*` · 완료 판정: 에이전트가 스냅샷을 보고 수정하는 데모 · 선행: T2.10, T4.3, T4.8 · (F-AGT-06)
- [ ] T4.21 CDP E2E 하네스(앱 실행 → 미리보기 흐름 검증) — 대상: `tests/e2e/*.mjs` · 완료 판정: CI 스크립트로 1개 시나리오 통과 · 선행: T4.11
- [ ] T4.22 M4 마무리: 데모 ①~⑥, `milestone-m4.md` · 선행: T4.1~T4.21

## M5 Export (branch: `feat/m5-export`)

- [ ] T5.1 export 워커 골격(작업 JSON 입력, NDJSON 진행률, 취소, 환경 변수: `DO_NOT_TRACK`·`HYPERFRAMES_SKIP_SKILLS`·FFmpeg 경로, `GEMINI_API_KEY` 제거) — 대상: `packages/export-worker/src/index.ts` · 완료 판정: 목 작업 실행 테스트 · 선행: T1.3, T1.15
- [ ] T5.2 작업 큐 Context·`export_jobs`·진행률·로그·취소 UI — 대상: `src/lib/export/*`, `src/components/export/*` · 완료 판정: 2개 작업 대기열 처리 · 선행: T5.1 · (F-EXP-08)
- [ ] T5.3 web/interactive: `vite build`(live) → zip — 대상: `packages/export-worker/src/web.ts` · 완료 판정: zip을 풀어 정적 서버로 열림 · 선행: T5.1 · (F-EXP-01)
- [ ] T5.4 스틸 캡처 공통(puppeteer-core + 관리 브라우저, 준비 신호 대기, 배율) — 대상: `packages/export-worker/src/capture.ts` · 완료 판정: 3840×2160 반복 동일 · 선행: T4.3, T5.1
- [ ] T5.5 image export(PNG/JPG/WebP, 변형 일괄) — 대상: `packages/export-worker/src/image.ts` · 완료 판정: 규격·배율별 파일 · 선행: T5.4 · (F-EXP-03)
- [ ] T5.6 slides 이미지 PPTX + PDF — 대상: `packages/export-worker/src/slides.ts` · 완료 판정: `verify-pptx.ps1`로 장수·크기 확인 · 선행: T5.4 · (F-EXP-04)
- [ ] T5.7 편집 PPTX(Beta): 번들 벤더링, `exportToPptx`, `wrap` 후처리, 폰트 파일·안내 동봉 — 대상: `packages/export-worker/src/slidesEditable.ts`, `resources/workers/vendor/dom-to-pptx.bundle.js` · 완료 판정: PowerPoint에서 텍스트 편집 가능·겹침 없음 · 선행: T5.6 · (F-EXP-05)
- [ ] T5.8 video: render 빌드 → HyperFrames render(`--workers` 메모리 기준, `data-no-timeline`) → MP4/WebM + 포스터 — 대상: `packages/export-worker/src/video.ts` · 완료 판정: 샘플 15초 1080p MP4, 두 번 렌더 동일 · 선행: T4.2, T4.3, T1.10 · (F-EXP-06)
- [ ] T5.9 export 옵션 다이얼로그(유형별) — 대상: `src/components/export/ExportDialog.tsx` · 완료 판정: 유형별 옵션 저장 · 선행: T5.2
- [ ] T5.10 임베드 패키지(ES 모듈 + Web Component + React 래퍼) — 대상: `packages/export-worker/src/embed.ts` · 완료 판정: 외부 HTML에서 `<vanilla-scene>` 동작 · 선행: T5.3 · (F-EXP-02, S)
- [ ] T5.11 M5 마무리: 5개 형식 데모, `milestone-m5.md` · 선행: T5.1~T5.9

## M6 템플릿·플레이그라운드 (branch: `feat/m6-templates`)

- [ ] T6.1 `vanilla-core` 스킬(런타임 계약, DESIGN.md 규칙, 파이프라인 파일 규칙, 심미 체크리스트) — 대상: `resources/skills/vanilla-core/SKILL.md` · 완료 판정: 샘플 브리프로 규칙 준수(토큰 사용, 금지 API 0건) · 선행: T4.8
- [ ] T6.2 `template.json`·`palette.json` 스키마 + 템플릿 설치(프로젝트에 복사, `.claude/skills`·`.agents/skills`) — 대상: `src/lib/templates/*` · 완료 판정: 스키마 테스트, 설치 결과 트리 · 선행: T1.13
- [ ] T6.3 내장 팔레트 24종(자체 제작, 라이트/다크·무드 태그, 대비 전부 통과) — 대상: `resources/palettes/*.json` · 완료 판정: 대비 테스트 전부 통과 · 선행: T4.16
- [ ] T6.4 내장 템플릿 1: 미니멀 에디토리얼 슬라이드(DESIGN.md·팔레트·예제·미리보기) — 대상: `resources/templates/editorial-slides/**` · 완료 판정: 새 프로젝트 → Build → export 품질 확인 · 선행: T6.1, T6.2 · (F-TPL-01)
- [ ] T6.5 내장 템플릿 2: 3D 제품 쇼케이스 영상 — 대상: `resources/templates/product-showcase-video/**` · 완료 판정: 동일 · 선행: T6.4 · (F-TPL-01)
- [ ] T6.6 내장 템플릿 3: 키네틱 타이포 웹 — 대상: `resources/templates/kinetic-type-web/**` · 완료 판정: 동일 · 선행: T6.4 · (F-TPL-01)
- [ ] T6.7 템플릿 갤러리(미리보기·태그·유형, 카드에서 팔레트 바꿔 보기) — 대상: `src/components/templates/*` · 완료 판정: 3종 표시·선택 · 선행: T6.4 · (F-TPL-02)
- [ ] T6.8 플레이그라운드 저장소·인덱스·플레이어(웹 iframe·video·이미지·PDF) — 대상: `src/lib/playground/*`, `src/components/playground/*` · 완료 판정: export 결과 추가·재생 · 선행: T5.2 · (F-PLY-01)
- [ ] T6.9 (S) 팔레트 추출·조화 생성·비교 스냅샷 — 대상: `src/lib/design/extract.ts`, `harmony.ts` · 완료 판정: 로고 이미지에서 핵심 4역할 배정 · 선행: T4.17 · (F-PAL-05~07)
- [ ] T6.10 (S) 템플릿 가져오기, 플레이그라운드 태그·검색, `frame.md` 지원, DESIGN.md 가져오기/내보내기, 사용자 팔레트 저장·가져오기·내보내기 · (F-TPL-03, F-PLY-02, F-DSN-06·07, F-PAL-08)
- [ ] T6.11 M6 마무리: 데모, `milestone-m6.md` · 선행: T6.1~T6.8

## M7 릴리스 준비 (branch: `feat/m7-release`)

- [ ] T7.1 인스톨러 설정(WebView2 부트스트래퍼, 리소스 포함 확인, 앱 데이터 경로) — 대상: `src-tauri/tauri.conf.json` bundle · 완료 판정: `pnpm tauri build` 산출물 설치 · 선행: M6
- [ ] T7.2 깨끗한 Windows VM 체크리스트 실행(Doctor 안내대로 준비 → 샘플 export) — 대상: `Docs/Verification/Clean-Install-Checklist.md` · 완료 판정: 전 항목 통과 · 선행: T7.1
- [ ] T7.3 사용자 문서(시작하기, Doctor, 파이프라인, export 형식별 제약) — 대상: `Docs/User-Guide/*` · 완료 판정: 문서 링크 앱 내 표시 · 선행: T7.1
- [ ] T7.4 라이선스 고지(NOTICE: HyperFrames·dom-to-pptx 등, FFmpeg GPL 다운로드 안내, 폰트 OFL) — 대상: `NOTICE.md`, 앱 정보 화면 · 완료 판정: 의존성 표와 일치 · 선행: T7.1
- [ ] T7.5 코드 서명·자동 업데이트(사용자 인증서 준비 후) — 대상: `tauri.conf.json` · 완료 판정: 서명된 인스톨러 · 선행: 사용자 체크리스트 P6
