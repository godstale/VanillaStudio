## [2026-11-01] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-11-01] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-11-01] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-18] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-06] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-06] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-06] lint | Wiki health check

Ran lint. See lint-report.md for details.

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

## [2026-09-30] milestone | M5 export done (lane O: T5.10+T5.11)
- Lane O done: T5.10 `embed.ts` (ES module + `<vanilla-scene>` + React wrapper, headless-Chrome verified), T5.11 demo 4/5 auto-pass (web zip, image variants + determinism, slides PPTX 3 / PDF 3p, embed). Video MP4 environment-blocked (workers:2 stall, workers:1 frame-0 stall / localhost blip) → T7.2. Handoffs to wave 7: slidesEditable evaluate-string bug, runViteBuild/Rust cwd unset, vanilla-export.mjs bundle unwired. Wrote [[milestone-m5]].

## [2026-09-30] lint | Wiki health check
- 50 pages, orphans 1 (`milestone-m5` — inbound from `overview.md` pending, coordinator links at merge), broken links 0. → `wiki/lint-report.md`

## [2026-09-30] milestone | M6 templates-playground done (lane W2: T6.11)
- Lane W2 done: M6 demo ①~④ in automation scope (3 templates × 5 contract checks, install plan, gallery, 24 palettes + extract/harmony, playground store/player/IO — M6 area 22 files 124 tests; full suite 107 files 722 tests). Manual remainder: template × palette quality compare, editable PPTX in PowerPoint, clean VM → T7.2. Wrote [[milestone-m6]].

## [2026-09-30] lint | Wiki health check (lane W2, T6.11)
- 53 pages, orphans 1 (wiki/sources/milestone-m6.md; overview.md 연결은 조정 세션에 인계), broken links 0. See: [[parallel-execution]]

## [2026-09-30] wave7 | W4 user-docs merged
- Lane W4 (T7.3) merged into feat/m2-agents (c95a891), no conflicts. User-Guide 4 docs plus in-app links card. See: [[parallel-execution]]

## [2026-09-30] wave7 | W3 release-config merged
- Lane W3 (T7.1, T7.4) merged into feat/m2-agents (0b1dfbe). Conflict: TODO T7.3/T7.4 checkboxes, kept both checked. Follow-ups: tauri.conf resources verified 6 entries incl. skills; license table corrected (jszip dual, design.md CLI field missing, fontsource OFL). pnpm tauri build not run (deferred to T7.2 VM). See: [[parallel-execution]]

## [2026-09-30] wave7 | W1 leftover-fixes merged, wave 7 complete
- Lane W1 (O handoffs x4) merged into feat/m2-agents (63a79cf), no conflicts. Fixed: slidesEditable IIFE+JSON, vite/Rust cwd=project, vanilla-export.mjs bundle wired, gallery-to-wizard wiring. All wave-7 lanes merged. See: [[parallel-execution]]

## [2026-09-30] all | final verification green, all automation done
- Full verification on feat/m2-agents: lint pass, typecheck pass, vitest 109 files 741 tests pass, cargo 166 pass 0 fail 4 ignored. All TODO automated items complete. Remaining: manual checks (real agent chat, PowerPoint editable PPTX, clean VM T7.2, code sign T7.5) and main merge approval. See: [[parallel-execution]]

## [2026-10-01] fix | white-screen CSP resume done, overview synced
- Resumed interrupted `fix/white-screen-csp` (devUrl `http://localhost:14200` blocked by old CSP → white screen in `pnpm tauri dev`). Fix keeps `frame-src 127.0.0.1` + localhost allowances (design §10 consistent). Verification: lint pass, typecheck pass, vitest 109 files 741 tests pass, `pnpm build` pass. Merged into main (push pending approval). Overview current-status updated from stale M2 to all-automation-done. Remaining manual: T7.2 clean VM, T7.5 code sign. See: [[overview]]

## [2026-10-01] lint | Wiki health check
- orphans 0, broken links 0. See lint-report.md for details.

## [2026-10-02] verify | T7.2 dev-machine run done, 4 defects fixed
- `Clean-Install-Checklist.md` v1.0 written and executed on dev PC (clean-VM rerun pending): `pnpm tauri build` OK (MSI 23.5MB + NSIS 19.9MB, unsigned), all 5 export formats via shipped bundle OK (web zip, PNG, slides PPTX 2/PDF, editable PPTX, video h264 3.0s + poster). PowerPoint COM: image deck + editable deck open, 1 text frame really edited+saved. Fixed: (1) bundle unconditional `Could not resolve proxy-agent` throw → `proxy-agent` 8.0.2 dep (MIT, §2.9) + no-stub regression test, (2) `kerberos` stub alias, (3) bundled CDP websocket failure → `pipe: true` launchers, (4) merged editable deck unopenable (shared notesSlide + stale app.xml) → strip+count fix with tests. Verification: lint pass, typecheck pass, vitest 109 files 745 tests pass. Remaining: clean-VM rerun, T7.5 (cert), real agent chat, tauri-dev visual check. See: [[overview]]

## [2026-10-02] lint | Wiki health check
- orphans 0, broken links 0. See lint-report.md for details.

## [2026-10-05] sample | Gangdong forest library promo motion graphic
- Saved the video-model prompt (`Docs/Prompts/Gangdong-Forest-Library-Promo-Video-Prompt.txt`, 6.8k chars, per `Docs/Commercial-Motion-Graphic-Prompt-Guide.txt`) and a hand-coded 10s Canvas version (`resources/samples/gangdong-forest-library-promo/index.html`, deterministic render(t), no deps). Registered in the playground (global DB row + files under `%APPDATA%/dev.vanilla.studio/playground/<id>/`, kind video, played by the web player). Sample only: no app code changed. See: [[overview]]

## [2026-10-05] plan | v2 refactor spec drafted
- Wrote `Docs/Planning/Refactor-Spec-v2.md` v0.1 + D-022~D-028 (Proposed) after interview. Awaiting user review. See: [[refactor-spec-v2]]

## [2026-10-05] decision | v2 spec v0.2: D-029~D-033 (Proposed)
- Interview round 2 applied to [[refactor-spec-v2]]: one sequence per workspace, global canvas, custom templates in v2.0, static-page input-driven steps, conditional v1 migration.

## [2026-10-05] decision | v2 spec v0.3: interview round 3
- [[refactor-spec-v2]]: canvas presets, static.mode scroll/steps, configurable global templatesDir. No open questions left; awaiting approval.

## [2026-10-05] update | v2 docs revised: Technical-Design v1.0, AGENTS.md v2, Implementation-Plan v2.0, TODO v2.0
- D-022~D-033 Accepted (D-010/D-018 Superseded). v1 plan/TODO/parallel guide moved to `Docs/Planning/legacy/`. Next: V1 foundation (T1.0). See: [[implementation-plan]], [[technical-design]], [[parallel-execution]]

## [2026-10-05] update | Legacy removal plan (T1.2)
- Added issue-v2-legacy-removal (units U1-U6, keep list, 3 open confirmations). See: [[issue-v2-legacy-removal]]

## [2026-10-05] poc | R-5 canvas spike
- @xyflow/react adopted: 100 nodes 60fps, 300 nodes 59.7fps. See: [[poc-r5]]

## [2026-10-05] milestone | V1 foundation
- T1.0-T1.13 done; GUI demos pending human check. See: [[milestone-v1]]

## [2026-10-05] milestone | V2 scenes and guides
- T2.1-T2.12 done. See: [[milestone-v2]]

## [2026-10-06] milestone | V3 guides and inspector
- T3.1-T3.14 done. See: [[milestone-v3]]

## [2026-10-06] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-06] milestone | V4 run and preview
- T4.1-T4.11 done; real Claude Code/Codex demo and GUI pending human check. See: [[milestone-v4]], [[poc-agent-terminal]]

## [2026-10-06] milestone | V5 reference analysis
- T5.1-T5.7 done; real agent demo and GUI pending human check. See: [[milestone-v5]]

## [2026-10-06] poc | R-1 scene transitions
- Two-iframe overlay adopted (60fps for 5 transitions); match-cut dropped from v2.0; custom transitions are declarative. See: [[poc-r1]]

## [2026-10-06] milestone | V6 sequence and playground
- T6.0-T6.8 done; GUI check pending. See: [[milestone-v6]]

## [2026-10-06] update | v1 migration ship gate
- 3 v1 samples converted and played back; migration ships. See: [[issue-v1-migration]]

## [2026-10-06] milestone | V7 package migration release
- T7.1-T7.7 done, T7.8 automated part done (installer built), T7.9 logs. Human checks pending. See: [[milestone-v7]], [[phase-p4-v2]]

## [2026-10-17] decision | D-034 agent-centric UI Accepted
- Sequence/Scenes/Templates/Gallery menus, floating inspector, no dock, comments.json contract. See: [[ui-agent-centric]], [[decisions]]

## [2026-10-17] lint | Wiki health check
- 69 pages, orphans 0, broken links 0. See: wiki/lint-report.md

## [2026-10-17] update | 앱 UI 다듬기(시퀀스·신·템플릿·플레이그라운드)
- 시퀀스 신 카드 타이틀 클릭 → 신 화면 이동, 신 화면 콘텐츠 전체 너비+플로팅 툴바·드래그 코멘트·신 우클릭 메뉴(열기·가이드 편집·터미널·폴더·시작신), 템플릿 상단 탭+갤러리 카드+즐겨찾기+적용 다이얼로그(신/시퀀스 대상 선택), 지정 외 우클릭 차단(AppShell 가드), 플레이그라운드 카드 클릭 → 우하단 1/4 플로팅 시퀀스 재생. 검증: lint·typecheck·vitest 154파일 1150테스트 통과.

## [2026-10-17] update | 신 화면 계약 검사 제거·플레이그라운드 시퀀스 단위 개편
- 신 화면 본문의 계약 검사(CheckPanel) 섹션 삭제(인스펙터 미리보기 탭은 유지). 플레이그라운드는 시퀀스 단위 등록 1카드(시퀀스 순서대로 신 썸네일)+재생은 우하단 플로팅 전용으로 개편, 큰 인라인 재생기 삭제. 검증: lint·typecheck·vitest 154파일 1150테스트 통과.

## [2026-10-18] decision | D-035 Opus 5.5 아카이브 분해·템플릿화 및 4대 매체 의도 추천 엔진 구현
- `yihui-dev/awesome-opus5-5-videos` 분석 반영: 내장 가이드 템플릿 12종(`opus-*@1`) + 분해형 세부 프리셋 15종(신/비트 구조·타이포그래피·모션 효과·3D 설정, `opus-catalog.json`) + 쇼케이스 레시피 22종 + WCAG AA 검증 컬러 팔레트 8종(`opus-*`) + 용어집 기법 20종 추가. 모든 항목에 미리보기 이미지(`previewUrl`)와 실시간 동작 확인 링크(`actionUrl`) 포함. 4대 매체 의도(`web`·`image`·`slide`·`motion`) 로컬 추천 엔진(`recommend.ts`) 및 `NewSceneDialog`·`SceneInspector`·`/templates` 연동 완료. → [[research-2026-10-18-awesome-opus55-videos]], [[decisions]]

## [2026-10-18] lint | Wiki health check
- 69 pages, orphans 0, broken links 0. See: wiki/lint-report.md

## [2026-10-18] decision | D-036 워크스페이스 비파괴 초기화 및 AI 에이전트 연동 브리지 구현
- 시작 시 미초기화 워크스페이스 상태 자동 정리 후 온보딩 표시. 빈 폴더·비어 있지 않은 폴더 모두 비파괴 초기화(`AGENTS.md`·`CLAUDE.md` 마커 병합, `VANILLA_GUIDE.md`·`WORK_ORDER.md`·`.vanilla/work-order.json`·`.vanilla/resources/`·`scripts/vanilla-agent.mjs` 생성). 스튜디오 변경 내역과 코멘트를 `WORK_ORDER.md`로 통합 기록하고 `pnpm vanilla` CLI 브리지로 에이전트 탐색·스캐폴딩·동기화·처리 완료 연동. → [[decisions]], [[ui-agent-centric]]

## [2026-10-18] lint | Wiki health check
- 69 pages, orphans 0, broken links 0. See: wiki/lint-report.md

## [2026-10-18] decision | D-037 스토리보드 & 3-문서 Material-First 워크플로 구현
- Storyboard(/storyboard) 최상단 메뉴 + storyboard.json/01-brief/02-design-flow/03-visual-direction/data 재료 계약(zod·canonical), 코멘트·작업지시서 원인 계층(layer)+taxonomyTags 및 WORK_ORDER 역추적 체크리스트, CLI storyboard/init-storyboard/taxonomy, 5단계 에이전트 프로세스, 텍소노미 7종 용어집 등록. 기본 진입은 /workspace 유지. → [[decisions]]

## [2026-10-18] ui | 작업 지시서 온보딩 개편(필수·고급·에이전트 시작 대기)
- 타이틀·매체 의도·핵심 한 줄을 필수 입력으로, 목적·포함·제외는 고급(접기) 항목으로. brief.title 스키마 추가(구 파일은 기본값 ''으로 호환), 01-brief·WORK_ORDER에 타이틀 기록.
- 저장 후에도 온보딩 화면을 유지하고 3초 간격으로 에이전트 시작 신호(단계 전진·문서/재료 갱신·sequence.json·scenes/)를 감시, 신호 때 스토리보드 보드로 전환. 시작 전 재편집·재저장 가능(자리 표시자 문서는 덮어쓰지 않음).

## [2026-10-18] release | feat/storyboard-brief-onboarding push
- 스토리보드 묶음 120파일 커밋(030d1f9) 후 origin에 push. main 병합 아님. 작업트리 잔여: 빌드 설정·Tauri 비-스토리보드 명령·신/워크스페이스 UI·agent-reach 스킬(미커밋 유지).

## [2026-10-18] fix | 실사용 검증 5건 수정
- 스캐폴드 초안 실행 불가·템플릿 조용한 교체+0건·static copy 문서 충돌·플레이어 전 키 다음 처리·마지막 단계 종료 멈춤을 `fix/scaffold-playground-5-issues`에서 수정. Bridge `input`(v2.1) 추가, 번들에 guides·opus 포함, 검사기에 컴포지션·useSteps 검사 추가. 검증: lint·typecheck·vitest 1173·cargo 127 통과. 상세: [[issue-playground-scaffold-fixes]]

## [2026-10-18] lint | Wiki health check
- 70 pages, orphans 0, broken links 0. See: wiki/lint-report.md

## [2026-10-18] decision | D-038 플레이그라운드 static 입력 타입 위임(Bridge `input` v2.1)
- 모든 키가 다음으로 처리되던 문제를 타입 입력 위임으로 수정한 결정. `input` 메시지·합성 디스패치·`stepForward()` 분리·종료 후 복구·런타임 갱신. D-032 확장. → [[decisions]]
## [2026-10-20] feature | Scene shared thumbnail poster.svg (D-039 Proposed)
- Empty scene/sequence thumbnails were all auto-capture .vanilla/thumb.png (local-only). Added committed poster.svg convention drawn in code by the agent, app fallback display, and AGENTS.md/guide-template instructions. See: [[poster-thumbnail-d039]]

## [2026-10-21] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-21] ui | 스토리보드·신·플레이 화면 개편(feat/storyboard-scene-play-vf)
- 스토리보드: 3대 문서 카드만 유지, MaterialsViewer·AssemblyPipeline 삭제. 시퀀스·디자인 상태 / 신별 설정·디자인 상태 / 수정 이력(work-order+코멘트) / 오류 카드를 추가하고 클릭 시 상세 팝업(Dialog).
- 신 화면: 하단 툴박스에서 상태 문구 제거, 경고·상태는 하단 반투명 토스트로 4초 표시. 신 이동 시 단계가 `-`로만 남던 버그를 Body key=slug 리마운트 + scene.json 기준 `1/N` 초기 표시로 수정.
- 플레이 화면: 타이틀 바 제거 → 반투명 오버레이(타이틀+신 정보 작은 폰트) + 오버레이 전체화면 버튼. SequencePlayer 하단을 신 툴박스 확장형 compact 바(h-10)로 축소. 전체화면에서는 `hideChrome`으로 재생 화면만 표시. 슬라이드용 ArrowLeft 이전 스텝·이전 신 이동 지원.
- 검증: lint·typecheck·vitest 159파일 1185테스트 통과.

## [2026-10-22] standalone-play | 워크스페이스 자체 빌드·발표(D-040, feat/standalone-play)
- 템플릿에 발표 화면(play.html+play/)·멀티 엔트리 빌드·play/preview 스크립트 추가, 루트 리다이렉트로 pnpm dev URL이 바로 재생 화면. Bridge v2 호스트+내비게이터, 전환은 컷/페이드 단순화.
- 검증: 5종 tsc·Day02_v2 vite build/preview+curl·컴파일 실행 테스트 10건·check:scene 23신 PASS·eslint clean. 기존 5종 tests/LLM_and_Vibe_Coding* 백필(로컬 전용).
- 결정 D-040 Accepted, 설계서 v1.2. See: [[standalone-play]]

## [2026-10-22] lint | Wiki health check

Ran lint (orphans 0, broken links 0). See lint-report.md for details.

## [2026-10-22] fix | Standalone play: `end` trigger for timed scenes

`play/host.ts`가 `ready`를 늦은 구독자에게 재생하도록 수정(템플릿·Day02 v2 워크스페이스 동일 적용). Day02 v2에 15초 인트로 모션 신(S00, 코드 합성 배경음) 추가 중 발견. See: [[standalone-play]]

## [2026-10-22] lint | Wiki health check

Ran lint (orphans 0, broken links 0). See lint-report.md for details.

## [2026-10-22] paused-arrow-advance | 일시정지 후 화살표 진행 무시 수정

- 영상 신에서 화면 클릭(일시정지 토글) 뒤나 시크/음량 슬라이더 포커스 상태에서는 → 키가 무시됐다. 매니저·내비게이터 input()이 일시정지 중에도 입력을 받도록 하고, 키 가드는 글자 입력란만 건너뛴다. 브랜치 feat/arrow-advance-after-pause. See: [[issue-paused-arrow-advance]]

## [2026-10-22] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-22] fix | 수업 배포 zip·무개입 설치 (D-041)

- 배포 zip 압축본의 다른-PC `pnpm install` 실패(ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION, caniuse-lite 발행 3시간 전)를 템플릿 차원에서 수정. `pnpm-workspace.yaml`(minimumReleaseAge: 0) + `pnpm pack`(Node 내장 zip, node_modules/dist/.vanilla/.git 제외) + AGENTS·VANILLA_GUIDE §8 문서화 + vitest/Rust 단언. 브랜치 fix/workspace-dist-pack. See: [[issue-dist-pack-pnpm-policy]], [[decisions]]

## [2026-10-22] lint | Wiki health check

Ran lint (74 pages, no structural issues). See lint-report.md for details.

## [2026-10-22] fix | dist rename, rooted zip, ASCII path guard (D-042)

- `pnpm pack`은 내장 tarball 명령이라 `pnpm dist`로 개명, zip 최상위는 `package.json` name. 한글 경로 `require` 세그폴트(3221225477) 이분 완료 — 상류/환경 문제라 `guard:path`+영문 경로 안내로 대응. See: [[issue-dist-pack-pnpm-policy]], [[decisions]]

## [2026-10-22] lint | Wiki health check

Ran lint (no structural issues). See lint-report.md for details.

## [2026-10-22] fix | Korean path partial support via ascii-cwd launcher (D-043)

- 한글 지원 요구에 D-042 전면 차단을 부분 지원으로 전환. 이분: 특정 한글 음절(숲 등) 포함 경로를 밟을 때 Node 22.13 리졸버/로더 네이티브 크래시, junction·subst·--preserve-symlinks 무용(실경로 정규화), esbuild postinstall은 검증용이라 생략 안전·승인 시 오히려 한글 설치 붕괴. scripts/ascii-cwd.mjs(코어만): node 스크립트는 junction 별칭 실행(한글 check:scene PASS 확인), vite는 영문 안내 exit 1. guard:path 삭제, pnpm-workspace.yaml allowBuilds 생략, Rust 스캐폴드 단언 갱신. 검증: 한글 install exit 0·영문 build 성공·vitest·cargo. See: [[issue-korean-path-ascii-launcher]], [[decisions]]

## [2026-10-22] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-22] fix | vite attempt-then-advise, nested exclusions, play docs (D-044)

- 한글 경로 vite 사전 차단을 시도 후 크래시(exit 3221225477) 시에만 안내로 변경(`강의` 정상·`숲` 크래시 실측). zip 제외 디렉터리를 전 깊이로 확장(신별 `.vanilla` 썸네일 제외), 직접 실행 판정 realpath 비교, 받는 쪽 안내 `pnpm play`로 통일, `VANILLA_GUIDE.md` §8 제목·`dist` 런처 문구 정정. wiki decisions 표에 D-043 누락분 보충.

## [2026-10-22] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-22] fix | 워크스페이스 히스토리 기록 일원화·zip 압축/불러오기 (D-045)

- 히스토리 기록을 WorkspaceContext로 일원화, "현재" 배지 추가. `workspace_archive.rs`(압축/복원)와 워크스페이스 화면·온보딩 UI 추가. Day01_v2 `play/`를 템플릿과 동기화(음량 조절). [[issue-workspace-history-archive]]

## [2026-10-22] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-22] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-22] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-22] fix | 미리보기 서버 시작 시 의존성 자동 설치

압축 파일로 불러오거나 node_modules가 없는 워크스페이스는 `usePreviewServer`가 `not-installed`를 받으면 고정 argv `pnpm install`(D-012)을 실행하고 서버를 다시 시작한다. 신뢰된 폴더에서만 동작한다(projectDir는 신뢰 후 설정).

## [2026-10-22] fix | 창 상태 복원, DOM 신 썸네일 캡처·자동 생성

`tauri-plugin-window-state`로 창 크기·위치·최대화를 복원한다. 런타임 `capture`가 `<canvas>`가 없는 신(모션 그래픽·정적)에서 실패해 썸네일이 비던 문제를 `domCapture`(SVG foreignObject 래스터화)로 해결했다. 코드가 있는 신(generated·needs-revision)에 썸네일이 없으면 워크스페이스를 열 때 `ThumbnailGenerator`가 숨은 미리보기로 하나씩 캡처해 `.vanilla/thumb.png`에 저장한다. 미리보기 서버는 사용자 수를 세어 마지막 사용자가 떠날 때만 멈춘다.

## [2026-10-22] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-10-22] fix | 프리뷰 서버가 pnpm 가상 스토어 밖 파일을 403으로 막던 문제

워크스페이스가 다른 pnpm 워크스페이스(앱 저장소 `tests/`) 안에 있으면 pnpm이 의존성을 상위 `node_modules/.pnpm`에 링크해, Vite `server.fs.allow` 밖이라 폰트 등이 403이 되고 신이 `A network error occurred.`를 보고했다. `vite-runner.mjs`가 프로젝트 의존성이 가리키는 `.pnpm` 스토어를 `fs.allow`에 추가한다(사용자 파일 `vite.config.ts` 수정 없음).

## [2026-10-22] docs | README·아키텍처·코드 구조 문서를 v2 기준으로 개정

`README.md`를 v2 앱 소개(핵심 개념·사용 흐름·기능·스택·구조·명령·문서 맵)로 재작성했다. `Docs/Architecture.md`는 Part A(v2 아키텍처 개요)를 추가하고 템플릿 내용을 Part B로 격하했으며, `Docs/Project-Structure.md`는 현재 트리(Part A)를 추가했다. `AGENTS.md` §0 표 8번 설명을 맞췄다. 썸네일 프레임 선택(`frameScore`)·워크스페이스 zip 보강 코드가 함께 커밋된다.

## [2026-10-22] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-11-01] feature | 템플릿·스타일 분리(D-046)

스타일 태그 200종을 수집해 `STYLE_LIBRARY.json`으로 재작성하고, 프로젝트 템플릿 8종과 사이드바 템플릿 화면 개편, `scene.json.styles`, `pnpm vanilla styles`를 추가했다. → [[research-2026-11-01-style-tags]]

## [2026-11-01] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-11-01] feature | 예제 라이브러리 준비(D-047)

`pnpm examples`, 카드 미리보기, 샘플 4종, 50개 배치 백로그를 추가했다. 대량 제작은 TODO TE.1부터. → [[research-2026-11-01-style-tags]]

## [2026-11-01] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-11-01] D-048 | TE.6·TE.7 완료

예제 라이브러리 468/473 완료(시연 불가 5종 스킵)로 TE.6 종료. TE.7 결정 D-048(워크스페이스 복사, references/examples/, 읽기 전용 참조·프롬프트에는 경로만 — 구현은 E 범위 밖 후속). TE.8 자동 확인분: pnpm build 성공, 예제 기여분 약 6.2MB(소스 청크 0.96MB 지연 로딩·프리뷰 5.19MB). 사람 GUI 확인 남음. [[decisions]]

## [2026-11-01] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-11-01] lint | Wiki health check

Ran lint. See lint-report.md for details.

## [2026-11-01] E done | 예제 라이브러리 완료·TE.8 사람 확인

468/473 예제 + 카드·확대·소스 보기·호버 재생 확인. TE.6·TE.7·TE.8 종료, `feat/examples-styles` 병합 예정. [[decisions]]
