# Vanilla Studio v2 TODO

- 문서 버전: **v2.0 (2026-10-05)** · 계획: `Implementation-Plan.md` · v1 TODO(M1~M7 완료 이력): `legacy/TODO-v1.md`
- 항목 형식: `[ ] ID [레인 · 웨이브] 작업 — 대상 · 완료 판정 · 선행 · (결정/요구)`
- 공통 완료 조건: `pnpm lint`·`typecheck`·`test` 통과(Rust 변경 시 `cargo test`도). UI 문구는 ko/en 사전, 색상은 시맨틱 토큰(AGENTS.md §3). 문서만 변경하면 wiki lint(orphans·broken 0).
- 항목을 끝내면 체크하고 논리 단위로 커밋한다. 마일스톤을 끝내면 `wiki/sources/milestone-v<N>.md`를 작성한다.
- 승인된 결정: D-022~D-033(`Decisions.md`). 파괴적 작업(레거시 삭제·태그)은 **사용자 확인 후** 수행한다.

## ▶ 진입점 (2026-10-05)

- **기획·설계·지침 문서 개정 완료**(`docs/v2-refactor-spec` 브랜치, main 병합·push는 사용자 승인 대기).
- **다음 작업**: v2 구현 V1~V7 완료. **사람 확인 대기**: GUI(`pnpm tauri dev`)·클린 VM 설치·실제 Claude Code/Codex 데모·코드 서명(`Docs/Verification/Clean-Install-Checklist-v2.md`). 로컬 `main`에는 V1~V6이 병합되어 있고 `feat/v2-release`(V7)는 병합 전. **병합·push는 사용자 승인 대기.**
- **예제 대량 제작**: 준비 완료. "E 예제 라이브러리" 절의 TE.1부터 진행한다(D-047).
- 이월 항목(v1): T7.2 클린 VM 재실행·T7.5 코드 서명은 V7.7에서 이어받는다.

---

## E 예제 라이브러리 (branch: `feat/examples-<batch>`, 선행 `feat/template-style-split` 병합)

항목별 목록은 `Examples-Backlog.md`, 제작 규칙과 시작 프롬프트는 `resources/examples/README.md`를 따른다. 배치별 소유 경로는 `resources/examples/<kind>/<id>/`뿐이다. 배치 완료 판정: `pnpm examples check` 통과, 전 항목 `preview.webp` 육안 확인, 건너뛴 항목 보고. 항목 수는 473개, 샘플 4개를 포함한다.

- [x] TE.0 [단독] 예제 구조·`pnpm examples`·카드 표시·샘플 4종·백로그 — 대상: `scripts/examples.mjs`, `src/lib/examples/`, `resources/examples/` · (D-047)
- [x] TE.1 [병렬 · 1순위] 프로젝트 템플릿 E25(7개 남음) — 다른 배치의 시각 기준이 되므로 먼저 끝낸다 — 완료: `feat/examples-styles`에 7종 추가, `pnpm examples check` 통과
- [x] TE.2 [병렬 · 1순위] 스타일 E01~E24(198개 남음) — family별 배치, 동시 실행 가능 — 완료: style 200/200, `pnpm examples check` 통과
- [ ] TE.3 [병렬 · 2순위] 구성 기법 E32~E47(181개, 미리보기 없음 161개) — 코드로 시연이 어려운 용어는 건너뛰고 보고
- [x] TE.4 [병렬 · 2순위] 팔레트 E48~E50(31개 남음) — `palette/blush-ledger` 레이아웃을 재사용해 색만 교체 — 완료: 31종 추가, `pnpm examples check` 통과
- [ ] TE.5 [병렬 · 3순위] 신 가이드 E26~E27(15개), 세부 프리셋 E28~E29(15개), 레시피 E30~E31(22개) — 외부 이미지를 오프라인 예제로 교체
- [ ] TE.6 [단독 · 배치 병합마다] 병합 담당: `pnpm examples check`·`pnpm examples backlog` 실행 후 백로그 커밋, 전체 완료 시 `pnpm examples status` 기록
- [ ] TE.7 [단독 · 마무리] 에이전트 참조 제공 — `example.html`을 워크스페이스나 CLI로 전달할지 결정(D-047 범위 밖) · 선행: TE.2
- [ ] TE.8 [사람 확인] `pnpm tauri dev`에서 카드 호버 재생·확대 보기·소스 보기, 전체 완료 후 번들 크기 확인

---

## V1 기반 정리 (branch: `feat/v2-foundation`)

- [x] T1.0 [단독 · W0] 문서 브랜치 병합(사용자 승인 후)·`v1-final` 태그(현 main 기준) — 대상: git · 완료 판정: 태그 존재, `Docs/Planning/*` v2 문서가 main에 있음 · 선행: 사용자 승인
- [x] T1.1 [레인 A · W1] **PoC R-5**: `@xyflow/react` 스파이크(100노드 팬/줌 성능, ComfyUI형 커스텀 노드·엣지·미니맵·다크 스타일) — 대상: `spikes/r5-canvas/`, `wiki/sources/poc-r5.md` · 완료 판정: 채택/기각 결론과 수치 기록, 라이선스 `Feasibility-Risks.md` §2.9 · 선행: T1.0
- [x] T1.2 [레인 B · W1] 레거시 제거 계획서(모듈별 삭제 목록·`vanilla.json` 읽기 스키마 이관 대상·의존 그래프) — 대상: `wiki/sources/issue-v2-legacy-removal.md` · 완료 판정: 삭제 단위별 lint·typecheck·test 영향 표, 사용자 확인 획득 · 선행: T1.0
- [x] T1.3 [레인 B · W2] 레거시 제거 실행(ACP `agent_host`·`mcp_server`·`agent_commands`, `src/lib/{agents(ACP),pipeline,review}`·해당 components, 프로젝트 마법사, 탭·파이프라인 레이아웃) — 대상: T1.2 목록 · 완료 판정: 모듈 단위 커밋마다 lint·typecheck·test·`cargo test` 통과, 참조 0건(grep) · 선행: T1.2 · (D-022)
- [x] T1.4 [레인 B · W2] `vanilla.json` 읽기 스키마를 `src/lib/migrate/legacy-schema.ts`로 이관, 나머지 삭제 — 대상: `src/lib/project/*` · 완료 판정: 마이그레이션 입력 테스트 통과 · 선행: T1.3
- [x] T1.5 [레인 C · W1] canonical 직렬화(`src/lib/json/canonical.ts`: 키 순서·2-space·LF·시간 소수 3자리) + 왕복 테스트 — 대상: `src/lib/json/*` · 완료 판정: 같은 입력 → 같은 바이트 테스트 · 선행: T1.0 · (D-023)
- [x] T1.6 [레인 C · W1] `workspace.json` zod 스키마·타입(`workspaceId`·`name`·`canvas`·`defaultAgent`·`view`) + 캔버스 프리셋(16:9·9:16·1:1·사용자 지정) — 대상: `src/lib/workspace/schema.ts`, `src/lib/types/workspace.ts` · 완료 판정: 유효·무효 예제 단위 테스트 · 선행: T1.5 · (D-029, D-030)
- [x] T1.7 [레인 C · W2] DB 마이그레이션 0004(제거 테이블 drop, `workspaces`·`terminal_sessions` 추가, `app_settings`에 `templatesDir`) — 대상: `src/lib/db/migrations/0004*.sql`, `client.ts` · 완료 판정: 마이그레이션 테스트(기존 DB → 신 스키마) · 선행: T1.3
- [x] T1.8 [레인 C · W2] Rust 워크스페이스 명령: 생성·열기·스코프 검사·신뢰 확인 저장·`workspaceId` 발급 — 대상: `src-tauri/src/commands/workspace_commands.rs` · 완료 판정: `cargo test`(스코프 밖 거부, 심링크, 빈 폴더 vs 기존 워크스페이스 판별) · 선행: T1.6 · (AGENTS.md §7) — 신뢰 확인 저장은 T1.7(DB `workspaces`)·T1.11에서 연결
- [x] T1.9 [레인 C · W2] 워크스페이스 스캐폴딩 원본(`resources/workspace-template/`: `workspace.json`·`AGENTS.md`(식별 헤더 `workspaceId`·시퀀스 1개 규칙)·`CLAUDE.md`(`@AGENTS.md`)·`DESIGN.md`·`package.json`·`vite.config.ts`·`.gitignore`·`CREDITS.md`) + 렌더/복사 명령 — 대상: `resources/workspace-template/**`, `workspace_commands.rs` · 완료 판정: 복사한 폴더에서 `pnpm install && pnpm dev` 동작, 루트 `AGENTS.md`에 이름·ID 헤더 · 선행: T1.8 · (D-029)
- [x] T1.10 [레인 D · W2] 앱 셸: 사이드바(Workspace·Scenes·Playground·Settings)·메인 영역·우측 인스펙터 슬롯·하단 도크 슬롯, 라우팅(`HashRouter`) — 대상: `src/components/layout/*`, `src/App.tsx`, i18n · 완료 판정: 4개 화면 빈 상태로 이동, 탭 시스템 제거 · 선행: T1.3 · (`Docs/Extension-Guide.md` 갱신)
- [x] T1.11 [레인 D · W3] 온보딩 화면(작업 폴더 선택 → 새 워크스페이스 생성 또는 기존 열기, 신뢰 확인, 이름·캔버스 프리셋 입력, pnpm install 동의) — 대상: `src/components/workspace/Onboarding.tsx`, `WorkspaceContext` · 완료 판정: 첫 실행 → 폴더 선택 → 워크스페이스 생성 → 셸 진입 · 선행: T1.9, T1.10, T1.7 · (F-PRJ-01 개정)
- [x] T1.12 [레인 D · W3] 워크스페이스 스위처(사이드바 상단: 최근 목록·열기·새로 만들기) + 전환 시 프로세스·터미널 정리 확인 — 대상: `src/components/workspace/Switcher.tsx` · 완료 판정: 두 워크스페이스 전환·재실행 후 복원 · 선행: T1.11 · (D-029)
- [x] T1.13 [레인 A · W2] 빈 캔버스: `@xyflow/react`(T1.1 채택 시) 팬/줌/미니맵/그리드, ComfyUI형 스타일 토큰(`DESIGN.md`·`BRANDING.md` 반영), 뷰포트 저장(`workspace.json.view`) — 대상: `src/components/canvas/*` · 완료 판정: 재실행 후 뷰포트 복원, 100노드 더미 성능 기록 · 선행: T1.1, T1.10
- [x] T1.14 [단독 · 마무리] V1 마무리: 데모 ①~④, `Docs/Project-Structure.md`·`Extension-Guide.md` 갱신, `wiki/sources/milestone-v1.md` · 완료 판정: 계획서 §2 V1 데모 · 선행: T1.0~T1.13

## V2 Scene CRUD·지침 생성 (branch: `feat/v2-scenes`)

- [x] T2.1 [레인 A · W1] `scene.json` zod 스키마: 공통 필드(+`type`·`template`·`brief`·`references`·`userPrompt`·`runtime`·`status`) + 타입별 확장 골격(`static`: `mode`·`steps`, `motion`: `beats`·`copy`·`endCard`…, `3d`: 씬 필드) — 대상: `src/lib/scene/schema.ts`, `src/lib/types/scene.ts` · 완료 판정: 타입별 유효·무효 테스트, `beats` 시간 합·`endCard.holdSeconds ≥ 0.7` 검증 · 선행: T1.5 · (D-023, D-024, D-030)
- [x] T2.2 [레인 B · W1] Rust 신 명령: slug/`sceneId` 발급·폴더 스캐폴딩(`scenes/<slug>/{src,params,prompts,references/analysis,.vanilla}`)·이름 변경·삭제(휴지통)·복제 — 대상: `src-tauri/src/commands/scene_commands.rs` · 완료 판정: `cargo test`(트리 검증, slug 충돌, 스코프 밖 거부) · 선행: T1.8
- [x] T2.3 [레인 A · W2] 신 생성 다이얼로그(이름·타입·템플릿 선택) + 캔버스 우클릭/`+`로 노드 추가, 노드 위치 저장(`sequence.json` 노드 pos — 시퀀스 파일은 V6 전까지 최소 골격) — 대상: `src/components/scene/NewSceneDialog.tsx`, 캔버스 · 완료 판정: 3타입 신 생성 → 폴더·`scene.json` 생성, 노드 표시 · 선행: T2.1, T2.2, T1.13 · (F-SCN-01)
- [x] T2.4 [레인 A · W2] Scene 노드 컴포넌트(타입 아이콘·이름·상태 배지·썸네일 자리·길이·레퍼런스 수·`에이전트 실행`/`재생`/`폴더 열기` 버튼 자리, 입출력 핸들) — 대상: `src/components/canvas/SceneNode.tsx` · 완료 판정: 컴포넌트 테스트(상태별 배지) · 선행: T2.3
- [x] T2.5 [레인 C · W1] 가이드 엔진 코어: 템플릿 로더(내장), 마커 렌더(`<!-- vanilla:begin/end -->` 안만 쓰기, 밖 보존), 순수 함수 `renderGuide`, 해시 헤더 — 대상: `src/lib/guides/*` · 완료 판정: 마커 보존·결정성·스냅샷 테스트 · 선행: T1.5 · (D-023, D-028)
- [x] T2.6 [레인 C · W2] 임시 내장 템플릿 3종 골격(`resources/guides/<type>/<id>@1/`: `template.json`·최소 `schema`·`rules.md`·`prompts/`) — 대상: `resources/guides/**` · 완료 판정: 템플릿 로드·검증 테스트(내용은 V3에서 채움) · 선행: T2.5
- [x] T2.7 [레인 C · W2] 신 `AGENTS.md` 렌더러(Spec §7 구조: 식별 헤더 `workspaceId`+`sceneId`, 산출물 계약, 디자인 규칙, 되쓰기 화이트리스트, 타입별 규칙, 레퍼런스 절차, 검수, 범위 제한) + 신 `CLAUDE.md` — 대상: `src/lib/guides/agentsMd.ts` · 완료 판정: 스냅샷 테스트, 식별 헤더·화이트리스트 포함 검증 · 선행: T2.6, T2.1 · (D-029)
- [x] T2.8 [레인 C · W2] `GUIDE.md` 렌더러(필드별 섹션, 읽기 전용 헤더, `scene.json` 해시) + 해시 불일치 시 "수동 편집 감지" 경고 — 대상: `src/lib/guides/guideMd.ts` · 완료 판정: 스냅샷·해시 테스트 · 선행: T2.6
- [x] T2.9 [레인 C · W3] 프롬프트 렌더·클립보드 조립(`[workspace/scene]` 헤더 + 한 줄 지시 + 사용자 프롬프트 + 되쓰기 필드 요약, `generate`·`revise`) — 대상: `src/lib/guides/prompts.ts`, `src/lib/agents/assemble.ts` · 완료 판정: 헤더·언어 지시 포함 스냅샷 · 선행: T2.7, T2.8 · (D-022, F-AGT 개정)
- [x] T2.10 [레인 B · W2] 파일 감시 → 신 상태 갱신(`draft`·`prompt-ready`·`generated`·`needs-revision`), `scene.json` 검증 실패 배지, 신 폴더 밖 쓰기 감지 경고 — 대상: `src-tauri/src/watch.rs`, `src/lib/scene/status.ts` · 완료 판정: 파일 변경 모의 → 배지 갱신 테스트 · 선행: T2.2, T2.1 · (R-10) — 신 폴더 밖 쓰기 경고는 `outsideWrites` 헬퍼까지(활성 신 개념이 생기는 V4 터미널 실행에서 UI 연결)
- [x] T2.11 [레인 A · W3] Scene 인스펙터 틀(우측 패널, 섹션 탭, 개요 폼: 이름·타입 읽기·brief·언어, 저장 → `scene.json` 정규화 쓰기 → 가이드 파일 재렌더) — 대상: `src/components/inspector/*` · 완료 판정: 노드 선택 → 편집 → 파일 3종 갱신 · 선행: T2.4, T2.7, T2.8 · (F-SCN-02)
- [x] T2.12 [레인 A · W3] 워크스페이스 설정 화면(캔버스 프리셋·사용자 지정, 기본 에이전트, `templatesDir`) — 대상: `src/pages/Settings/*` · 완료 판정: 변경이 `workspace.json`/설정 DB에 반영, 신 가이드 재렌더 트리거 · 선행: T1.12, T2.5 · (D-030, D-031)
- [x] T2.13 [단독 · 마무리] V2 마무리: 데모, `wiki/sources/milestone-v2.md`, 설계서 §3·§8 갱신 · 선행: T2.1~T2.12

## V3 가이드·인스펙터 (branch: `feat/v2-guides`)

- [x] T3.1 [레인 A · W1] 용어집 스키마·로더(`glossary/<type>.json`: `category·id·label{ko,en}·definition·implementationHint·tags`)와 모션 용어집(원문 §10 + 구현 힌트 + 전환 목록) — 대상: `src/lib/guides/glossary.ts`, `resources/glossary/motion.json` · 완료 판정: 스키마 테스트, ID 중복·누락 검사 · 선행: T2.5 · (D-028)
- [x] T3.2 [레인 A · W1] 용어 콤보박스(검색·다중·자유 입력·툴팁 정의, ID 저장) — 대상: `src/components/guides/TermCombobox.tsx` · 완료 판정: 컴포넌트 테스트(선택·자유 입력·키보드) · 선행: T3.1
- [x] T3.3 [레인 B · W1] 템플릿 포맷 스키마(`template.json`·`schema.json`·`extends` 병합: 필드 추가·숨김·기본값만) + 위반 거부 — 대상: `src/lib/guides/templateSchema.ts`, `merge.ts` · 완료 판정: 허용/거부 케이스 테스트 · 선행: T2.5 · (D-031)
- [x] T3.4 [레인 A · W2] motion 신 스키마 완성(`creativeMode`·`structure`·`adStructure`·`brandVoice`·`visualStyle`·`motionVocabulary`·`beats`·`copy`·`identity`·`endCard`·`audio`·`constraints`) + 폼 정의 — 대상: `resources/guides/motion/commercial-v1@1/schema.json`, `src/lib/scene/schema.ts` · 완료 판정: 원문 29개 섹션 매핑 표(Spec §6.2) 전 항목에 필드 존재 · 선행: T3.3, T3.1
- [x] T3.5 [레인 E(콘텐츠) · W1] motion `commercial-v1` 규칙 본문 개편(`rules.md`: 원문 가이드 → 코드 구현용, 6~7천자 제한 삭제, 구현 힌트 포함)·`checklist.md`·`prompts/{generate,analyze-reference,revise}.md`(영문) — 대상: `resources/guides/motion/commercial-v1@1/*`, 원문 `Docs/Commercial-Motion-Graphic-Prompt-Guide.txt` · 완료 판정: 매핑 표 전 섹션 반영 확인, 샘플 신(강동 숲)에 적용해 에이전트가 따를 수 있음(수동) · 선행: T2.6 · (D-028, R-4)
- [x] T3.6 [레인 A · W3] motion 인스펙터 섹션(개요·구조·카피 원문 목록·스타일·모션 어휘 드롭다운·정체성·엔드카드·오디오(기록)·제약, **beats 편집기**: 시작/끝 시간·역할·카피·모션·카메라·전환, 시간 합 검증 표시) — 대상: `src/components/inspector/motion/*` · 완료 판정: 샘플 `scene.json` 전 필드 편집·저장·재렌더 · 선행: T3.4, T3.2, T2.11
- [x] T3.7 [레인 E · W1] static `web-page-v1` 가이드 작성(레이아웃·타이포·반응형·접근성·카피·인터랙션·steps 규칙)·용어집 — 대상: `resources/guides/static/web-page-v1@1/*`, `resources/glossary/static.json` · 완료 판정: 규칙·체크리스트·프롬프트 3종 완비, 용어집 스키마 통과 · 선행: T2.6, T3.1 · (D-028, D-032)
- [x] T3.8 [레인 A · W3] static 스키마(`mode: scroll|steps`, `steps[]`) + 인스펙터(mode 전환, 섹션/step 편집기, advance 입력 선택) — 대상: `resources/guides/static/*/schema.json`, `src/components/inspector/static/*` · 완료 판정: mode별 UI 전환 테스트, step `advance` 검증 · 선행: T3.7, T3.2, T2.11 · (D-032)
- [x] T3.9 [레인 E · W2] 3d `three-scene-v1` 가이드 작성(씬 구성·재질·조명·카메라 경로·후처리·성능 예산·결정성)·용어집·스키마 — 대상: `resources/guides/3d/three-scene-v1@1/*`, `resources/glossary/3d.json` · 완료 판정: 완비 + 스키마 테스트 · 선행: T2.6, T3.1 · (D-028, D-024)
- [x] T3.10 [레인 A · W3] 3d 인스펙터 섹션(씬·재질·조명·카메라·성능 예산) — 대상: `src/components/inspector/threed/*` · 완료 판정: 샘플 편집·저장 · 선행: T3.9, T3.2, T2.11
- [x] T3.11 [레인 D · W3] DESIGN 인스펙터 섹션·워크스페이스 DESIGN 편집(팔레트 라이브러리 선택, 분위기(mood) 키워드, 토큰 편집, 대비 경고, 신 오버라이드 `extends` 토글) — 대상: `src/components/inspector/DesignSection.tsx`, `src/lib/design/*` · 완료 판정: 팔레트 적용 시 `colors`만 교체·본문 바이트 보존 테스트(v1 S7 이관 확인) · 선행: T2.11 · (D-015·D-016)
- [x] T3.12 [레인 B · W3] 사용자 정의 템플릿: 복제·편집·`extends` 저장 UI, 우선순위 해석(워크스페이스 > `templatesDir` > 내장), 검증 실패 시 사용 거부 — 대상: `src/lib/guides/resolve.ts`, `src/components/guides/TemplateEditor.tsx` · 완료 판정: 복제 → 필드 추가 → 신에 적용 → 렌더 반영 E2E · 선행: T3.3, T3.6 · (D-031)
- [x] T3.13 [레인 A · W4] 사용자 프롬프트 편집(CodeMirror)·프롬프트 미리보기(클립보드 내용)·가이드 재렌더 트리거 — 대상: `src/components/inspector/PromptSection.tsx` · 완료 판정: 편집 → `prompts/user-prompt.md` 저장·미리보기 갱신 · 선행: T2.9, T2.11
- [x] T3.14 [레인 B · W4] 템플릿 갤러리·v1 `resources/templates/*` 제거, 팔레트 라이브러리는 유지 연결 — 대상: `src/components/templates/*`, `resources/templates/*` · 완료 판정: 참조 0건, lint·typecheck·test 통과 · 선행: T3.11
- [x] T3.15 [단독 · 마무리] V3 마무리: 데모 ①~④, `milestone-v3.md`, Playbook 프롬프트 갱신 · 선행: T3.1~T3.14

## V4 터미널 실행·재생 (branch: `feat/v2-run`)

- [x] T4.1 [레인 A · W1] 에이전트 레지스트리 축소(`id·label·argv·instructionFile·detect·pasteMode`)·기본값 5종·DB `agents` 편집, 설정 UI(편집 시 확인 다이얼로그) — 대상: `src/lib/agents/registry.ts`, `src/pages/Settings/*` · 완료 판정: 스키마 테스트, argv 외 필드 주입 거부 · 선행: V2 · (D-012, D-022)
- [x] T4.2 [레인 B · W1] Rust `run_agent`(PTY, cwd=신 폴더 canonicalize 검사, 레지스트리 키로만 argv, 신뢰 확인 필수, 세션 메타 DB) — 대상: `src-tauri/src/commands/pty_commands.rs` · 완료 판정: `cargo test`(스코프 밖 cwd 거부, 임의 argv 거부, 미신뢰 폴더 거부) · 선행: T4.1 · (AGENTS.md §7)
- [x] T4.3 [레인 A · W2] 터미널 도크(신별 탭, 세션 재연결, 종료 확인, 에이전트 미설치 안내) — 대상: `src/components/terminal/*` · 완료 판정: 노드의 [에이전트 실행] → 도크 탭 열림 · 선행: T4.2, T2.4 · (F-AGT-04)
- [x] T4.4 [레인 A · W2] 클립보드 복사+토스트, auto-paste 옵션(bracketed paste, 에이전트 준비 감지 실패 시 안내) — 대상: `src/lib/agents/clipboard.ts` · 완료 판정: 복사 내용 = 프롬프트 미리보기와 동일(테스트) · 선행: T4.3, T2.9 · (R-3)
- [x] T4.5 [레인 C · W2] 완료 판정·검증·되쓰기 관리: `scene.json` zod 재검증, 엔트리 존재 확인, 화이트리스트 밖 변경 경고, `.vanilla/history/` 스냅샷, diff 뷰·승인·되돌림 — 대상: `src/lib/scene/writeback.ts`, `src/components/scene/DiffDialog.tsx` · 완료 판정: 목 에이전트가 허용/비허용 필드 수정 → 경고·되돌림 테스트 · 선행: T2.10, T4.3 · (R-2)
- [x] T4.6 [레인 D(runtime) · W1] 런타임 Bridge v2(`v: 2`: `step`·`done`·`choice`·`next`·`prev`·`ready` payload, zod)·워크스페이스 설치 경로·`canvas` 주입(해상도·fps)·static `steps` 입력 처리 — 대상: `packages/runtime/src/bridge.ts` · 완료 판정: 메시지 단위 테스트, v 불일치 무시 · 선행: V2 · (D-032, D-030, R-8)
- [x] T4.7 [레인 B · W2] 프리뷰 서버(`vite-runner.mjs` 워크스페이스 루트, 신별 엔트리 멀티 서빙, 포트 보고) + 단일 신 미리보기 패널(iframe, Bridge 호스트: play·pause·seek·reload) — 대상: `resources/workers/vite-runner.mjs`, `src/components/scene/Preview.tsx`, `src/lib/playground/bridgeHost.ts` · 완료 판정: CDP E2E로 `ready` 수신, 신 HMR 반영 · 선행: T4.6, T1.9 · (F-REV 개정)
- [x] T4.8 [레인 B · W3] 썸네일 캡처(헤드리스 `capture`, `.vanilla/thumb.png`, 노드 표시) — 대상: `src/lib/scene/thumbnail.ts` · 완료 판정: 신 생성 후 노드에 썸네일 · 선행: T4.7 — 구현: 미리보기 Bridge `capture`(앱 내 캡처)로 `.vanilla/thumb.png` 저장(헤드리스 불필요), 미리보기 탭이 열려 `ready`가 될 때 갱신
- [x] T4.9 [레인 D · W3] 신 폴더용 `pnpm check:scene`(금지 시간 API·하드코딩 색·`defineScene`·Text Fidelity·beats/endCard 검증) + 앱 [검사] 버튼·`.vanilla/self-check.md` 표시 — 대상: `packages/runtime/eslint-plugin/*`, `resources/workspace-template/package.json`, UI · 완료 판정: 규칙별 테스트, 샘플 신 통과 · 선행: T4.6 · (F-DSN-05, D-011) — 구현: `resources/workspace-template/scripts/check-scene{,-core}.mjs`(앱과 CLI가 같은 코어 공유, eslint 플러그인 의존 없음), 인스펙터 미리보기 탭의 [검사]. 정적 검사만(동적 픽셀 비교·DOM Text Fidelity는 후속)
- [x] T4.10 [레인 A · W4] 신 상태 머신(`draft→prompt-ready→(실행)→generated/needs-revision`) UI 연동·재생성(revise) 흐름 — 대상: `src/lib/scene/status.ts`, 노드/인스펙터 · 완료 판정: 단위·컴포넌트 테스트 · 선행: T4.5, T4.8 — 구현: revise 프롬프트에 마지막 확정본 대비 바뀐 필드 포함(`scene/revision.ts`), 노드 버튼 [재생성], 신 폴더 밖 쓰기 경고 UI 연결
- [x] T4.11 [단독 · W5] 통합·E2E: 목 에이전트(스크립트) 통합 테스트 + 실제 Claude Code·Codex로 motion 신 생성·재생 데모, 지원 매트릭스 기록 — 대상: `tests/e2e/*`, `wiki/sources/poc-agent-terminal.md` · 완료 판정: 데모 ①~③ · 선행: T4.1~T4.10 — 자동화 완료(목 에이전트 통합 `mockAgentRun.test.ts`·`pnpm test:e2e:agent`), 실제 Claude Code·Codex 데모는 사람 확인 대기(`wiki/sources/poc-agent-terminal.md`)
- [x] T4.12 [단독 · 마무리] V4 마무리: `milestone-v4.md` · 선행: T4.11

## V5 레퍼런스 분석 (branch: `feat/v2-reference`)

- [x] T5.1 [레인 A · W1] `references.json` zod·추가 UI(파일 복사/링크, 이미지, URL, 메모)·인스펙터 레퍼런스 섹션 — 대상: `src/lib/scene/references.ts`, `src/components/inspector/References.tsx` · 완료 판정: 추가·삭제·재열기 · 선행: V2 · (F-REF-01) — 구현: scene.json.references가 진실 공급원, `references/references.json`은 에이전트용 거울(writeScene이 함께 씀). 파일은 복사만(링크 없음, D-029), 삭제는 목록에서만(파일 유지)
- [x] T5.2 [레인 B · W1] FFmpeg 키프레임·메타 추출(고정 argv, 프레임 수·간격 설정, 진행 표시, 미설치 시 Doctor 안내) — 대상: `src-tauri/src/commands/reference_commands.rs` · 완료 판정: 샘플 mp4 → `references/analysis/<id>/frames/*.jpg`·`meta.json`, argv 고정 테스트 · 선행: T5.1, V1(Doctor) · (D-026) — 구현: 키프레임 균등 추출(기본 8장, 최대 24, 폭 1280 JPEG)·ffprobe 메타. 인스펙터 레퍼런스 탭의 [키프레임 추출]. PATH의 구형 ffmpeg는 거부될 수 있어 앱 관리형 우선(테스트는 `VANILLA_TEST_FFMPEG_DIR`로 현대 빌드 지정)
- [x] T5.3 [레인 C · W2] 타입별 `analyze-reference.md` 렌더(관점: 구도·팔레트·모션·타이밍·전환·타이포·분위기 / 정적: 레이아웃·타이포·그리드 / 3d: 재질·조명·카메라) + 분석 태스크 실행 버튼 — 대상: `resources/guides/*/prompts/analyze-reference.md`, `src/lib/guides/prompts.ts` · 완료 판정: URL·키프레임 경로·인젝션 방어 문구 포함 스냅샷 · 선행: T5.1, T2.9, T4.4 — 구현: 레퍼런스별 줄(경로·키프레임 규약 위치·URL 열람 전용·사용자 메모는 인용 데이터)·인젝션 방어 문구·분석 마커 구간 안내, 인스펙터 [분석 실행]. 기존 "URL 금지" 문구는 D-026/R-7에 맞게 "내려받기·저장 금지, 열람만"으로 정정
- [x] T5.4 [레인 D · W2] DESIGN.md 분석 마커 구간 읽기/쓰기·`extends` 상속 해석·`mood` 필드(바이트 보존) — 대상: `src/lib/design/*` · 완료 판정: 왕복 테스트(마커 밖 바이트 동일), 상속 우선순위 테스트 · 선행: V3 T3.11 · (D-016, D-026) — 구현: `design/analysis.ts`(마커는 저장소 공통 `vanilla:begin:analysis` 형식으로 문서 정정, CRLF 보존 `applyMarkersKeepEol`), `design/extends.ts`(워크스페이스 DESIGN.md만 상속 허용·참조 해석 전 병합·mood 필드). 런타임 Vite 플러그인의 신 단위 DESIGN 소비는 미연결
- [x] T5.5 [레인 A · W3] 분석 반영 diff UI(`analysis/*.md`·DESIGN.md 마커 구간·`scene.json` 되쓰기 필드) + 승인/되돌림 — 대상: `src/components/scene/AnalysisDiff.tsx` · 완료 판정: 목 에이전트 반영 → diff → 승인/되돌림 테스트 · 선행: T5.3, T5.4, T4.5 — 구현: `scene/analysisReview.ts`(분석 전후 스냅샷·diff·되돌림), 기존 실행 검토에 통합(`useRunReview`의 `analysis` 옵션, DiffDialog 안의 `AnalysisDiff`). 분석 실행은 완료 상태를 바꾸지 않고, 분석 전 신 DESIGN.md 오버라이드를 준비한다
- [x] T5.6 [레인 C · W3] URL 레퍼런스 정책 구현(앱 미다운로드·URL 기록만·저작권 안내) + AGENTS.md "스타일 분석용, 복제·삽입 금지" 규칙 렌더 — 대상: `src/lib/guides/agentsMd.ts` · 완료 판정: 렌더 스냅샷 포함 확인 · 선행: T5.3 · (R-7) — 구현: AGENTS.md 레퍼런스 구간(스타일 전용·복제/추적/삽입 금지·저작권·URL 기록 전용)과 인스펙터 안내 문구, 3타입 렌더 테스트
- [x] T5.7 [단독 · W4] E2E 데모(영상 레퍼런스 → 분석 → DESIGN·가이드 반영 → 재생성) + `milestone-v5.md` · 선행: T5.1~T5.6 — 구현: 목 에이전트 analyze 모드 + `referenceFlow.test.ts`. 실제 에이전트 데모는 사람 확인 대기

## V6 시퀀스·플레이그라운드 (branch: `feat/v2-sequence`)

- [x] T6.0 [단독 · W0] **PoC R-1**: 신 간 전환 합성(두 iframe 오버레이 vs 프레임 캡처 오버레이, crossfade·mask-wipe·slide) — 대상: `spikes/r1-transition/`, `wiki/sources/poc-r1.md` · 완료 판정: 방식 채택·지원 전환 범위 결정, 성능 수치 · 선행: V4 · (R-1) — 결과: 두 iframe 오버레이 채택(5종 전환 60fps), `match-cut` v2.0 제외, `custom`은 선언형 JSON(`wiki/sources/poc-r1.md`)
- [x] T6.1 [레인 A · W1] `sequence.json` zod + 검증(static 발신 엣지 trigger 제한, `workspaceId` 일치, 노드 존재, start 도달성, 순환 허용 규칙) + canonical — 대상: `src/lib/sequence/schema.ts`, `validate.ts` · 완료 판정: 케이스별 단위 테스트 · 선행: V2 · (D-025, D-032) — 구현: `sequence/validate.ts`(workspace 불일치·없는 신·static 자동 trigger·모호한 분기·입력 없는 순환·linear 규칙·시작 도달성). 입력이 필요 없는 순환만 오류, 입력 엣지가 낀 순환은 허용
- [x] T6.2 [레인 B · W2] 캔버스 엣지 편집(연결·삭제·재연결, 분기 다중 출력 핸들, 시작 신 지정)·엣지 인스펙터(`trigger`·`transition` 폼) — 대상: `src/components/canvas/*`, `src/components/inspector/EdgeSection.tsx` · 완료 판정: 연결 → `sequence.json` 반영, 검증 오류 표시 · 선행: T6.1 — 구현: `sequence/edit.ts`(연결·삭제·재연결·기본 trigger·시작 신·모드), `useSequenceEdges`(xyflow 엣지 ↔ 시퀀스), `EdgeSection`(trigger·전환 폼), 검증 패널·시작 배지·모드 선택. 저장할 수 없는 값은 파일에 쓰지 않고 이유 표시
- [x] T6.3 [레인 C · W2] 전환 라이브러리(T6.0 결과 범위: `cut`·`crossfade`·`slide-*`·`mask-wipe`·`circular-reveal`·`zoom-through`) + 용어집(`transition`) 연결 — 대상: `src/lib/playground/transitions/*`, `resources/glossary/motion.json` · 완료 판정: 전환별 단위·시각 테스트 · 선행: T6.0, T3.1 — 구현: `playground/transitions/{index,run}.ts`(순수 계획 + WAAPI 재생), 9종(`cut`·`crossfade`·`slide-left/right/up/down`·`mask-wipe`·`circular-reveal`·`zoom-through`), 3개 용어집에 slide-right/up/down 추가, 검증에 `unknown-transition` 규칙
- [x] T6.4 [레인 C · W3] `match-cut`(요소 ID 지정)·`custom` 전환(`transitions/<name>.ts` 계약, 에이전트 구현용 규칙을 AGENTS.md·가이드에 추가) — 대상: `src/lib/playground/transitions/custom.ts`, 가이드 렌더 · 완료 판정: 샘플 custom 전환 로드 테스트 · 선행: T6.3 · (선택: R-1 결과 따라 축소 가능) — 결과: `match-cut` v2.0 제외(PoC R-1), `custom`은 선언형 `transitions/<name>.json`(속성·값 화이트리스트, 코드 실행 없음) — `transitions/custom.ts`, 워크스페이스 AGENTS.md에 작성 규칙
- [x] T6.5 [레인 A · W2] 시퀀스 매니저 상태 머신(linear·`end`·`click`·`key`·`timeout`·`choice`, static step 위임, 신 로딩·프리로드, 오류 처리) — 대상: `src/lib/sequence/manager.ts` · 완료 판정: trigger 종류별 시나리오 테스트(가짜 Bridge) · 선행: T6.1, T4.6 · (D-032) — 구현: `sequence/manager.ts`(신은 `SceneHandle`, 전환은 `TransitionRunner`로 주입 → 가짜 Bridge 시나리오 테스트 20개). 일시정지 시 timeout 타이머 정지·재개, 이웃 신 프리로드, 로드 실패는 현재 신 유지+오류, retry/jump/choose/back
- [x] T6.6 [레인 B · W3] Playground UI(재생/일시정지/시크·신 점프·진행률, 입력 힌트(클릭/방향키), `choice` 오버레이, 오류 배너) — 대상: `src/components/playground/*` · 완료 판정: 샘플 시퀀스 재생 CDP E2E · 선행: T6.5, T6.3 — 구현: `Playground` 페이지·`SequencePlayer`(재생·일시정지·시크·신 점프·입력 힌트·choice 오버레이·오류 배너), `IframeScene`/`IframeSceneHost`(Bridge v2), 브라우저 전환 러너. CDP E2E `pnpm test:e2e:sequence`. 프리로드 신은 `visibility:hidden`이면 Chrome이 렌더를 멈춰 `ready`가 오지 않으므로 맨 아래 투명 층으로 둔다
- [x] T6.7 [레인 C · W3] 로컬 서빙 방식 확정·프리로드 최적화(신 전환 지연 측정) — 대상: `src-tauri/src/*`, `workers/` · 완료 판정: 전환 지연 수치 기록 · 선행: T6.5 — 결정: 별도 정적 서버 없이 워크스페이스 프리뷰 서버(vite-runner)를 그대로 쓴다(v2.0). 수치(헤드리스 Chrome, 샘플 시퀀스): 시작 신 콜드 로드 1.23s, 비이웃 신 점프 0.13s, 프리로드 이웃 전환은 설정값+10~120ms(crossfade 600→612ms, slide-left 500→550, circular-reveal 700→708, zoom-through 600→718)
- [x] T6.8 [단독 · W4] 샘플 시퀀스 제작·검증(motion→static(steps)→3d + choice 분기 1개) — 대상: `resources/samples/sequence-demo/` · 완료 판정: 데모 ①~③ · 선행: T6.2~T6.7 — 구현: `resources/samples/sequence-demo/`(intro motion → page static steps → globe 3d, choice Finish/Again 분기). JSON은 `sampleSequence.test.ts`가 생성·드리프트 검사, 재생은 E2E로 확인
- [x] T6.9 [단독 · 마무리] V6 마무리: `milestone-v6.md`, 설계서 §4.2·§5 갱신 · 선행: T6.8 — `wiki/sources/milestone-v6.md`, 설계서 §4.2.1·기획서 §5.2 갱신

## V7 패키지·마이그레이션·릴리스 (branch: `feat/v2-release`)

- [x] T7.1 [레인 A · W1] `manifest.json` zod(파일별 SHA-256·앱/스키마 버전·사용 템플릿)·`.vsx` 만들기(포함/제외 규칙·레퍼런스 원본 영상 옵션·템플릿 동봉) — 대상: `src/lib/package/*`, `src-tauri/src/commands/package_commands.rs` · 완료 판정: 패키지 생성·해시 테스트 · 선행: V6 · (D-027, D-031) — 구현: Rust `package_commands.rs`(허용 목록 포함 규칙·결정적 zip(정렬·고정 시각·권한)·manifest·해시), TS `lib/package/{manifest,api}.ts`. Rust/TS 계약은 골든 파일 `tests/fixtures/manifest.sample.json`로 대조. 신 패키지·시퀀스 패키지·레퍼런스 원본 옵션·사용자 템플릿 동봉
- [x] T7.2 [레인 A · W2] `.vsx` 열기·가져오기(zip-slip·절대경로·심링크 거부, 해시 검증, 버전 확인·마이그레이션 제안, `rules.md`·`AGENTS.md`·템플릿 출처 확인 다이얼로그, `workspaceId` 재작성) + 신 가져오기 — 대상: `package_commands.rs`, `src/components/package/*` · 완료 판정: 악성 zip 케이스 거부 테스트, 왕복 후 재생 · 선행: T7.1 · (R-9, D-029) — 구현: Rust `inspect_vsx`(zip-slip·절대·역슬래시·드라이브·심링크·암호화·중복·크기·해시·manifest 대조 거부)·`extract_vsx_scene/workspace/templates`(덮어쓰기 없음), TS `package/import.ts`(새 신 폴더·새 sceneId·workspaceId 재작성·가이드 재렌더·엣지 이관), 열기 전 확인 다이얼로그(에이전트 지시 파일 목록 + 신뢰 체크 필수)·내보내기 다이얼로그. 악성 zip 거부는 `cargo test`, 실제 샘플 왕복·pack→extract→pack 바이트 동일 확인
- [x] T7.3 [레인 B · W2] 신 템플릿으로 저장(내용 초기화·구조·가이드 유지)·새 신 생성 시 선택 — 대상: `src/lib/scene/saveAsTemplate.ts` · 완료 판정: 저장 → 신 생성 → 구조 일치 · 선행: T7.1 — 구현: `scene/saveAsTemplate.ts`(구조 필드만 템플릿 기본값으로, beats/steps는 뼈대만·문구 비움, 내용 필드 제외, 부모 `extends`로 가이드 유지), 인스펙터 개요 탭 [신 템플릿으로 저장]. 새 신 생성 다이얼로그는 기존 템플릿 선택 그대로 사용. 왕복 테스트: 저장 → 카탈로그 병합 → 새 신 구조 일치·내용 빈 상태
- [x] T7.4 [레인 C · W2] 재현성 테스트: 같은 `scene.json` → 같은 가이드 바이트, 패키지 왕복 바이트 동일, 다른 폴더·PC 재현 절차 문서 — 대상: `tests/repro/*`, `Docs/Verification/Reproducibility.md` · 완료 판정: 테스트 통과, 절차 문서 · 선행: T7.1 — 구현: `tests/repro/reproducibility.test.ts`(9개), 절차 문서 `Docs/Verification/Reproducibility.md`. 패키지 왕복은 Rust 테스트가 보장
- [x] T7.5 [레인 D · W3] v1 프로젝트 마이그레이션(Spec §11.1: 비파괴 복사·best-effort 변환·미변환 필드 표시) + 샘플 3종 시험 → **출하 게이트 판정**(미달 시 UI 숨김·"v1 앱으로 열기" 안내) — 대상: `src/lib/migrate/v1.ts`, `wiki/sources/issue-v1-migration.md` · 완료 판정: 판정 결과 기록 · 선행: T1.4, T7.2 · (D-033) — 구현: Rust `read_v1_project`(읽기 전용), `migrate/v1.ts`(순수 변환 계획)·`applyV1.ts`·온보딩 다이얼로그. **출하 판정: 샘플 3종 재생 통과 → 출하**(`wiki/sources/issue-v1-migration.md`, `pnpm test:e2e:v1`). 변환 중 발견한 신별 params 미적용 런타임 결함 수정
- [x] T7.6 [레인 E · W3] 샘플 정리: 강동 숲 도서관 샘플을 v2 워크스페이스로 변환, 3타입 샘플 각 1개·시퀀스 샘플 — 대상: `resources/samples/*`, `Docs/Verification/Golden-Samples.md` 갱신 · 완료 판정: 가이드 렌더·재생 회귀 테스트 · 선행: V6 — 구현: 샘플 4종(motion 강동 숲속 도서관 변환·static 랜딩·3d 토러스·시퀀스 데모), JSON 드리프트·가이드 렌더·계약 검사 테스트(`sampleCatalog.test.ts`), 재생 회귀 E2E `pnpm test:e2e:samples`(결정성 포함), `Golden-Samples.md` 갱신
- [x] T7.7 [레인 B · W4] 사용자 문서 개정(시작하기·신 가이드·시퀀스·공유·레퍼런스·문제 해결) + NOTICE 갱신(제거·추가 의존성) — 대상: `Docs/User-Guide/*`, `NOTICE.md` · 완료 판정: 앱 내 링크 표시, 의존성 표 일치 · 선행: T7.2 — 구현: 사용자 문서 v2 7종(`Docs/User-Guide/01~07`, v1 문서는 `legacy/`로 보관), 설정의 문서 링크 목록(데이터 기반 + 파일·사전·상호 링크 일치 테스트), `NOTICE.md` v2 의존성 표 + 직접 의존성(npm·Cargo) 전수 일치 테스트(react-dom·proxy-agent 누락 발견·보강). 신 노드 키보드 삭제 방지
- [ ] T7.8 [단독 · W5] 인스톨러 빌드·클린 VM 체크리스트 재실행(v1 T7.2 이월)·코드 서명(v1 T7.5 이월, 사용자 인증서 준비 후) — 대상: `Docs/Verification/Clean-Install-Checklist.md`, `tauri.conf.json` · 완료 판정: 체크리스트 전 항목 통과, 서명 인스톨러 · 선행: T7.1~T7.7 — **자동 확인분 완료**: `pnpm tauri build` 성공(MSI 21.3MB·NSIS 18.4MB, 번들에 workspace-template·runtime 포함), 릴리스 `app.exe` 실행 10초 생존 확인. **남음(사람)**: 클린 VM 설치·GUI 확인·실제 에이전트 데모·코드 서명 — `Docs/Verification/Clean-Install-Checklist-v2.md` §3·§4
- [x] T7.9 [단독 · 마무리] V7 마무리 + **Phase 로그**: `milestone-v7.md`, `wiki/sources/phase-p4-v2.md`, Playbook 프롬프트·User-Checklist·`overview.md` 갱신 · 선행: T7.1~T7.8 — `wiki/sources/milestone-v7.md`·`phase-p4-v2.md`, Playbook 프롬프트(§1.2·§2.0)·User-Checklist·`overview.md` 갱신
