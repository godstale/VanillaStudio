# Wiki Log (append-only)

> 형식: `## [YYYY-MM-DD] <type> | <title>` + 한두 줄. type: ingest · decision · phase · research · poc · milestone · lint · update

## [2026-09-28] phase | P0 준비 확인
- 템플릿 원본을 git 기준 커밋(master 65272b8)으로 보존, `docs/planning` 브랜치 생성. → [[phase-p0-setup]]

## [2026-09-28] ingest | 요구사항 원본
- `Docs/Vanilla-Studio-Requirements.txt` → [[vanilla-studio-requirements]], 원본 `wiki/originals/`에 보관.

## [2026-09-28] research | 에이전트 연동·렌더·PPT·라이선스
- ACP·HyperFrames·Remotion·GSAP·dom-to-pptx·AGY 조사. → [[research-2026-09-28-agents-rendering]]

## [2026-09-28] decision | D-001~D-010 Accepted (인터뷰 3라운드)
- ACP+터미널, MVP 4유형, PPT 이중 방식, HyperFrames, Windows+Doctor, 오픈 라이선스 에셋, 파라미터+스크러버, Agent Skill 템플릿, 폴더=프로젝트, 파일 자동·셸 확인. → [[decisions]]

## [2026-09-28] decision | D-011~D-014 Proposed
- 공통 Scene 런타임, 앱 소유 프로세스 분리, git 체크포인트, 에이전트용 MCP 도구. 사용자 확인 대기.

## [2026-09-28] ingest | 기획 문서 4종
- [[product-spec]], [[technical-design]], [[feasibility-risks]], [[decisions]]

## [2026-09-28] phase | P2 상세 기획 완료
- 플레이북(`Docs/Playbook/`), AGENTS.md 갱신, wiki 구축. → [[phase-p2-planning]]

## [2026-09-28] lint | Wiki health check
- 33 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-28] update | P0 기준선 검증
- Node 22.13 / pnpm 10.32 / rustc 1.97. lint·typecheck·test(10) 통과. → [[phase-p0-setup]]

## [2026-09-29] research | DESIGN.md·HyperFrames 프리셋·카탈로그
- 사용자 지정 링크 2건 보관 + DESIGN.md 형식 조사. → [[research-2026-09-29-design-md-hyperframes]]

## [2026-09-29] decision | D-015·D-016 Accepted, D-017 Proposed
- 프로젝트 DESIGN.md 표준, 컬러 팔레트 = 색 역할 토큰 교체, HyperFrames 자료는 참고용. → [[decisions]]

## [2026-09-29] update | 기획 문서 v0.2 (디자인 시스템·팔레트)
- Product-Spec §8·§5.7, Technical-Design §4.4, Feasibility-Risks §2.10·S7, AGENTS.md §4-6. → [[DesignMd]], [[ColorPalette]], [[phase-p2-planning]]

## [2026-09-29] lint | Wiki health check
- 36 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] decision | D-011~D-014·D-017 Accepted
- D-011 범위 수정(시간 함수 계약은 영상·이미지 계열만), D-014 MVP 필수. 기획서·설계서 v0.3. → [[decisions]], [[SceneRuntimeContract]]

## [2026-09-29] lint | Wiki health check
- 36 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] phase | P3 구현 계획 시작
- 기획 브랜치를 master에 병합·origin 푸시 후 PoC 착수. → [[DevelopmentPhases]]

## [2026-09-29] poc | S1 HyperFrames + React/R3F 렌더 통과
- MP4 2회 렌더 바이트 동일(450프레임, 약 18초). 워커 첫 프레임 경쟁 조건 해결, FFmpeg GPL 빌드 필요. → [[poc-s1]]

## [2026-09-29] lint | Wiki health check
- 37 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] poc | S3 Rust ACP + Claude Code (조건부 통과)
- 세션·스트리밍·권한·MCP(stdio/HTTP)·취소 동작. 기본 설정은 읽기 전용 셸을 확인 없이 실행 → 세션 격리 필요. Codex 미검증. → [[poc-s3]]

## [2026-09-29] decision | D-018 Proposed
- 에이전트 세션 격리: 사용자 전역 설정 제외 + 셸 ask 규칙. → [[decisions]], [[PermissionPolicy]]

## [2026-09-29] lint | Wiki health check
- 38 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] poc | S4 WebView2 iframe + Bridge 통과
- 반영 p95 34ms, HMR 27ms, iframe IPC는 ACL 거부. 연속 쓰기 HMR 누락 발견 → 파일 감시·reload 대응 설계. → [[poc-s4]]

## [2026-09-29] lint | Wiki health check
- 39 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] poc | S7 DESIGN.md 토큰 파이프라인 통과
- 교체 p95 34ms, HMR 26ms, 바이트 보존 재작성. 역할 핵심 4 + 파생 5, CSS 변수 `--color-*`로 설계 수정. → [[poc-s7]]

## [2026-09-29] lint | Wiki health check
- 40 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] poc | S2 스틸 캡처 + 이미지 PPTX/PDF 통과
- @2x 캡처 0.3~0.5초, 준비 신호 없으면 WebGL 누락·대체 폰트(대조 실험). PowerPoint COM으로 PPTX 검증. → [[poc-s2]]

## [2026-09-29] lint | Wiki health check
- 41 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] poc | S6 Windows Doctor + FFmpeg 다운로드 통과
- 13개 항목 5초, 최소 PATH 모의, FFmpeg 190MB·SHA-256 23초. fresh PATH·FFmpeg 버전 고정 필요. → [[poc-s6]]

## [2026-09-29] lint | Wiki health check
- 42 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] poc | S5 dom-to-pptx 편집 PPTX 조건부 통과
- 텍스트 편집·위치 정확. 웹 폰트는 PowerPoint가 무시(설치 폰트 조건), wrap 후처리 필요, 효과는 근사치 → Beta 유지. → [[poc-s5]]

## [2026-09-29] lint | Wiki health check
- 43 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] ingest | 구현 계획서 v1.0 + TODO
- 마일스톤 M1~M7, TODO 98개 항목(대상·완료 판정·선행·기능 ID). → [[implementation-plan]]

## [2026-09-29] phase | P3 구현 계획 완료
- PoC 7건, 설계 반영, 계획서·TODO. 다음: P4 M1. → [[phase-p3-implementation-plan]]

## [2026-09-29] lint | Wiki health check
- 45 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] decision | D-018 Accepted
- 에이전트 세션 격리(전역 설정 제외 + 셸 ask 규칙) 사용자 승인. AGENTS.md §7 반영. → [[decisions]], [[PermissionPolicy]]

## [2026-09-29] ingest | 골든 샘플 초안
- 유형별 5종(G1~G5), 자동 검사 A1~A7 + 루브릭. 사용자 확정 대기. → [[golden-samples]]

## [2026-09-29] lint | Wiki health check
- 46 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] update | P4 병렬 실행 준비
- 진입점(웨이브 0: T1.1→T1.3), 웨이브·레인 배치, 공유 파일 규칙, 세션 프롬프트. TODO에 [레인·웨이브] 태그. → [[parallel-execution]]

## [2026-09-29] lint | Wiki health check
- 47 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] update | 기본 브랜치 이름 변경
- `master` → `main`. AGENTS.md·구현 계획·병렬 실행 가이드·P4 프롬프트의 브랜치 이름 갱신(과거 기록은 그대로). → [[overview]]

## [2026-09-29] update | M1 웨이브 0 (T1.1, T1.3)
- `pnpm tauri dev` 기준선 확인(창 뜸, 콜드 빌드 ~1분). pnpm 워크스페이스 도입: `packages/runtime`, `packages/export-worker`(빈 패키지+스모크 테스트). 루트 typecheck에 패키지 typecheck 연결, lint·vitest는 `packages/**` 자동 포함, spikes 제외 유지. → [[phase-p0-setup]]

## [2026-09-29] lint | Wiki health check
- orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] milestone | M1 기반 완료
- 웨이브 0~2 병합(`feat/m1-foundation`), 통합 수정(.vanilla·DB 경쟁·경로 접두어·마법사-설치 연결), 실제 앱 CDP 확인. 결정안 D-019~D-021(Proposed). → [[milestone-m1]]

## [2026-09-29] lint | Wiki health check
- orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] wave4 | E2 host follow-up done
- Lane E2 (T2.10 verdict, T2.13, T2.12) done, awaiting merge. T2.10 verdict: Rust rmcp+axum, Node sidecar rejected. Server name vanilla-tools fixed. Doc updates requested: Implementation-Plan.md s6 MCP warning removal, Technical-Design.md s3.2 stale mcp prefix, Started.resumed mirror passed to lane F. See: [[parallel-execution]]

## [2026-09-29] lint | Wiki health check
- Ran lint. See lint-report.md for details.

## [2026-09-29] wave4 | K checkpoint-skill done
- Lane K (T3.10, T3.15, T6.1) done, awaiting merge. Follow-ups passed on: bundle resources skills entry for T6.2 lane, checkpoint_init wiring in wizard for T3.11 lane. See: [[parallel-execution]]

## [2026-09-29] wave4 | F agent-frontend done
- Lane F (T2.7, T2.8, T2.9) done, awaiting merge. Human check needed: real Claude Code session start, chat, cancel, shell permission dialog. Leftover: ActivityBar agent icon still opens left EmptyPanel (SidePanel.tsx out of lane scope) for follow-up lane. See: [[parallel-execution]]

## [2026-09-29] wave4 | X export-worker done
- Lane X (T5.1, T5.3, T5.4, T5.5, T5.6, T5.8) done, awaiting merge. Deps added: jszip, puppeteer-core, pptxgenjs, pdf-lib (Feasibility-Risks s2.9 entry left to coordinator). Note: pipeline.test.tsx one flaky failure in lane H area, passed on rerun. See: [[parallel-execution]]

## [2026-09-29] wave4 | V review-studio done
- Lane V (T4.10, T4.11, T4.12, T4.13, T4.14, T4.21) done, awaiting merge. E2E run-review-preview.mjs PASS. New dep: notify 8.2.0. T4.14 checkpoint hookup left for T3.11 lane. All 5 wave-4 lanes now complete. See: [[parallel-execution]]

## [2026-09-29] wave4 | merged into feat/m2-agents
- All 5 lanes merged (K 2682d41, E2 6daac8a, X aaac3eb, V 886b80f, F 6492cd5). Conflicts: i18n ko/en only, kept both prefixes. Fix: raw NUL in ParamsPanel.tsx replaced with unicode escapes. Verification: lint pass, typecheck pass, vitest 68 files 484 tests pass, cargo 137 pass 0 fail 4 ignored. See: [[parallel-execution]]

## [2026-09-29] milestone | M2 agent milestone done
- T2.14 done by coordinator: verification (lint, typecheck, vitest 484, cargo 137) plus manual-check handoff. Wrote [[milestone-m2]]. Manual checks deferred: real agent chat, editable PPTX in PowerPoint, clean VM.

## [2026-09-29] lint | Wiki health check
- Ran lint. See lint-report.md for details.

## [2026-09-29] lint | Wiki health check
- Ran lint. See lint-report.md for details.

## [2026-09-29] lint | Wiki health check
- Ran lint. See lint-report.md for details.

## [2026-09-29] wave5 | P pipeline-flow merged
- Lane P (T3.6, T3.13, T3.11, T3.14) merged into feat/m2-agents (50fea64), no conflicts. Runner API (createRunner, runAll, TaskRunRecord) handed to lane R2 for T4.18. See: [[parallel-execution]]

## [2026-09-29] wave5 | D2 palette merged
- Lane D2 (T4.15, T4.16, T4.17) merged into feat/m2-agents (d23328e), no conflicts. Follow-up: unified palette.json contract on src/lib/design/palettes.ts, templates/palette.ts is now an alias re-export (both suites pass). See: [[parallel-execution]]

## [2026-09-30] wave5 | X2 export-UI merged
- Lane X2 (T5.2, T5.9, T5.7) merged into feat/m2-agents (dfdb8f7). Conflict: CenterWorkspace prompts tab (P lane PromptsTab kept, X2 export case kept, stale EmptyTabView dropped). Note: vanilla-export.mjs bundle not wired yet, deferred to T5.11/release. See: [[parallel-execution]]

## [2026-09-30] wave5 | R2 revision-MCP merged, wave 5 complete
- Lane R2 (T4.20, T4.18, T4.19) merged into feat/m2-agents (8e5470d), no conflicts (lane rebased onto P merge first). Notes accepted: snapshot_scene serves host captures (.b64 sidecar, real headless stays in T5.4); update_task_status writes claim board file, runner treats done as claim. All 5 wave-5 lanes merged. See: [[parallel-execution]]

## [2026-09-30] wave5 | verification green, wave 5 complete
- Full verification on feat/m2-agents: lint pass, typecheck pass, vitest 90 files 632 tests pass, cargo 165 pass 0 fail 4 ignored. Fixed: stray char from X2 merge (CenterWorkspace), flaky pipeline restore test (waitFor on holder.api). Wave 5 all merged: T2, P, D2, X2, R2. See: [[parallel-execution]]

## [2026-09-30] milestone | M3 pipeline milestone done
- T3.16 done by lane M: mock-based end-to-end demo (brief, plan retry loop, viewer approval, prompts, 3-task runner, task graph, design tab) on feat/m2-agents code. Wrote [[milestone-m3]]. Manual remainder: real-agent Build demo. See: [[milestone-m3]]

## [2026-09-30] milestone | M4 review-runtime done
- T4.22 done by lane N: demos ①~⑥ in automation scope (unit suites + harness re-check, live WebView2/manual/agent-chat/clean-VM excluded and listed). Wrote [[milestone-m4]]. Verification: lint pass, typecheck pass, vitest 90 files 632 tests pass, cargo 165 pass 0 fail 4 ignored. See: [[parallel-execution]]

## [2026-09-30] lint | Wiki health check
- Ran lint. See lint-report.md for details.

## [2026-09-30] lint | Wiki health check (lane N, T4.22)
- 50 pages, orphans 1 (wiki/sources/milestone-m4.md; overview.md 연결은 조정 세션에 인계), broken links 0. See: [[parallel-execution]]

## [2026-09-30] wave6 | Q1 palettes merged
- Lane Q1 (T6.3, T6.9) merged into feat/m2-agents (f8f6857), no conflicts. Built-in palettes now 24. See: [[parallel-execution]]

## [2026-09-30] wave6 | Q2 templates merged
- Lane Q2 (T6.4, T6.5, T6.6, T6.7) merged into feat/m2-agents (0cadf96). Conflict: TODO T6.3-T6.7 checkboxes, kept all checked. Leftover: gallery select-to-wizard wiring for T6.10/wave 7. See: [[parallel-execution]]

## [2026-09-30] wave6 | Q3 playground merged
- Lane Q3 (T6.8, T6.10) merged into feat/m2-agents (8ed3c1b). Conflicts: TODO checkboxes and i18n ko/en, kept both. Accepted: playground as DB reference index (app state per design s8.1; copy_to_playground Rust cmd may follow), 0004 migration file approach. See: [[parallel-execution]]
