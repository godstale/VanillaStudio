# Vanilla Studio v2 구현 계획서 (Implementation Plan)

- 문서 버전: **v2.0 (2026-10-05)** — v1 계획(M1~M7)은 `legacy/Implementation-Plan-v1.md`
- 선행 문서: `Refactor-Spec-v2.md` v0.3, `Technical-Design.md` v1.0, `Decisions.md`(D-022~D-033 Accepted), `Feasibility-Risks.md`(v1 PoC S1~S7 결과는 유효, v2 PoC는 §5)
- 작업 목록: `Docs/Planning/TODO.md` (1~2시간 단위, 항목마다 대상 파일·완료 판정·선행 항목)
- 병렬 실행: `Docs/Planning/Parallel-Execution.md`

---

## 1. 출발점 (v1 자산 재사용 지도)

| v1 자산 | v2 처리 | 근거 |
| --- | --- | --- |
| `packages/runtime`(Scene 런타임·Bridge·디자인 토큰·`check_scene`) | **보존·확장**(Bridge v2, canvas 주입, Text Fidelity 검사) | S1·S4·S7 검증 |
| `src/lib/design`(DESIGN.md 파서·재작성·팔레트·대비) | **보존·확장**(extends, 분석 마커) | S7 |
| `src-tauri/src/process`, `watch.rs`, doctor, FFmpeg 다운로드 | 보존 | S6 |
| PTY + xterm 터미널 | 보존·확장(신 폴더 cwd, 클립보드) | M2 T2.11 |
| 플레이그라운드 | 확장(시퀀스 재생기) | M6 |
| `packages/export-worker`·export UI | 코드 보존, 앱 호출 제거(D-027) | M5 |
| 골든 샘플(`resources/samples/`, 강동 숲 도서관 등) | 가이드 검증·데모 샘플로 활용 | — |
| ACP `agent_host`·MCP·파이프라인·검수 스튜디오·프로젝트 마법사·템플릿 갤러리 | **제거**(`v1-final` 태그 후, 사용자 확인) | D-022 |

## 2. 마일스톤

| ID | 목표 | 완료 기준(데모) | 브랜치 |
| --- | --- | --- | --- |
| **V1 기반 정리** | v1 레거시 격리, 작업 폴더 온보딩, 새 앱 셸(사이드바+캔버스), 워크스페이스 스위처 | ① `v1-final` 태그 ② 앱 시작 → 작업 폴더 선택 → `workspace.json`·루트 `AGENTS.md`·`DESIGN.md` 생성 ③ 빈 ComfyUI형 캔버스 표시 ④ 다른 워크스페이스로 전환 | `feat/v2-foundation` |
| **V2 Scene CRUD·지침 생성** | 신 생성과 폴더 스캐폴딩, `scene.json` 스키마, 가이드 엔진 코어와 `AGENTS.md`·`GUIDE.md`·프롬프트 렌더 | ① 캔버스에서 3타입 신 생성 → `scenes/<slug>/` 파일 세트 생성 ② 노드 클릭 → 인스펙터 개요 편집 → 파일 재렌더 ③ 캔버스 규격(프리셋) 설정 | `feat/v2-scenes` |
| **V3 가이드·인스펙터** | 3타입 가이드 템플릿, 용어집 드롭다운, 항목별 편집 UI, 사용자 정의 템플릿 | ① motion `commercial-v1` 전 항목을 폼으로 편집 ② 용어 콤보박스로 선택 → `scene.json`에 ID 저장 ③ static·3d 템플릿 편집 ④ 내장 템플릿 복제 → 사용자 템플릿 적용 | `feat/v2-guides` |
| **V4 터미널 실행·재생** | 에이전트 실행(PTY+클립보드), 결과 검증·되쓰기 감시, 단일 신 미리보기, 썸네일 | ① [에이전트 실행] → 터미널 + 프롬프트 클립보드 ② 에이전트가 `src/` 작성 → 상태 갱신·썸네일 ③ 실제 Claude Code로 motion 신 1개 생성·재생 | `feat/v2-run` |
| **V5 레퍼런스 분석** | 레퍼런스 등록·키프레임, 분석 태스크, DESIGN.md·가이드 반영 diff | ① 영상/URL 레퍼런스 등록 ② [분석 실행] → `analysis/*.md`·DESIGN.md 마커 구간·`scene.json` 반영 ③ diff 승인·되돌림 | `feat/v2-reference` |
| **V6 시퀀스·플레이그라운드** | 노드 간 엣지·전환·분기, 시퀀스 매니저, 플레이어 | ① 3개 신 연결(linear) 재생 ② 정적 신이 사용자 입력으로 전환(step 포함) ③ choice 분기 인터랙티브 시퀀스 재생 | `feat/v2-sequence` |
| **V7 패키지·마이그레이션·릴리스** | `.vsx` 공유·재현, 템플릿 저장, v1 마이그레이션(조건부), 샘플·문서·인스톨러 | ① `.vsx` 만들기 → 다른 워크스페이스에서 열어 재생·재현 ② 샘플 3종 ③ 마이그레이션 게이트 판정 ④ 인스톨러·클린 VM | `feat/v2-release` |

## 3. 작업 순서와 의존성

```
V1 ──▶ V2 ──┬─▶ V3 ──▶ V4 ──┬─▶ V5
            │               └─▶ V6 ──▶ V7
            └─ (V3 가이드 작성 = 콘텐츠 작업, V2 이후 V4와 병렬 가능)
```

- **V1 선행**: PoC R-5(캔버스 스파이크)를 V1 첫머리에서 수행해 `@xyflow/react` 채택 여부를 정한다.
- **V3 콘텐츠 작업**(가이드 `rules.md`·용어집 작성: T3.5·T3.7·T3.9)은 코드 작업과 독립이라 V2 완료 직후 별도 레인에서 병렬 진행 가능하다.
- **V4 런타임·Bridge v2 작업**(T4.7)은 `packages/runtime` 소유 레인이며 V2와 병렬로 시작해도 된다.
- **V6 PoC R-1**(전환 합성)은 V4 완료 후 V6 첫머리에 수행한다. 결과에 따라 T6.3의 전환 종류 범위를 확정한다.
- 마일스톤마다 `main`에서 브랜치를 만든다. 완료 기준 충족 후 사용자 확인을 받아 병합하고, push는 매번 승인받는다.

## 4. 테스트 계획

| 마일스톤 | 자동 테스트 | 수동 확인(데모) |
| --- | --- | --- |
| 공통 | `pnpm lint`·`typecheck`·`test`, Rust는 `cargo test`, 문서만 변경 시 wiki lint | 마일스톤 데모 스크린샷 → `wiki/sources/milestone-v*.md` |
| V1 | `workspace.json` zod, canonical 직렬화 왕복, 스코프(Rust), 최근 목록 DB, 레거시 제거 후 lint·typecheck·test 통과 | 앱 실행·온보딩·스위처 |
| V2 | `scene.json`(3타입), 스캐폴딩 트리, 가이드 렌더 결정성·마커 보존, 프롬프트 헤더(`workspaceId`) | 3타입 신 생성, 인스펙터 편집 |
| V3 | 용어집 로더, 템플릿 `extends` 병합·검증 실패 케이스, 폼 ↔ 스키마 왕복, `beats` 시간 합 검증 | 3타입 템플릿 편집, 사용자 템플릿 적용 |
| V4 | 고정 argv, 완료 판정·화이트리스트 경고, Bridge v2 메시지, 목 에이전트 통합, Text Fidelity 규칙 | 실제 Claude Code·Codex로 신 생성 |
| V5 | references 스키마, 마커 구간 읽기/쓰기(바이트 보존), extends 상속 해석, 키프레임 추출 인자 | 영상 레퍼런스 분석 E2E |
| V6 | 시퀀스 검증, 상태 머신(trigger 종류별), 전환 구현 단위, step/입력 라우팅 | 인터랙티브 시퀀스 재생(CDP E2E) |
| V7 | manifest·해시·zip-slip 거부, 패키지 왕복 바이트 동일, 마이그레이션 변환 | 다른 PC 재현, 클린 VM 체크리스트 |

**골든 샘플**: 3타입 각 1개 + 시퀀스 1개를 `resources/samples/`에 두고 같은 입력 → 같은 가이드 렌더(스냅샷)와 같은 `t` → 같은 프레임(motion·3d)을 회귀 테스트한다. 기존 강동 숲 도서관 샘플은 V7에서 v2 워크스페이스 샘플로 변환한다.

## 5. 위험과 PoC (구현 단계)

| ID | 위험 | 완화·PoC | 시점 |
| --- | --- | --- | --- |
| R-5 | 캔버스 라이브러리가 ComfyUI 외형·성능을 충족하지 못함 | 스파이크: `@xyflow/react` 100노드 성능·커스텀 노드 스타일. 기준: 팬/줌 60fps 근접, 연결 편집 정상. 미달 시 자체 캔버스(SVG+포인터) 범위 재산정 | V1 첫머리 |
| R-1 | 서로 다른 iframe 신 사이 전환 합성 | 스파이크: 두 iframe 오버레이 합성 vs 종료/시작 프레임 캡처 오버레이. 미해결 시 v2.0 전환은 cut·crossfade·slide로 한정 | V6 첫머리 |
| R-2 | 에이전트가 되쓰기 규칙·스키마를 어김 | zod 검증·화이트리스트 경고·diff 승인·스냅샷 되돌림(V4.5) | V4 |
| R-3 | 클립보드 → 붙여넣기 마찰 | 짧은 프롬프트 + 파일 참조, auto-paste 옵션, 실패 시 경로 안내 | V4 |
| R-4 | 코드 기반 상업 모션 품질 | 가이드 구현 힌트·골든 샘플·checklist·`pnpm check:scene` | V3~V4 |
| R-6 | 레거시 제거 회귀 | `v1-final` 태그, 보존 모듈 테스트 유지, 제거는 모듈 단위로 lint·typecheck·test 확인 | V1 |
| R-7 | URL 레퍼런스 약관·저작권 | 앱은 URL 미다운로드, 에이전트 열람용 기록만 | V5 |
| R-8 | 정적 신 `steps`·Bridge v2 변경으로 런타임 회귀 | 런타임 단위 테스트 + CDP E2E, `v` 필드 불일치 무시 | V4 |
| R-9 | 가이드 템플릿 확장성·보안 | 확장만 허용 스키마, 가져올 때 `rules.md` 미리보기·출처 확인 | V3·V7 |
| R-10 | 에이전트가 워크스페이스·신을 혼동 | `workspaceId`·cwd 한정·프롬프트 헤더, 신 폴더 밖 쓰기 감지 경고(파일 감시) | V2·V4 |

## 6. 구현 중 확정할 항목

| 항목 | 시점 | 판단 기준 |
| --- | --- | --- |
| 캔버스 라이브러리 | V1 R-5 | 성능·스타일링·MIT |
| 로컬 HTTP(플레이그라운드·프리뷰 서빙) 방식 | V4~V6 | Vite 멀티 엔트리로 충분한지 vs 정적 서버 필요한지 |
| 신 iframe 로딩 방식(신별 Vite 엔트리 vs 사전 빌드) | V4 | HMR·재생 안정성 |
| 에이전트 자동 붙여넣기 지원 범위 | V4 | 에이전트별 준비 감지 가능 여부 |
| 전환 구현(합성/캡처) | V6 R-1 | PoC 결과 |
| 가이드 템플릿 `schema.json` 확장 문법 | V3 | 필드 추가·숨김·기본값만으로 충분한지 |

## 7. 완료 정의 (Definition of Done)

- TODO 항목: 완료 판정 방법을 충족하고 `pnpm lint`·`typecheck`·`test`(+Rust 변경 시 `cargo test`)가 통과한다. UI 문구는 ko/en 사전, 색상은 시맨틱 토큰.
- 마일스톤: 완료 기준 데모를 수행하고 `wiki/sources/milestone-v<N>.md`를 작성했으며, 기획·설계 문서의 관련 절을 갱신하고(`Refactor-Spec-v2.md`·`Technical-Design.md` 버전 올림), 사용자 확인 후 `main`에 병합한다.
- 데이터 계약 변경(AGENTS.md §4-5)은 zod·설계서·가이드 템플릿·버전 필드를 함께 갱신한다.
