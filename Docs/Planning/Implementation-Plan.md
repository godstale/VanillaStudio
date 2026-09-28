# Vanilla Studio 구현 계획서 (Implementation Plan)

- 문서 버전: v1.0 (2026-09-29)
- 선행 문서: `Product-Spec.md` v0.3, `Technical-Design.md` v0.3, `Feasibility-Risks.md` v0.2, `Decisions.md`(D-001~D-018 모두 Accepted), PoC 결과(`wiki/sources/poc-s1`~`poc-s7`)
- 골든 샘플(초안): `Docs/Verification/Golden-Samples.md`
- 작업 목록: `Docs/Planning/TODO.md` (1~2시간 단위, 항목마다 대상 파일·완료 판정·선행 항목)
- 양식: `Docs/Playbook/templates/Implementation-Plan-Template.md`

---

## 1. PoC 결론 요약

| ID | 결론 | 설계 반영(핵심) | 기록 |
| --- | --- | --- | --- |
| S1 | ✅ HyperFrames로 React+R3F MP4 렌더, 두 번 렌더한 결과가 바이트 동일(15초 1080p 약 18초) | `hf-seek` + `waitUntil(sceneReady)`, `data-no-timeline`, FFmpeg는 **GPL 빌드**를 환경 변수로 전달 | `poc-s1` |
| S3 | ◐ Claude Code 통과, Codex 미검증 | 세션 격리 옵션(D-018 제안), `locations` 기반 권한 판정, MCP stdio·HTTP+토큰 모두 가능 | `poc-s3` |
| S4 | ✅ WebView2 iframe + Bridge 반영 p95 34ms, HMR 27ms | iframe에도 IPC 스크립트가 주입되지만 ACL이 차단(`remote.urls` 금지). HMR 누락 감지 → reload | `poc-s4` |
| S7 | ✅ DESIGN.md 토큰 파이프라인, 팔레트 교체 p95 34ms, 바이트 보존 재작성 | 역할 **핵심 4 + 파생 5**, CSS 변수 `--color-*`, 본문 hex 동시 갱신 | `poc-s7` |
| S2 | ✅ @2x 스틸 캡처 0.3~0.5초/장, 이미지 PPTX·PDF가 PowerPoint에서 정상 | 런타임 준비 신호(`registerAsset`, `fonts.load`) 없으면 WebGL 누락·대체 폰트 | `poc-s2` |
| S6 | ✅ Doctor 13개 항목 5초, FFmpeg 190MB 다운로드·SHA-256 23초 | 레지스트리에서 PATH 재조회, PATHEXT 해석, FFmpeg 메이저 버전 고정 | `poc-s6` |
| S5 | ◐ 편집 PPTX: 텍스트·위치 정확, 효과는 근사치 | 설치 폰트가 조건, `wrap="none"` 후처리, 브라우저 번들만 벤더링 → **Beta 유지** | `poc-s5` |

PoC 코드는 `spikes/<id>-<topic>/`에 참고용으로 남긴다. 앱 코드로 옮길 때 그대로 복사하지 않고 테스트와 함께 다시 작성하되, 다음 파일은 초안으로 활용한다.

| PoC 파일 | 옮겨 갈 곳 |
| --- | --- |
| S3 `main.rs` | `agent_host` |
| S6 `main.rs` | `doctor_commands.rs` |
| S7 `src/design/*` | `src/lib/design`, `packages/runtime` |
| S4 `cdp-probe.mjs` | E2E 도구 |
| S2 `verify-pptx.ps1` | PPTX 검증 스크립트 |

## 2. 마일스톤

| ID | 목표 | 완료 기준(데모) | 브랜치 | 관련 기능 ID |
| --- | --- | --- | --- | --- |
| M1 기반 | 템플릿을 Vanilla Studio 앱 골격으로 바꾸고, 프로젝트를 만들고 열 수 있게 한다 | ① `pnpm tauri dev` 실행 ② Doctor 화면에서 의존성 상태 확인·FFmpeg 다운로드 ③ 새 프로젝트 마법사로 폴더 스캐폴딩(`vanilla.json`·`AGENTS.md`·`DESIGN.md`·런타임 자리) ④ 최근 프로젝트로 다시 열기 | `feat/m1-foundation` | F-PRJ-01·02·03, F-ENV-01, F-DSN-01 |
| M2 에이전트 | ACP로 에이전트를 구동하고 권한 정책을 강제한다 | ① 프로젝트에서 Claude Code 세션 시작 → 스트리밍 ② 파일 쓰기 자동 허용, 셸 요청 다이얼로그 ③ 취소 ④ `vanilla-tools` MCP 호출(ping) ⑤ AGY는 내장 터미널로 실행 | `feat/m2-agents` | F-AGT-01~05, F-AGT-06(골격), F-AGT-07(S) |
| M3 파이프라인 | Brief → Plan → Prompts → Build를 앱에서 진행한다 | ① 브리프 입력 → 에이전트가 `DESIGN.md`·`plan.md`·`plan.json` 작성 → 검증·자동 재요청 ② 기획서 뷰어에서 승인 → 체크포인트 ③ 구현 계획서·`tasks.json` 생성·편집·승인 ④ 태스크 순차 실행으로 `src/` 생성 | `feat/m3-pipeline` | F-PIP-01~05, F-PRJ-04, F-DSN-02·04 |
| M4 검수·런타임 | Scene 런타임과 검수 스튜디오 | ① 에이전트가 만든 Scene을 iframe 미리보기 ② 스크러버(clock 유형) ③ 파라미터 조절·저장 ④ 팔레트 라이브러리에서 교체·적용·대비 경고 ⑤ 수정 요청 → 반영 → 전/후 비교 ⑥ `snapshot_scene`으로 에이전트 자기 검수 | `feat/m4-review` | F-REV-01~05, F-DSN-03·05, F-PAL-01~04, F-AGT-06 |
| M5 Export | 유형별 export와 작업 큐 | 샘플 프로젝트에서 다음을 각각 export하고 결과를 연다: web zip, 이미지 PNG @2x, 이미지 PPTX·PDF, 편집 PPTX(Beta), MP4 | `feat/m5-export` | F-EXP-01·03·04·05·06·08, F-EXP-02(S) |
| M6 템플릿·플레이그라운드 | 품질을 끌어올리는 템플릿과 결과 보관 | ① 내장 템플릿 3종(각 `DESIGN.md`·팔레트·예제)으로 새 프로젝트 ② 템플릿 갤러리 ③ 내장 팔레트 24종 ④ export 결과를 플레이그라운드에서 재생 | `feat/m6-templates` | F-TPL-01·02·(03), F-PLY-01·(02), F-PAL-05~08(S), F-DSN-06·07(S) |
| M7 릴리스 준비 | 배포 가능한 인스톨러 | ① `pnpm tauri build` 인스톨러 ② 깨끗한 Windows VM에서 설치 → Doctor 안내대로 준비 → 샘플 export ③ 사용자 문서 | `feat/m7-release` | 비기능 요구사항 전반 |

M1~M6이 MVP 기능이다. M7은 P6(릴리스)과 이어지는 엔지니어링 작업이다. P5(검증 루프)는 M6 이후 골든 샘플로 수행한다.

## 3. 작업 순서와 의존성

```
M1 기반 ──┬──▶ M2 에이전트 ──▶ M3 파이프라인 ──┐
          └──▶ M4a 런타임 패키지(packages/runtime) ─┴──▶ M4b 검수 스튜디오 ──▶ M5 Export ──▶ M6 템플릿 ──▶ M7
```

- **M4a 런타임 패키지**는 M1의 워크스페이스 결정 직후부터 M2·M3와 병렬로 진행할 수 있다(워크트리 사용, AGENTS.md §6). M3의 Build 단계가 스캐폴딩된 런타임을 전제로 하므로 M3 후반까지 최소 API(`defineScene`·`useTime`·`useParams`·`useDesign`)를 준비한다.
- **M5는 M4의 준비 신호와 render 모드**에 의존한다. S1·S2 결과를 그대로 쓰므로 위험은 낮다.
- **M6의 템플릿 작업**(DESIGN.md·팔레트·예제 코드)은 콘텐츠 작업이라 M4 이후 언제든 병렬로 할 수 있다.
- 마일스톤마다 `master`에서 브랜치를 만들고, 완료 기준을 충족하면 사용자 확인 후 병합한다. push는 매번 승인받는다.

## 4. 테스트 계획

| 마일스톤 | 자동 테스트 | 수동 확인(데모) |
| --- | --- | --- |
| 공통 | `pnpm lint`·`typecheck`·`test`, Rust는 `cargo test` | 마일스톤 데모 스크린샷 → `wiki/sources/milestone-mN.md` |
| M1 | `vanilla.json` zod, 스캐폴딩 결과 트리, 경로 스코프(Rust), Doctor 판정 로직(PATH 해석·버전 비교·FFmpeg 판정), DB 마이그레이션 | 깨끗한 PATH 모의로 Doctor 안내, FFmpeg 다운로드 |
| M2 | 권한 정책 분류표(Rust, S3 시나리오 기반), 목(mock) ACP 에이전트로 세션·취소·권한 흐름, MCP 토큰 검증 | 실제 Claude Code로 S3 시나리오 6종 재현 |
| M3 | `plan.json`·`tasks.json` 스키마, 위상 정렬, 재요청 루프(목 에이전트), git 체크포인트 | 샘플 브리프 1종으로 Build까지 |
| M4 | 런타임 시간 변환·clock/free 모드, Bridge 메시지, DESIGN.md 파서·재작성(S7 테스트 이관), `check_scene` 규칙, 파라미터 우선순위 | CDP E2E로 미리보기·교체 지연 측정(목표 < 100ms), HMR 누락 복구 |
| M5 | export 작업 프로토콜, 이미지 크기·PPTX 구조(JSZip), 편집 PPTX `wrap` 후처리 | PowerPoint COM으로 PPTX 확인(`verify-pptx.ps1`), MP4 두 번 렌더 동일성 |
| M6 | `template.json`·`palette.json` 스키마, 내장 팔레트 대비 전부 통과 | 템플릿 3종 × 팔레트 2종 결과 비교 |
| M7 | 인스톨러 빌드 CI(로컬) | 깨끗한 Windows VM 설치 체크리스트 |

**골든 샘플**: `Docs/Verification/Golden-Samples.md`에 초안 5종(G1 web, G2 interactive, G3 slides, G4 image, G5 video)과 자동 검사·루브릭을 정리했다. **사용자 확정 대기**다. M4부터 G5·G3로 회귀 테스트를 돌린다.

## 5. 위험과 완화 (구현 단계)

| 위험 | 출처 | 완화 |
| --- | --- | --- |
| 에이전트 기본 설정이 셸을 확인 없이 실행 | S3 | D-018 세션 격리(Accepted): 격리 기본값 + "전역 설정 사용(고급)" 토글(켜도 셸 ask 규칙 유지). 에이전트별 동등 설정은 레지스트리 `sessionOptions` |
| Codex 연동 미검증 | S3 | M2 중 Codex CLI 설치 후 `spikes/s3-acp-claude`의 `acp-probe`로 재검증, 지원 매트릭스 갱신 |
| HMR이 연속 쓰기를 놓침 | S4 | 파일 감시 + `hmr` 보고 비교 + `reload` (T4 항목) |
| FFmpeg 빌드 변동·라이선스(GPL) | S1·S6 | 메이저 계열 고정 + 해시 기록, 앱 번들 금지·동의 후 다운로드, 배포 전 법률 검토(P6) |
| 편집 PPTX 품질 | S5 | Beta 표시, 설치 폰트 조건 안내, `wrap` 후처리, 이미지 PPTX 기본 |
| DESIGN.md 형식 변동(alpha) | S7 | 자체 관대한 스키마, CLI 버전 고정, 모르는 키 보존 |
| 템플릿 코드의 `assetProtocol.scope: ["**"]` | 설계 §10 | M1에서 축소 |
| 심미 품질 | 리스크 §2.5 | M6 템플릿·`vanilla-core` 체크리스트, M4 `snapshot_scene` 자기 검수, P5 골든 샘플 |

## 6. 구현 중 확정할 항목

| 항목 | 확정 시점 | 판단 기준 |
| --- | --- | --- |
| pnpm 워크스페이스(`packages/runtime`, `packages/export-worker`) 도입 | M1 T1.3 | 루트 lint·typecheck·test와 공존, 빌드 산출물을 `resources/`로 복사 가능 |
| MCP 서버 구현(Rust `rmcp` vs Node) | M2 | Streamable HTTP + Bearer 토큰, 앱 상태 접근 용이성 |
| 로컬 HTTP 서버 크레이트(`axum`/`tiny_http`) | M2(MCP)·M6(플레이그라운드) | MCP와 정적 서빙을 한 서버로 처리할 수 있는지 |
| 편집 PPTX 호환 폰트 필드(`DESIGN.md`) | M5 | S5 폰트 조건 대응 방식 |
| `@google/design.md` CLI 고정 버전 | M3 | lint 결과 안정성 |

## 7. 완료 정의 (Definition of Done)

- TODO 항목: 완료 판정 방법을 충족하고, `pnpm lint`·`typecheck`·`test`(+Rust 변경 시 `cargo test`)가 통과한다.
- 마일스톤: 완료 기준 데모를 수행하고 `wiki/sources/milestone-mN.md`를 작성했으며, 기획·설계 문서의 관련 절을 갱신하고, 사용자 확인 후 `master`에 병합한다.
