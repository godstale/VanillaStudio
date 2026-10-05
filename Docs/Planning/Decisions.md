# 의사결정 기록 (Decision Log)

> 기획·설계·구현 중 내린 **되돌리기 비싼 결정**을 기록합니다.
> 새 결정은 맨 아래에 `D-NNN`으로 추가하고, 번복 시 기존 항목의 상태를 `Superseded by D-NNN`으로 바꿉니다.
> 모든 결정은 `wiki/log.md`에도 한 줄 기록합니다.

| 상태 값 | 의미 |
| --- | --- |
| Accepted | 사용자 확인 완료, 설계·구현의 전제 |
| Proposed | 에이전트 제안, 사용자 확인 대기 |
| Superseded | 다른 결정으로 대체됨 |

---

## D-001 에이전트 연동: ACP 우선 + 내장 터미널 폴백 — Accepted (2026-09-28)

- **맥락**: Claude Code·Codex·OpenCode·Hermes·AGY를 모두 도구로 써야 함. 각 CLI의 헤드리스 출력 포맷이 제각각.
- **결정**: [Agent Client Protocol](https://agentclientprotocol.com)(JSON-RPC over stdio)을 1차 연동 방식으로 사용.
  ACP를 지원하지 않거나 어댑터가 불안정한 에이전트는 내장 터미널(PTY + xterm.js)로 CLI를 그대로 실행.
- **근거**: Claude Code·Codex는 공식 ACP 어댑터, OpenCode·Hermes는 네이티브 ACP 지원. AGY는 2026-09 기준 네이티브 ACP 없음(커뮤니티 어댑터, `stream-json` 헤드리스 모드만 존재).
- **영향**: 권한 요청·파일 diff·도구 호출을 UI에서 구조적으로 표시 가능. MVP 공식 지원은 Claude Code·Codex, 나머지는 "실험적".

## D-002 MVP 결과물 범위: 웹/인터랙티브 + 슬라이드 + 이미지 + 동영상 — Accepted (2026-09-28)

- **결정**: 네 가지 유형 모두 MVP에 포함.
- **사용자 보충**: 동영상은 "React에서 구현 가능한 2D/3D 애니메이션을 코딩으로 구현하고, 이를 영상으로 저장하는 형태".
- **영향**: 모든 결과물은 동일한 React 기반 Scene 런타임 위에서 만들고, 결과물 유형은 "export 방식"의 차이로 취급한다(→ D-011).

## D-003 PPT export: 이미지 기반(기본) + 편집 가능 PPTX(옵션) — Accepted (2026-09-28)

- **결정**: 기본은 슬라이드별 고해상도 캡처 → PPTX/PDF(시각 충실도 100%, 편집 불가).
  옵션으로 `dom-to-pptx` 계열 변환(편집 가능, 근사치, Beta). PPT 내 애니메이션은 지원하지 않음.

## D-004 동영상 렌더 엔진: HyperFrames — Accepted (2026-09-28)

- **결정**: HeyGen의 [HyperFrames](https://github.com/heygen-com/hyperframes)(Apache-2.0)를 렌더러로 사용.
- **근거**: 헤드리스 Chrome + FFmpeg 결정적(deterministic) 렌더, three.js/GSAP/CSS/WAAPI 어댑터와 커스텀 seek 어댑터 제공, 에이전트용 설계. Remotion은 4인 이상 조직 유료 라이선스.
- **리스크**: React/R3F 앱을 HyperFrames의 seek 계약에 맞추는 부분은 PoC(S1)로 검증 필요. Node 22+ 요구.

## D-005 대상 OS·의존성: Windows 우선 + 의존성 점검 마법사 — Accepted (2026-09-28)

- **결정**: Windows 11 우선. Node 22+·에이전트 CLI는 사용자가 설치(각자 구독 계정 사용). 앱은 "환경 점검(Doctor)" 화면에서 Node·pnpm·git·에이전트 CLI·FFmpeg·Chrome 상태를 확인하고 설치를 안내한다. FFmpeg는 앱이 다운로드 관리. macOS는 2차.

## D-006 에셋 정책: 코드 + 사용자 자료 + 오픈 라이선스 리소스 — Accepted (2026-09-28)

- **결정**: 생성형 이미지/영상 AI 서비스는 사용하지 않는다. 절차적 생성(SVG·Canvas·셰이더·three.js 지오메트리)이 기본.
  사용자 제공 자료, 오픈 폰트(Google Fonts 등 OFL), CC0 에셋(HDRI·텍스처·아이콘)은 허용하되 **출처·라이선스를 `assets/CREDITS.md`에 기록**해야 한다.

## D-007 수동 조절 수준: 파라미터 패널 + 타임라인 스크러버 — Accepted (2026-09-28)

- **결정**: 기획 단계에서 선언된 "조절 가능 파라미터"를 폼으로 조절 + 재생/정지/프레임 이동(스크럽). 키프레임 편집·캔버스 직접 조작은 MVP 제외.
- **근거**: 코드 재생성 없이 JSON 값만 바꿔 반영 가능. GSAP 표준 라이선스는 "Webflow와 경쟁하는 비주얼 애니메이션 빌더"에서의 사용을 금지하므로, 앱 자체 편집 기능이 GSAP에 의존하지 않도록 한다(→ D-011).

## D-008 디자인 템플릿 형식: Agent Skill — Accepted (2026-09-28)

- **결정**: 템플릿 = `SKILL.md` + 참조 프롬프트 + 예제 코드 + `template.json`(미리보기·메타데이터). 프로젝트 생성 시 `.claude/skills/`와 `.agents/skills/`에 설치해 에이전트 종류와 무관하게 인식되도록 한다.

## D-009 프로젝트 모델: 폴더 1개 = 프로젝트 1개 = 결과물 1개 — Accepted (2026-09-28)

- **결정**: 템플릿의 "폴더 열기" 구조를 재사용. brief → 기획서 → 구현 계획서 → 코드 → 검수 기록 → export가 모두 폴더 안 파일로 존재. 하나의 결과물은 여러 Scene을 가질 수 있다.
- **근거**: 에이전트가 파일을 직접 읽고 쓰는 것이 가장 자연스럽고, git 히스토리로 버전 관리가 된다.

## D-010 권한 정책: 프로젝트 폴더 내 파일 쓰기 자동, 셸은 매번 확인 — Accepted (2026-09-28)

- **결정**: ACP `session/request_permission` 중 프로젝트 폴더 내 파일 읽기/쓰기는 자동 허용, 셸 명령은 매번 "이번만 허용/거부" 다이얼로그. 프로젝트 폴더 밖 접근은 항상 거부.

## D-011 공통 Scene 런타임, 시간 함수 계약은 영상·이미지에만 필수 — Accepted (2026-09-29, 범위 수정)

- **원 제안(2026-09-28)**: 모든 결과물 유형이 `@vanilla/runtime` 계약을 따르고, 애니메이션은 `t`(초)의 순수 함수로 작성한다.
- **사용자 결정(2026-09-29)**: 시간 함수 계약은 **영상·이미지 export 대상에만** 적용한다. 웹/인터랙티브는 자유로운 애니메이션 코드를 허용한다.
- **결정**:
  - 모든 유형이 같은 React 런타임을 쓴다: `defineScene`, `useParams`, `useDesign`, Bridge. 그래서 파라미터 패널·팔레트 교체·수정 요청은 유형과 무관하게 동작한다.
  - **시간 함수 계약(필수)**: `video`, `image`. 애니메이션은 `useTime()`의 순수 함수이며 금지 API 검사(`check_scene`)를 강제한다. R3F는 `frameloop="demand"`.
  - **정적 캡처 규칙**: `slides`의 PPTX/PDF export는 이미지 캡처이므로 이미지와 같은 규칙을 따른다. 슬라이드 빌드 애니메이션은 HTML 덱에서만 재생한다. (에이전트 해석, 이견 시 수정)
  - **자유 모드**: `web`, `interactive`. `requestAnimationFrame`·R3F `useFrame(delta)`·실시간 라이브러리를 허용한다. 호스트는 재생/일시정지만 제어하고 타임라인 스크러버는 제공하지 않는다. 스냅샷은 "현재 화면" 캡처라 재현성을 보장하지 않는다.
  - GSAP는 생성 코드 안에서 선택적으로 쓸 수 있으나, 앱 기능은 GSAP에 의존하지 않는다.
- **근거**: 결정성이 꼭 필요한 곳(영상 프레임·이미지 캡처)에만 제약을 두고, 웹 결과물은 에이전트가 익숙한 방식으로 자유롭게 만들게 한다.
- **영향**: 웹/인터랙티브 결과물을 나중에 영상으로 파생(F-PRJ-05)하려면 시간 함수 계약으로 다시 작성해야 한다.
- **확인 방법**: `check_scene`의 시간 API 규칙은 `vanilla.json`의 `outputType`에 따라 켜고 끈다.

## D-012 앱 소유 프로세스는 `run_shell`과 분리 — Accepted (2026-09-29)

- **제안**: 프리뷰 서버(Vite), export 워커, 의존성 설치(`pnpm install`)는 **고정된 argv만 허용하는 전용 Tauri 명령**으로 실행한다. 임의 문자열을 받는 `run_shell`은 계속 "매번 사용자 확인" 원칙을 유지한다.
  `pnpm install`처럼 네트워크를 쓰는 작업은 프로젝트 생성 마법사에서 1회 명시적으로 동의받는다. 이후에는 `package.json`이 바뀔 때만 다시 확인한다.
- **사용자 결정(2026-09-29)**: 제안대로 승인.

## D-013 프로젝트 체크포인트: git 자동 커밋 — Accepted (2026-09-29)

- **제안**: 사용자 프로젝트 폴더를 git 저장소로 초기화하고, 빌드 태스크 완료·수정 요청 반영·파라미터 저장 시 앱이 자동 커밋(체크포인트)한다. 검수 화면에서 이전 체크포인트와 비교·되돌리기 제공. git 미설치 시 폴더 스냅샷으로 대체.
- **사용자 결정(2026-09-29)**: 제안대로 승인. 이 결정은 **사용자 결과물 프로젝트 폴더**의 로컬 git이며, 앱 개발 저장소(원격 https://github.com/godstale/VanillaStudio)와는 별개다.

## D-014 앱에서 에이전트용 MCP 도구 제공 — Accepted (2026-09-29)

- **제안**: ACP `session/new`의 `mcpServers`로 앱 내장 MCP 서버 `vanilla-tools`를 전달한다.
  도구: `snapshot_scene`(지정 시각 스크린샷), `check_scene`(런타임 계약 검사), `get_review`(검수 코멘트 조회), `update_task_status`.
  에이전트가 셸 권한 없이도 **자기 결과물을 눈으로 확인(visual self-review)** 할 수 있게 해 심미적 품질을 높인다.
- **사용자 결정(2026-09-29)**: 승인, **MVP 필수(M)** 로 격상(F-AGT-06). MCP 연결은 PoC S3에서 함께 검증한다.

## D-015 디자인 시스템 전달 표준: 프로젝트 `DESIGN.md` — Accepted (2026-09-29)

- **맥락**: 사용자 요청 — "디자인 가이드를 에이전트에게 전달하는 표준 방식인 DESIGN.md를 적극 활용해 표준적인 동작 환경을 구성". 기존 기획은 색·타이포를 `plan.json`의 `concept.palette/typography`와 템플릿 `references/`에 흩어 두었다.
- **결정**: Google Labs의 [DESIGN.md](https://github.com/google-labs-code/design.md) 형식(Apache-2.0, alpha)을 프로젝트 디자인 시스템의 단일 진실 공급원으로 쓴다.
  - 위치: 프로젝트 루트 `DESIGN.md`. 템플릿은 기본 `DESIGN.md`를 반드시 포함한다.
  - 에이전트: 시각 작업 전 `DESIGN.md`를 읽고 값은 토큰으로만 쓴다(프로젝트 `AGENTS.md`·`vanilla-core` 규칙).
  - 런타임: Vite 플러그인이 `DESIGN.md`를 읽어 CSS 변수(`--color-*`)와 `useDesign()`으로 제공한다.
  - 소유: Plan 승인 후 토큰 값은 사용자 소유. 에이전트는 수정 요청이 있을 때만 바꾼다.
  - 영상: 선택 파일 `frame.md`(HyperFrames FRAME.MD)로 모션·페이싱 지침을 보조한다. 토큰은 `DESIGN.md`만.
- **근거**: 에이전트 종류와 무관한 공개 형식이고, 토큰(정확한 값)과 산문(의도)을 한 파일에 담는다. HyperFrames도 같은 파일을 읽어 `:root`에 바인딩하는 방식을 쓴다.
- **리스크**: alpha 형식 변동 → 자체 스키마로 관대하게 읽고 공식 CLI는 버전 고정·선택적 사용. PoC S7.

## D-016 컬러 팔레트 = `DESIGN.md` 색 역할 토큰, 교체는 에이전트 없이 — Accepted (2026-09-29)

- **맥락**: 사용자 요청 — "같은 형태 디자인도 컬러 팔레트로 결과물의 느낌이 달라질 수 있으니 팔레트 기능을 기획에 포함".
- **결정**:
  - 팔레트는 표준 색 역할(핵심 4 + 파생 5, 아래 S7 확정)에 색을 배정한 묶음(`palette.json`).
  - 적용하면 `DESIGN.md` front matter의 `colors`를 교체하고, 본문은 이전 색 값이 적힌 곳만 갱신한다. 미리보기는 Bridge로 즉시, 저장은 `적용` 시 + 체크포인트. 에이전트 호출 없음.
  - 기능: 내장 라이브러리, 편집기(OKLCH·잠금), WCAG 대비 경고, 기준색 조화 생성·자료 이미지 색 추출(로컬 계산), 팔레트 비교 스냅샷.
  - `color` 파라미터 기본값은 토큰 참조를 권장. 사용자가 직접 지정한 값은 팔레트 교체 후에도 유지.
- **근거**: 형태(템플릿·코드)와 색을 분리하면 재생성 비용 없이 무드를 탐색할 수 있다.
- **S7 확정(2026-09-29)**:
  - 역할은 핵심 4개(`canvas`·`ink`·`primary`·`accent`, 필수)와 파생 5개(`surface`·`ink-muted`·`line`·`secondary`·`on-primary`, 대비 보장 자동 계산)로 정했다.
  - CSS 변수는 공식 CLI와 같은 `--color-*`를 쓴다.
  - 본문에 적힌 이전 색 값은 적용할 때 함께 갱신한다.
  - HyperFrames 팔레트 18종 모두 표현되고 대비를 통과했다.

## D-017 HyperFrames 프리셋·카탈로그는 참고 자료로만 사용 — Accepted (2026-09-29)

- **맥락**: 사용자가 템플릿 구성 참고용으로 [FRAME.MD 프리셋](https://www.hyperframes.dev/design)과 [카탈로그](https://hyperframes.heygen.com/catalog)를 지정.
- **제안**: 두 자료를 내장 템플릿·`DESIGN.md`·팔레트·에셋 예제를 설계할 때의 **참고 자료**로 쓴다.
  - 카탈로그 항목은 GSAP paused timeline 기반 HTML이므로 코드를 복사하지 않고 Vanilla 런타임으로 다시 구현한다(영상·이미지용은 `useTime()` 순수 함수, D-007·D-011과 일관).
  - 차용 시 항목별 라이선스·폰트 라이선스를 확인하고 템플릿 `CREDITS.md`에 기록한다.
  - 앱 안에서 카탈로그를 검색·설치하는 기능(`hyperframes add` 연동)은 MVP에 넣지 않는다.
- **사용자 결정(2026-09-29)**: 제안대로 승인.
- **근거**: 저장소는 Apache-2.0이지만 항목별 `license` 필드가 선택이고, GSAP 의존 코드를 앱 번들 템플릿에 넣으면 D-007의 라이선스 원칙과 충돌할 수 있다.

## D-018 에이전트 세션 격리: 사용자 전역 설정을 빼고 셸 ask 규칙 강제 — Accepted (2026-09-29)

- **맥락**: PoC S3.
  - 기본 설정의 Claude Code는 사용자 전역 `~/.claude`(스킬·커넥터·허용 목록)를 불러온다.
  - 읽기 전용 셸 명령(`echo` 등)은 권한 요청 없이 실행해 D-010("셸은 매번 확인")을 어긴다.
  - 전역 커넥터 안내가 에이전트 답변에 섞이고, 컨텍스트·비용도 늘었다(28.5k → 격리 시 21.5k, 비용 약 1/3).
- **제안**: 앱이 여는 에이전트 세션은 다음 옵션으로 격리한다.
  - Claude Code: `_meta.claudeCode.options`에 `settingSources: ["project"]`, `settings.permissions.ask: ["Bash", "PowerShell"]`
  - 다른 에이전트: 동등한 설정을 에이전트 레지스트리의 `sessionOptions`로 관리
  - 세션은 프로젝트의 `AGENTS.md`/`CLAUDE.md`·프로젝트 스킬(템플릿·`vanilla-core`)만 사용한다.
- **사용자 결정(2026-09-29)**: 제안대로 승인.
- **영향**: 사용자의 개인 전역 CLAUDE.md·스킬·MCP 커넥터는 Vanilla 프로젝트 세션에 적용되지 않는다. 필요하면 설정 화면에 "전역 설정 사용(고급)" 토글을 두되, 켜도 셸 ask 규칙은 유지한다.

## D-019 FFmpeg 다운로드 메이저 계열을 8로 고정 — Proposed (2026-09-29)

- **맥락**: M1 T1.10 구현. BtbN 릴리스에는 8.1, 9.0, master가 함께 올라온다. S1은 8.1로 렌더 결정성을 검증했고, S6에서 9.0도 렌더는 성공했지만 출력 바이트가 달랐다.
- **제안**: 앱이 내려받는 FFmpeg는 메이저 8 계열로 고정한다(`PINNED_MAJOR = 8`). 9로 올리려면 결정성 재검증 후 상수를 바꾼다. 다운로드 자산명과 SHA-256은 `tools/ffmpeg/ffmpeg.json`에 기록한다.
- **영향**: Doctor의 FFmpeg 판정은 메이저 8 미만을 "업데이트 필요"로 본다. 사용자 결정 전에는 이 값을 바꾸지 않는다.

## D-020 `vanilla.json` 필드 계약(M1 구현분) — Proposed (2026-09-29)

- **맥락**: 설계서에 `vanilla.json` 필드 정의가 없어 T1.7이 기획서 §6·§8.1을 근거로 정했다.
- **제안**: 필드는 `version`, `name`, `outputType`, `format`(유형별: video는 fps·durationSec 필수), `template`, `palette{id,source}`, `agents{default,enabled}`, `runtime.version`, `createdAt`이다. 에이전트 ID는 `claude-code`·`codex`·`opencode`·`hermes`·`agy`, 기본 팔레트 ID는 `vanilla-default`, 스캐폴딩 플레이스홀더는 `{{projectName}}`·`{{createdAt}}`이다. 스키마 원본은 `src/lib/project/schema.ts`.
- **영향**: 확정되면 설계서 §8·§9와 `vanilla-core` 스킬(T6.1)에 반영하고 `version` 필드로 이후 변경을 관리한다(AGENTS.md §4-5).

## D-021 assetProtocol 스코프와 Bridge 스키마 보완(M1 구현분) — Proposed (2026-09-29)

- **assetProtocol**: Tauri의 스코프는 추가만 되고 회수할 수 없다(`forbid_directory`는 영구·우선). 그래서 이번 세션에 연 프로젝트 폴더는 앱 재시작까지 읽기 가능하게 남는다. 설계서 §10("현재 프로젝트로 동적 제한")과 다르다. 대안은 정적 스코프를 없애고 프로젝트별 커스텀 프로토콜을 쓰는 것이다.
- **Bridge(설계서 §5 보완)**: `capture` payload에 선택 필드 `id`를 두고 `captured` 응답이 그대로 돌려준다. `setDesign` payload는 `{colors: {...} | null}`, `ready.design.roles`는 역할명→해석된 색 맵이다. `setDesign` 값은 hex 또는 함수형 색 표기만 허용한다.
- **영향**: 호스트(T4.11)가 위 스키마에 맞춘다. 사용자 결정 전에는 설계서를 고치지 않는다.

## D-022 v2 리팩토링: ACP 에이전트 호스트를 터미널 실행+클립보드 방식으로 대체 — Proposed (2026-10-05)

- **맥락**: 앱을 "신 가이드·지침 파일 생성 + 결과 재생 플랫폼"으로 재정의(`Refactor-Spec-v2.md`). 에이전트 구동·권한 처리는 에이전트 CLI에 맡긴다.
- **제안**: ACP `agent_host`·세션 격리(D-010·D-018)·파이프라인 UI를 제거/보관하고, 내장 PTY 터미널에서 고정 argv로 에이전트를 실행하며 프롬프트를 클립보드로 전달한다. D-010·D-018은 폐기 후보.
- **영향**: AGENTS.md §2·§7, 설계서 전반 개정. 승인 전에는 기존 코드를 삭제하지 않는다.

## D-023 Scene 중심 작업 폴더·`scene.json` 진실 공급원 — Proposed (2026-10-05)

- **제안**: 작업 폴더 = 워크스페이스. `scenes/<slug>/scene.json`(zod, version)이 진실 공급원, `GUIDE.md`·`AGENTS.md`·`prompts/*`는 생성물. 신 ID 불변, 용어는 ID로 저장, 바이트 정규화.

## D-024 Scene 타입 3종과 런타임 재사용 — Proposed (2026-10-05)

- **제안**: `static`(자유 모드)·`motion`(`useTime` 순수 함수)·`3d`(three.js, 시간 구동). D-011 계약 유지. 시퀀스 매니저가 신을 순차 재생·전환.

## D-025 시퀀스 = 노드 그래프(신 노드, 전환 엣지) — Proposed (2026-10-05)

- **제안**: ComfyUI형 캔버스(`@xyflow/react` 검토). 엣지에 `trigger`·`transition` 정의로 PPT·영상·인터랙티브 구성. 전환 합성은 PoC R-1 선행.

## D-026 레퍼런스 분석은 에이전트 태스크로 수행 — Proposed (2026-10-05)

- **제안**: 앱은 등록·키프레임 추출·분석 프롬프트 생성만 담당. 결과는 `analysis/`·DESIGN.md 마커 구간·`scene.json` 되쓰기 허용 필드에 반영하고 diff 승인. 앱은 URL 영상을 내려받지 않는다.

## D-027 v2.0 공유는 정규화 패키지(.vsx)+재생, export는 후속 — Proposed (2026-10-05)

- **제안**: MP4/PPTX/PNG export 코드는 보존하되 v2.0 범위에서 제외.

## D-028 모션 그래픽 가이드를 코드 구현용으로 개편 — Proposed (2026-10-05)

- **제안**: `Commercial-Motion-Graphic-Prompt-Guide.txt`를 `commercial-v1` 템플릿(스키마·용어집·규칙·프롬프트·체크리스트)으로 분해. 영상 모델용 6,000~7,000자 제한은 폐기.

## D-029 워크스페이스당 시퀀스 1개, 에이전트 구분 규칙 — Proposed (2026-10-05)

- **제안**: 작업 폴더 = 워크스페이스 = 시퀀스 1개(`sequence.json`). 추가 시퀀스는 새 워크스페이스. `workspaceId`를 workspace·sequence·scene·AGENTS.md·클립보드 프롬프트에 기록하고 에이전트 범위를 cwd로 한정. 신 가져오기는 복사만. 상세 `Refactor-Spec-v2.md` §4.1.

## D-030 화면비·해상도·fps는 워크스페이스 전역 고정 — Proposed (2026-10-05)

- **제안**: `workspace.json.canvas`에만 둔다. 신 스키마에는 두지 않는다.

## D-031 사용자 정의 가이드 템플릿을 v2.0에 포함 — Proposed (2026-10-05)

- **제안**: `extends` 기반 복제·편집, 워크스페이스/전역 위치, 공유 패키지에 동봉. 템플릿 내용은 신뢰할 수 없는 데이터로 취급.

## D-032 정적 페이지는 사용자 입력으로만 진행, 내부 step 전환 지원 — Proposed (2026-10-05)

- **제안**: `static` 신의 시퀀스 엣지 trigger는 사용자 입력만 허용. `scene.json.steps[]`로 PPT식 내부 전환 정의, Bridge에 `step`/`next`/`prev` 추가(구현 시 zod·설계서 동시 갱신).

## D-033 v1 프로젝트 마이그레이션: 비파괴 복사, 검증 통과 시 출하 — Proposed (2026-10-05)

- **제안**: 새 폴더로 변환, 원본 불변, best-effort 변환 + 미변환 필드 표시. 샘플 3종 무손실 재생 기준 미달 시 제외.

> 2026-10-05 보강(Proposed): D-030 캔버스 프리셋 16:9·9:16·1:1+사용자 지정 / D-031 전역 템플릿 디렉터리는 앱 설정 `templatesDir`로 지정(팀 공유 폴더 가능, 폴더 밖 쓰기 금지) / D-032 `static.mode: scroll|steps` 추가.
