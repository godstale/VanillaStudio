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

## D-022 v2 리팩토링: ACP 에이전트 호스트를 터미널 실행+클립보드 방식으로 대체 — Accepted (2026-10-05)

- **맥락**: 앱을 "신 가이드·지침 파일 생성 + 결과 재생 플랫폼"으로 재정의(`Refactor-Spec-v2.md`). 에이전트 구동·권한 처리는 에이전트 CLI에 맡긴다.
- **제안**: ACP `agent_host`·세션 격리(D-010·D-018)·파이프라인 UI를 제거/보관하고, 내장 PTY 터미널에서 고정 argv로 에이전트를 실행하며 프롬프트를 클립보드로 전달한다. D-010·D-018은 폐기 후보.
- **영향**: AGENTS.md §2·§7, 설계서 전반 개정. 승인 전에는 기존 코드를 삭제하지 않는다.

## D-023 Scene 중심 작업 폴더·`scene.json` 진실 공급원 — Accepted (2026-10-05)

- **제안**: 작업 폴더 = 워크스페이스. `scenes/<slug>/scene.json`(zod, version)이 진실 공급원, `GUIDE.md`·`AGENTS.md`·`prompts/*`는 생성물. 신 ID 불변, 용어는 ID로 저장, 바이트 정규화.

## D-024 Scene 타입 3종과 런타임 재사용 — Accepted (2026-10-05)

- **제안**: `static`(자유 모드)·`motion`(`useTime` 순수 함수)·`3d`(three.js, 시간 구동). D-011 계약 유지. 시퀀스 매니저가 신을 순차 재생·전환.

## D-025 시퀀스 = 노드 그래프(신 노드, 전환 엣지) — Accepted (2026-10-05)

- **제안**: ComfyUI형 캔버스(`@xyflow/react` 검토). 엣지에 `trigger`·`transition` 정의로 PPT·영상·인터랙티브 구성. 전환 합성은 PoC R-1 선행.

## D-026 레퍼런스 분석은 에이전트 태스크로 수행 — Accepted (2026-10-05)

- **제안**: 앱은 등록·키프레임 추출·분석 프롬프트 생성만 담당. 결과는 `analysis/`·DESIGN.md 마커 구간·`scene.json` 되쓰기 허용 필드에 반영하고 diff 승인. 앱은 URL 영상을 내려받지 않는다.

## D-027 v2.0 공유는 정규화 패키지(.vsx)+재생, export는 후속 — Accepted (2026-10-05)

- **제안**: MP4/PPTX/PNG export 코드는 보존하되 v2.0 범위에서 제외.

## D-028 모션 그래픽 가이드를 코드 구현용으로 개편 — Accepted (2026-10-05)

- **제안**: `Commercial-Motion-Graphic-Prompt-Guide.txt`를 `commercial-v1` 템플릿(스키마·용어집·규칙·프롬프트·체크리스트)으로 분해. 영상 모델용 6,000~7,000자 제한은 폐기.

## D-029 워크스페이스당 시퀀스 1개, 에이전트 구분 규칙 — Accepted (2026-10-05)

- **제안**: 작업 폴더 = 워크스페이스 = 시퀀스 1개(`sequence.json`). 추가 시퀀스는 새 워크스페이스. `workspaceId`를 workspace·sequence·scene·AGENTS.md·클립보드 프롬프트에 기록하고 에이전트 범위를 cwd로 한정. 신 가져오기는 복사만. 상세 `Refactor-Spec-v2.md` §4.1.

## D-030 화면비·해상도·fps는 워크스페이스 전역 고정 — Accepted (2026-10-05)

- **제안**: `workspace.json.canvas`에만 둔다. 신 스키마에는 두지 않는다.

## D-031 사용자 정의 가이드 템플릿을 v2.0에 포함 — Accepted (2026-10-05)

- **제안**: `extends` 기반 복제·편집, 워크스페이스/전역 위치, 공유 패키지에 동봉. 템플릿 내용은 신뢰할 수 없는 데이터로 취급.

## D-032 정적 페이지는 사용자 입력으로만 진행, 내부 step 전환 지원 — Accepted (2026-10-05)

- **제안**: `static` 신의 시퀀스 엣지 trigger는 사용자 입력만 허용. `scene.json.steps[]`로 PPT식 내부 전환 정의, Bridge에 `step`/`next`/`prev` 추가(구현 시 zod·설계서 동시 갱신).

## D-033 v1 프로젝트 마이그레이션: 비파괴 복사, 검증 통과 시 출하 — Accepted (2026-10-05)

- **제안**: 새 폴더로 변환, 원본 불변, best-effort 변환 + 미변환 필드 표시. 샘플 3종 무손실 재생 기준 미달 시 제외.

## D-034 에이전트 중심 UI 개편: 시퀀스·신·템플릿·갤러리 메뉴와 코멘트 계약 — Accepted (2026-10-17)

- **맥락**: 사용자 요청(2026-10-17) — 신을 실제로 제작·관리하는 주체를 에이전트로 못박고, 앱은 `AGENTS.md` 생성(작업 폴더를 열 때, T1.9 이미 구현)과 결과물 탐색·재생 UI에 집중한다.
- **결정**:
  - 메뉴: 시퀀스(기존 워크스페이스 캔버스 변경) · 신(기존 `/scenes` 구현: 목록 + 디자인/동작/재생 확인 + 코멘트) · 템플릿(신규: 종류별 가이드·컬러 팔레트·구성 기법 샘플) · 플레이그라운드(썸네일 갤러리 + 기존 시퀀스 재생 유지, 온라인 탐색·등록은 후속) · 설정(사이드바 최하단).
  - 시퀀스 화면: 신 추가·삭제(폴더 휴지통 + 시퀀스 노드 정리), 전환 설정 유지, 코멘트 리스트 툴박스 오버레이. 신 노드의 "에이전트 실행" 버튼 제거(에이전트는 별도 터미널 실행).
  - 신 화면: 좌측 신 리스트, 가운데 미리보기·계약 검사·코멘트, 인스펙터·터미널은 플로팅(크기 조절) 박스. 인스펙터는 신 화면에서만 쓴다. 앱 하단 도크 제거.
  - 코멘트 계약: `scenes/<slug>/comments.json`(zod `src/lib/scene/comments.ts`, `{id, createdAt, body, status, history[{at, action}]}`) — 시간·처리 내역과 함께 남겨 에이전트가 인식한다.
- **근거**: D-022(앱은 에이전트를 조종하지 않는다)의 연장. 앱 내 실행 버튼·도크를 걷어내고 파일(코멘트·가이드) 기반 협업으로 일원화한다.
- **영향**: `Technical-Design.md` §1(셸 구성)·§8.2(코멘트 파일) 개정. 후속(미포함): 신 `AGENTS.md`에 `comments.json` 읽기 규칙 명시, 시작 신 지정 외 되쓰기 화이트리스트 정리.

## D-035 Opus 5.5 모션 그래픽 아카이브 분해·템플릿화 및 4대 매체 의도 추천 — Accepted (2026-10-18)

- **맥락**: 사용자 요청(2026-10-18) — `yihui-dev/awesome-opus5-5-videos`(MIT, 703개 예제)를 분석해 Vanilla Studio의 내장 템플릿·용어집·팔레트로 등록하고, 사용자가 웹·이미지·슬라이드·모션그래픽 생성을 요청할 때 가장 어울리는 템플릿과 세부 구성 요소(신/비트 구조·타이포그래피·모션 효과·컬러·3D 설정)를 추천·조합하며 미리보기 이미지와 동작 확인 링크를 제공하도록 리팩토링.
- **결정**:
  - **내장 가이드 템플릿 상속(`extends`) 및 12종 특화 템플릿 추가**: `listBuiltinTemplates()`가 내장 간 `extends`를 해석하도록 확장하고, 기본 3종(`commercial@1`, `web-page@1`, `three-scene@1`) 위에 4대 매체 의도(`web`, `image`, `slide`, `motion`)별 특화 템플릿 12종(`opus-ui-morph-loop@1`, `opus-keynote-launch@1`, `opus-kinetic-manifesto@1`, `opus-science-explainer@1`, `opus-kinetic-poster@1`, `opus-pixel-illustration@1`, `opus-interactive-hero@1`, `opus-simulator-canvas@1`, `opus-narrative-deck@1`, `opus-data-explainer-deck@1`, `opus-3d-explorer@1`, `opus-shader-cinematic@1`)을 등록.
  - **세부 항목별 분해 프리셋(`resources/opus/opus-catalog.json`, `src/lib/guides/opusCatalog.ts`)**: 하나의 시퀀스/신 전체 템플릿뿐 아니라 `scene-beats`(신/비트·스텝 타임라인 구조), `typography-style`(타이포그래피·비주얼 무드), `motion-effects`(모션 어휘·안무 키트), `3d-stage`(3D 구도·PBR/셰이더 재질·카메라), 그리고 WCAG AA 검증을 통과한 8종 Opus 컬러 팔레트(`opus-*`)와 20종 용어집 기법으로 분해해 기존 어떤 신에도 개별 병합(`applyDecomposedPreset`) 가능하게 함.
  - **미리보기 이미지(`previewUrl`)와 동작 확인 링크(`actionUrl`)**: 템플릿 메타데이터(`templateMetaSchema`), 용어집(`termSchema`), 팔레트(`paletteFileSchema`), 레시피·세부 프리셋에 `previewUrl`(`https://media.skillry.dev/...`)과 `actionUrl`(`https://skillry.dev/...` 또는 원본 포스트)을 포함하고 Tauri CSP `img-src`에 허용 도메인을 추가.
  - **로컬 매체 의도·프롬프트 추천 엔진(`src/lib/guides/recommend.ts`)**: 외부 LLM 호출 없이 한·영 키워드와 4대 매체 의도로 최적의 템플릿·세부 프리셋·팔레트를 즉시 추천하며, `NewSceneDialog`, `SceneInspector`, `/templates` 갤러리에서 연동. 생성 시 선택된 기법의 `implementationHint`와 템플릿의 `banned` 금지 패턴을 신 `AGENTS.md`에 자동 주입해 코딩 에이전트와 협업.
- **근거**: D-006(생성형 이미지 AI 배제 — `ai-image` 카테고리 제외), D-022(에이전트 중립·파일 기반 지침 전달), D-028·D-031(동일 템플릿 스키마 확장 규칙) 준수.

## D-036 워크스페이스 비파괴 초기화 및 AI 에이전트 브리지(`pnpm vanilla` · `WORK_ORDER.md` · `VANILLA_GUIDE.md`) — Accepted (2026-10-18)

- **맥락**: 사용자 요청(2026-10-18) — 첫 실행 시 미초기화/유효하지 않은 워크스페이스 상태를 정리해 작업 폴더 선택 안내를 노출하고, 사용자가 선택한 폴더가 비어 있든 기존 파일이 있든 에러 대신 AI 에이전트 작업 환경을 비파괴적으로 초기화해야 한다. 또한 디자인·화면 생성은 AI 에이전트가 주도(인터뷰 → 러프 드래프트 → 정밀 다듬기)하고 Vanilla Studio는 결과물 검토·세부 수정 도구로서 변경 내역과 코멘트를 에이전트에 전달하고, 에이전트가 내장 템플릿·기법·참조 이미지를 탐색할 수 있는 연동 통로를 제공해야 한다.
- **결정**:
  - **시작 시 워크스페이스 검증 및 비파괴 초기화**: `WorkspaceContext` 복원 시 `inspect_workspace_folder`로 실제 유효성을 검사해 미초기화 폴더면 온보딩을 표시한다. 폴더 선택 시 빈 폴더(`Empty`)와 비어 있지 않은 일반 폴더(`Other`) 모두 `create_workspace`를 허용하며, 기존 사용자 파일은 보존하고 `AGENTS.md`·`CLAUDE.md`는 마커 구간(`<!-- vanilla:begin:workspace -->`)만 병합한다.
  - **초기화 4대 산출물**:
    1. 에이전트 지침(`AGENTS.md`, `CLAUDE.md`): 3단계 워크플로(Phase 1 사용자 인터뷰 & 템플릿 탐색 → Phase 2 드래프트 우선 스캐폴딩 → Phase 3 `WORK_ORDER.md` 기반 반복 정밀 수정) 정의.
    2. 바닐라 스튜디오 동작·구조·참조 가이드(`VANILLA_GUIDE.md` + `.vanilla/resources/{guides,opus,palettes}`): `sequence.json`·`scene.json`·`param.*` 역할과 15종 내장 템플릿·12종 세부 프리셋·14종 팔레트의 미리보기 이미지(`previewUrl`)·라이브 데모(`actionUrl`) 수록.
    3. 통합 작업 지시서(`WORK_ORDER.md` + `.vanilla/work-order.json` + `scenes/<slug>/comments.json`): 바닐라 스튜디오 UI에서 발생한 시퀀스/신/가이드/파라미터/디자인 팔레트 변경(`recordStudioChange`)과 신별 사용자 코멘트를 자동 집계.
    4. 에이전트 연동 CLI 브리지(`scripts/vanilla-agent.mjs`, `pnpm vanilla <cmd>`): 외부 의존성 없는 Node 내장 스크립트로 `status`, `templates`, `inspect-template`, `scaffold-scene`, `sync-guides`, `work-order`, `resolve` 명령 제공.
- **근거**: D-022(파일 기반 에이전트 중립 연동), D-023(파일이 진실 공급원), D-034(코멘트 계약) 확장.

## D-037 스토리보드 & 3-문서 Material-First 워크플로 — Accepted (2026-10-18)

- **맥락**: `Docs/QualityControl/claude-code-website-guide.md`의 핵심 통찰("AI 티는 대충 던진 지시가 만든 평균의 디자인이며, 고품질 결과물은 3대 문서 분리 → 핵심 재료 선행 구축 → 작은 단위 상향식 조립 → 원인 문서 역추적 수정에서 나온다")을 웹·이미지·슬라이드·모션 전반에 이식 (Refactor Plan `Docs/Planning/Storyboard-Quality-Refactor-Plan.md` v1.0).
- **결정**:
  - 메뉴: Storyboard(`/storyboard`)를 최상단(Storyboard → Sequence → Scenes → Templates → Playground → Settings)에 배치. 워크스페이스 진입 기본 화면은 기존 `/workspace` 유지(복귀 호환).
  - 파일: 워크스페이스 루트 `storyboard/`에 `storyboard.json`(zod·canonical 진실 공급원) + `01-brief.md` + `02-design-flow.md` + `03-visual-direction.md` + `data/{content,items}.json` 정규화.
  - 프로토콜: 코멘트·작업 지시서에 원인 계층(`auto|brief|design-flow|visual-direction|materials|scene-polish`) + `taxonomyTags` 도입(하위 호환 기본값). `renderWorkOrderMarkdown`이 항목마다 역추적 체크리스트를 생성. 화면 코드를 즉흥 수정하지 않고 상위 문서·데이터부터 갱신 후 재조립.
  - 에이전트: 루트 `AGENTS.md`를 5단계(Stage 0 세계관·의도 → Stage 1 글 3개 → Stage 2 핵심 재료 → Stage 3 상향식 조립 → Stage 4 원인 문서 역추적 수정)로 개편. CLI에 `storyboard`·`init-storyboard`·`taxonomy` 추가. 스토리보드 텍소노미 7종(`line-grid-2to1`, `hierarchy-driven-hero`, `continuity-filter-grid`, `shared-layout-transition`, `horizontal-scroll-panorama`, `time-blend-4stage`, `invariant-variant-matrix`)을 내장 용어집에 등록.
- **근거**: D-023(파일이 진실 공급원), D-022(에이전트 중립 — CLI·파일 기반 전달만), D-006(생성형 AI 배제), D-028(템플릿 동일 스키마).
- **영향**: `Technical-Design.md` §1(셸)·§4(시퀀스/신 계약 확장)·§8(스토리보드 파일 계약) 후속 개정 대상.

## D-038 플레이그라운드 static 입력 타입 위임(Bridge `input` v2.1) — Accepted (2026-10-18)

- **맥락**: 에이전트 실사용 검증 — 플레이그라운드에서 모든 키가 `다음`으로 처리되어 신 단축키(N 노트·F 전체화면)가 동작하지 않고, ←도 앞으로 넘어가며, 마지막 단계에서 엣지와 맞지 않는 클릭이 `done`을 만들어 진행이 멈출 수 있었다. 원인은 호스트가 static 신에 입력 종류와 무관한 `next()`를 보내 신의 `advance` 검사를 우회한 것이다(직접 열기는 신의 `controller.input()`이 검사하므로 정상). → [[issue-playground-scaffold-fixes]]
- **결정**:
  - Bridge v2 안에서 `input` 메시지 추가(`click` | `key:<Key>`, zod 검증). `next`/`prev`는 명시적 호스트 단계 이동(미리보기·플레이어 단계 버튼)으로 유지한다.
  - 마운트 `input` 타깃은 신 트리(마운트 컨테이너)에 합성 `click`/`keydown`을 디스패치한다. `useSteps` 창 리스너가 `advance`에 맞을 때만 진행하고, 신 자체 단축키도 같은 입력을 받는다. 단일 처리 경로라 이중 진행이 없다.
  - 매니저 static 경로는 `h.input()` 타입 위임으로 바꾸고, 플레이어 다음-단계 버튼은 명시적 `stepForward()`(`next()` 유지)로 분리한다.
  - 스텝 컨트롤러 복구: `finished` 뒤에도 마지막 스텝 규칙과 맞는 입력이면 `done`을 다시 알리고, `prev()`는 `finished`를 풀고 마지막 스텝으로 되돌린다.
  - 구 런타임 호환: `open_workspace`가 앱 소유 `vanilla/runtime` 복사본을 갱신한다(낡은 복사본은 `input`을 무시해 static 신이 멈춘 것처럼 보이므로).
- **근거**: D-032(정적 페이지는 사용자 입력으로만 진행 — 타입 위임이 `advance` 일치를 강제하므로 확장), D-023(앱 소유 복사본 갱신).
- **영향**: `Technical-Design.md` §5(Bridge v2.1 메시지) 후속 개정 대상. 프로토콜 버전은 2 유지(추가 메시지만 구 런타임이 무시).

> 2026-10-05 보강(Accepted, 사용자 승인 2026-10-05): D-030 캔버스 프리셋 16:9·9:16·1:1+사용자 지정 / D-031 전역 템플릿 디렉터리는 앱 설정 `templatesDir`로 지정(팀 공유 폴더 가능, 폴더 밖 쓰기 금지) / D-032 `static.mode: scroll|steps` 추가.

> **승인 기록(2026-10-05)**: 사용자가 `Refactor-Spec-v2.md` v0.3과 D-022~D-033을 승인했다. D-022에 따라 **D-010(에이전트 권한 정책)·D-018(에이전트 세션 격리)은 Superseded**(v2는 ACP를 쓰지 않음). D-004(HyperFrames)·D-011(시간 계약)은 `motion`·`3d` 타입으로 범위가 이어지고 export는 후속(D-027).

## D-039 신 공유 썸네일: 에이전트가 그리는 `poster.svg` — Proposed (2026-10-21)

- **제안**: 신 폴더에 `poster.svg`(16:9, 코드로 그린 SVG, `DESIGN.md` 토큰만 사용)를 두고 커밋·공유한다. 생성형 이미지/영상 AI 금지(D-006 준수). 앱은 자동 캡처(`.vanilla/thumb.png`, 로컬 전용·공유 제외)가 없을 때 `poster.svg`를 대신 표시한다. `scene.json` 스키마 변경 없음.
- **근거**: 미리보기를 한 번도 열지 않은 신은 썸네일이 비어 보인다. 에이전트가 신을 만들 때 포스터도 함께 만들면 시퀀스·신 카드가 처음부터 채워진다.

## D-040 워크스페이스 자체 빌드·발표(Standalone Play): 앱 없이 재생 — Accepted (2026-10-22)

- **맥락**: 사용자 요청 — 생성된 워크스페이스를 Vanilla Studio 없이 자체 실행·발표해야 한다. 기존에는 신별 URL(`scenes/<slug>/src/index.html`)을 브라우저에 직접 지정해야 했고 루트 `index.html`은 스텁이었다.
- **결정**:
  - `workspace-template`에 발표용 재생 화면(`play.html` + `play/`: manifest·Bridge 호스트·내비게이터·플레이어 UI)을 내장한다. 새 의존성 없음(React·Vite 기존분만).
  - 루트 `index.html`은 `play.html`로 리다이렉트하므로 `pnpm dev` 출력 URL이 바로 재생 화면이다. `pnpm play`(브라우저 자동 열기)·`pnpm preview`(dist 확인) 스크립트를 둔다.
  - `vite build`는 `play.html`과 모든 신 엔트리를 묶는 멀티 엔트리 + `base: './'`로, `dist/`가任意 정적 서버에서 동작한다.
  - 플레이어는 스튜디오 플레이그라운드와 같은 Bridge v2 프로토콜(타입 입력 위임 `input`, `step`/`done`·`choice`·`time`/`ready`)로 신과 대화하고, 시퀀스 `trigger`(`end`·`timeout`·`click`·`key`·`choice`) semantics는 시퀀스 매니저와 동일하게 따른다. 전환 연출은 컷/페이드로 단순화한다(스튜디오 전환 합성과 다름을 도움말·가이드에 명시).
  - 기존 5종 `tests/LLM_and_Vibe_Coding*` 워크스페이스에 동일 파일을 백필한다(로컬 전용·gitignore, 커밋 대상 아님).
- **근거**: D-023(파일이 진실 공급원 — 시퀀스·신 JSON을 빌드 시점에 번들), D-032(타입 입력 위임), D-038(Bridge `input` v2.1). 구 런타임(`input` 이전) 신은 클릭·키 위임이 무시되므로 `‹` `›` 단계 버튼(레거시 `next`/`prev`)으로 폴백한다.
- **영향**: `Technical-Design.md` §2.2(신 런타임 행)·§4.2(standalone play 항)·§9(템플릿 구조) 개정(v1.2). `VANILLA_GUIDE.md` §7·템플릿 `AGENTS.md`에 `play`/`preview` 문서화. 데이터 계약 변경 없음(`scene.json`·`sequence.json`·Bridge 스키마 불변).

## D-041 수업 배포용 zip·무개입 설치(plain `pnpm install`) — Accepted (2026-10-22)

- **맥락**: 배포 워크스페이스(`tests/LLM_and_Vibe_Coding_Day02_v2`)를 폴더째 압축해 다른 PC에서 `pnpm install`했더니 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`(`caniuse-lite@1.0.30001818`, 발행 3시간 전)으로 실패했다. 원인은 ① pnpm v11 기본 24시간 게이트(`minimumReleaseAge: 1440`, 수일 간격으로 갱신되는 전이 DB 패키지에 상시 노출) + 배포 PC(pnpm 10, 무검사)로 만든 lock이 신선 버전을 물고 있던 것, ② `node_modules/`·`dist/`·`.vanilla/`를 포함한 채 압축한 것. 받는 쪽 네트워크 차단 경고도 겹쳐 있었다.
- **결정**:
  - `workspace-template/pnpm-workspace.yaml`에 `minimumReleaseAge: 0`을 둔다(수업 배포 워크스페이스는 추가 플래그 없는 설치가 보안 게이트보다 우선). 직접 의존성에는 영향 없고 해결 버전의 허용 연령만 바꾼다. `open_workspace`가 기존 폴더에도 비파괴 보충한다.
  - `workspace-template/scripts/pack-workspace.mjs`(`pnpm dist`, Node 내장만·Win/Mac/Linux)를 둔다. `node_modules/`·`dist/`·`.vanilla/`·`.git/`·로그·`.env*`·심링크 제외, `pnpm-lock.yaml` 포함, `pnpm-workspace.yaml` 미존재 시 자동 생성. 직접 손으로 짠 미니 zip 라이터(deflate via `node:zlib`)라 의존성이 없다. zip 최상위 폴더는 `package.json` `name`(산출물명과 일치, `--root`로 변경 가능)이며, 스크립트명은 pnpm 내장 `pack`(tarball·`package/` 고정)과 충돌하므로 `dist`로 한다.
  - 받는 쪽 순서 고정: 압축 풀기 → `pnpm install` → `pnpm dev` (템플릿 `AGENTS.md`·`VANILLA_GUIDE.md` §8에 문서화).
- **근거**: D-023(파일이 진실 공급원 — lock 포함 배포로 재현 설치), D-012(고정 argv — 앱 소유 프로세스 변경 없음, 스크립트는 사용자 실행).
- **영향**: `Technical-Design.md` §8.2(워크스페이스 파일 표)·§9(템플릿 구조) 개정(v1.3). 데이터 계약 변경 없음(`scene.json`·`sequence.json`·Bridge 스키마 불변). 검증: 추출본 `pnpm install` 통과 + zip 엔트리 검사(금지어 0) + vitest 4건 + Rust 스캐폴드 단언. → [[issue-dist-pack-pnpm-policy]]

## D-042 배포 워크스페이스의 영문 경로 요구·가드·`dist` 개명 — Accepted (2026-10-22)

- **맥락**: D-041 후속 검증에서 2건이 더 나왔다. ① 템플릿 `package.json`에 둔 `"pack"` 스크립트는 실행되지 않는다 — `pnpm pack`은 내장 tarball 명령이라 스크립트를 가린다(확인: `package/` 고정 tarball 생성). ② 수업 PC 경로(`C:\Workspace\강의\...`)에서 `pnpm play`가 exit 3221225477로 죽는다. 이분 결과: 한글 포함 경로의 파일을 `require`·`import`하면 Node 22.13.0 자체가 세그폴트한다(사소한 파일·절대경로·파일 경유 인자 모두 재현, `fs`·`vm`·자식 프로세스 spawn은 정상). esbuild·Vite 문제가 아니라 환경/상류 문제라 코드로 우회할 수 없다.
- **결정**:
  - 배포 스크립트명을 `dist`로 개명한다(`pnpm dist`, 내장 명령과 충돌 없음 확인). zip 최상위 폴더는 `package.json` `name`(산출물명과 일치, `--root` 변경·`--flat` 해제 가능).
  - 템플릿 `package.json`의 `dev`·`play`·`preview`·`build`·`check:scene`·`vanilla` 앞에 `pnpm guard:path &&`를 둔다. 가드는 파일 로드 없는 인라인 `node -e`라 한글 경로에서도 죽지 않고 영문 경로 이전 안내 후 exit 1로 멈춘다. `dist`(pack)는 패킹 전용이라 가드를 달지 않는다(배포자는 영문 경로에서 실행).
  - 받는 쪽 순서를 "영문 경로에 압축 풀기 → `pnpm install` → `pnpm dev`"로 고정하고 템플릿 `AGENTS.md`·`VANILLA_GUIDE.md` §8에 명시한다.
- **근거**: D-023(파일이 진실 공급원), D-041(무개입 설치) 확장. `pnpm pack` 섀도잉은 pnpm 내장 명령 우선 규칙 때문이다.
- **영향**: `Technical-Design.md` 개정(v1.4). 신규 워크스페이스에만 적용되고 기존 폴더의 `package.json`은 사용자 소유라 Studio가 덮지 않는다(가이드를 보고 직접 합치기). 검증: 한글 경로 `pnpm play` 가드 메시지+exit 1 확인, 영문 경로 200 확인, vitest 6건. → [[issue-dist-pack-pnpm-policy]]

## D-043 배포 워크스페이스의 한글 경로 부분 지원(ascii-cwd 런처) — Accepted (2026-10-22)

- **맥락**: D-042는 한글 경로를 `guard:path`로 전면 차단했다. 수업 PC 경로(`C:\Workspace\강의\...`)가 고정이라 사용자가 한글 지원을 요청했다. 재측정 결과 D-042의 "한글 경로면 전부 세그폴트"는 과도한 일반화였다:
  - `require`/`import`·`fs`·자식 프로세스·ESM 엔트리 로드·junction 생성은 한글 경로에서도 정상이다.
  - 죽는 것은 Node 22.13.0 리졸버/로더 네이티브 코드가 특정 한글 음절(예 `숲`; `가`/`관`/`글`/`검`은 정상)을 포함한 경로를 밟을 때다(exit 3221225477). 로컬 파일 `require`, 네이티브 `.node` `dlopen`, pnpm 심링크·3단 체인·`exports` 맵 해결까지는 재현되지 않고, vite 그래프·zod 등 실제 패키지 로드에서 재현된다. junction·subst·`--preserve-symlinks`는 해결을 한글 실경로로 정규화하므로 vite에는 소용없다.
  - `esbuild` postinstall(`node install.js`)은 검증용이라 생략해도 플랫폼 바이너리(`@esbuild/<platform>` optional dep)가 있어 vite가 동작한다. 반대로 `allowBuilds: { esbuild: true }`로 사전 승인하면 한글 경로에서 postinstall이 죽고 `pnpm install`이 exit 1 + `.bin` 미생성 상태로 끝난다.
- **결정**:
  - `scripts/ascii-cwd.mjs`(코어 모듈만) 런처를 둔다. ASCII cwd면 그대로 실행, 비ASCII cwd(Windows)면 `node` 스크립트 명령(`check:scene`·`vanilla`·`dist`)은 `%TEMP%/vanilla-ws-<hash>` junction 별칭에서 재실행하고, `vite` 명령(`dev`·`play`·`build`·`preview`)은 영문 경로 이전 안내 후 exit 1로 멈춘다(세그폴트 대신 명확한 메시지).
  - 템플릿 `package.json`의 6종 스크립트를 `node scripts/ascii-cwd.mjs <cmd>`로 교체하고 `guard:path`를 삭제한다. `dist`는 그대로 둔다.
  - 템플릿 `pnpm-workspace.yaml`에 `allowBuilds`를 두지 않는다(생략이 곧 스킵 + exit 0; 승인 시 한글 설치가 깨진다). 받는 쪽 `pnpm approve-builds` 불필요, `Ignored build scripts` 경고는 무시해도 된다.
  - 기존 폴더의 `package.json`은 사용자 소유라 Studio가 덮지 않는다(D-042 정책 유지). `.mjs`는 open 시 보충되므로 런처 파일만 자동 배포되고, 스크립트 교체는 가이드(`VANILLA_GUIDE.md`)를 보고 직접 합치기.
- **근거**: D-023(파일이 진실 공급원), D-041(무개입 설치: 받는 쪽 `pnpm install` exit 0 확인), D-022(에이전트 중립: 런처는 고정 argv 전달뿐).
- **영향**: `Technical-Design.md` 개정(v1.5), 템플릿 `AGENTS.md`·`VANILLA_GUIDE.md` 분배 문구 개정, `workspace_commands.rs` 스캐폴드 단언(신규 `ascii-cwd.mjs` + `allowBuilds` 금지) 갱신, vitest 4건 추가/수정. 검증: 한글 경로 `pnpm install` exit 0 + `pnpm check:scene` PASS + `pnpm build` 안내 메시지 exit 1, 영문 경로 `pnpm build` 성공, vitest·cargo test 통과. → [[issue-dist-pack-pnpm-policy]], [[issue-korean-path-ascii-launcher]]

## D-044 한글 경로에서 vite 시도 후 크래시 시에만 안내 — Accepted (2026-10-22)

- **맥락**: D-043은 비ASCII cwd면 vite 명령(`dev`·`play`·`build`·`preview`)을 실행도 하지 않고 막았다. 재검증 결과 크래시는 음절별이다 — `C:\...\강의\...`에서는 `vite build`·dev 서버(`/play.html` 200)가 정상이고, `숲` 경로에서만 exit 3221225477로 죽는다. 전면 차단은 수업 PC 경로(`C:\Workspace\강의\...`)에서 멀쩡히 되는 `pnpm play`까지 막았다. D-043의 "음절 목록으로 분기하지 말고 비ASCII 전체 차단"은 목록 분기를 하지 말라는 뜻이었고, 실행 후 종료 코드로 판정하는 방식은 그 위험이 없다.
- **결정**:
  - `ascii-cwd.mjs`는 vite 명령을 비ASCII cwd에서도 그대로 실행한다. 종료 코드가 3221225477(STATUS_ACCESS_VIOLATION)일 때만 영문 경로 이전 안내를 출력하고 같은 코드로 종료한다. node 스크립트 명령은 D-043대로 junction 별칭에서 실행한다.
  - `pack-workspace.mjs`의 제외 디렉터리 `node_modules`·`.vanilla`·`.git`을 최상위뿐 아니라 어느 깊이에서든 제외한다(`.gitignore` 의미와 일치, 신별 `scenes/<slug>/.vanilla/` 썸네일이 zip에 섞이던 문제 해결). `dist`는 루트 빌드 산출물만 제외한다.
  - `ascii-cwd.mjs`·`pack-workspace.mjs`의 직접 실행 판정을 `realpath` 비교로 바꿔 심링크 실행 시 조용히 exit 0 하지 않게 한다.
  - 받는 쪽 안내를 `pnpm install` → `pnpm play`로 통일한다(`AGENTS.md`·`VANILLA_GUIDE.md` §8·pack 완료 메시지).
- **근거**: D-043 측정(음절 의존 크래시), D-041(무개입 설치).
- **영향**: `Technical-Design.md` 개정(v1.6), 템플릿 `AGENTS.md`·`VANILLA_GUIDE.md` 문구 개정. 데이터 계약 변경 없음. 검증: `강의` 경로 `pnpm build` exit 0, `숲` 경로 안내 메시지 + exit 3221225477, zip에 중첩 `.vanilla` 0건(464→434 파일), vitest 31건. → [[issue-korean-path-ascii-launcher]]

## D-045 워크스페이스 히스토리 일원화 기록·zip 압축/불러오기 — Accepted (2026-10-22)

- **맥락**: 워크스페이스 A→B를 열어도 히스토리가 비어 보였다. 히스토리(`workspaces` 테이블) 기록(`touchWorkspace`)이 온보딩 경로에만 있어 워크스페이스 화면 카드·폴더 열기·전환 팝업으로 연 워크스페이스는 기록되지 않았다. 또 앱에서 워크스페이스를 폴더째 압축/복원할 방법이 없었다(`pnpm dist`는 CLI 전용, `.vsx`는 신·시퀀스 공유용).
- **결정**:
  - 기록은 `WorkspaceContext`가 `workspaceRoot` 확정 시 한 곳에서 한다(`inspect_workspace_folder` 결과로 `touchWorkspace`). 현재 워크스페이스 카드에는 "현재" 배지를 붙인다(워크스페이스 화면·전환 팝업).
  - Rust `workspace_archive.rs`: `pack_workspace_zip`(`pnpm dist`와 같은 제외 규칙·최상위 폴더 = `package.json` `name`·`pnpm-workspace.yaml` 없으면 항목으로만 추가)·`unpack_workspace_zip`(zip-slip·절대 경로·심링크·암호화 거부, 빈 폴더에만 풀기, 덮어쓰기 금지, `workspace.json` 검증, 실패 시 만든 것만 정리). 최상위 폴더가 있으면 벗겨 낸다.
  - UI: 워크스페이스 화면 헤더(압축/불러오기)와 온보딩(불러오기). 불러온 폴더는 신뢰 자동 부여 없이 열어 신뢰 확인을 받는다. `pnpm install`은 자동 실행하지 않는다(외부 파일의 lifecycle 스크립트).
- **영향**: 데이터 계약 변경 없음. `Technical-Design.md` 개정(v1.7). 검증: vitest(기록·배지), `cargo test workspace_archive` 4건(제외 규칙·왕복·거부·flat zip). → [[issue-workspace-history-archive]]

## D-046 템플릿(프로젝트 뼈대)과 스타일(시각 어휘) 분리 — Accepted (2026-11-01)

- **맥락**: 기존 "템플릿"은 신 단위 가이드라 프로젝트 전체의 컨셉·스토리보드를 잡는 수단이 없었고, 사용자가 고를 시각 어휘도 부족했다. 사용자가 두 기능의 분리와 스타일 태그 200종 활용을 요청했다.
- **결정**:
  - **템플릿**은 프로젝트 전체 뼈대다. `resources/project-templates/catalog.json`(8종)에서 고르면 앱이 `storyboard/00-project-template.md`를 쓰고 `storyboard.json.visualDirection.projectTemplate`에 참조를 남긴다. 3대 문서와 신은 건드리지 않으며, 슬롯을 신으로 옮기는 일은 에이전트가 한다(D-022).
  - **스타일**은 신·이미지·모션의 시각 어휘다. `scene.json.styles: [{ id, scope }]`(선택 필드, `scene|image|motion`)에 기록하고, 키워드·예시·코드 구현 기법이 신 `AGENTS.md` `styles` 마커에 렌더된다. 에이전트 되쓰기 허용 필드에 포함한다.
  - 원본은 `resources/workspace-template/STYLE_LIBRARY.json` 하나다. 앱 소유 생성물이라 워크스페이스를 열 때 갱신한다. 렌더러는 `scripts/style-core.mjs`를 앱과 CLI가 공유한다. 기존 신은 `styles` 키가 없으므로 바이트·해시가 유지된다.
  - 기존 가이드·세부 프리셋·레시피·팔레트·기법은 사이드바 템플릿 화면의 "스타일" 영역 아래로 옮긴다. 신 스키마의 `template` 필드 이름은 호환을 위해 유지한다.
  - 태그 목록은 어휘 색인으로만 쓰고 설명·키워드·예시는 새로 작성한다. 상표·저작물을 가리키는 9개 태그는 중립 id·라벨로 바꾸고 `ipSensitive`로 표시해, 에이전트에게 기존 캐릭터·로고·상품 형태 금지를 지시한다. `sourceTag`로 원본 태그는 추적한다.
- **근거**: D-006(생성형 AI 배제 — 스타일은 코드로 구현), D-022(에이전트 중립), D-023(파일이 진실 공급원), D-031(가이드 템플릿).
- **영향**: 데이터 계약 추가(`scene.json.styles`, `storyboard.json.visualDirection.projectTemplate`, `STYLE_LIBRARY.json`). `Technical-Design.md` v1.8. 앞으로 "템플릿"은 프로젝트 뼈대, 신 단위 템플릿은 "신 가이드"로 부른다. → [[research-2026-11-01-style-tags]]

## D-047 예제 라이브러리: 코드 예제 + 캡처 미리보기 — Accepted (2026-11-01)

- **맥락**: 스타일 200종과 프로젝트 템플릿 8종은 글로만 표시되고, 기법·팔레트도 대부분 미리보기가 없다. 나머지 카드의 미리보기는 외부 이미지라 오프라인에서 보이지 않는다. 다른 에이전트로 대량 제작할 수 있는 구조가 필요하다.
- **결정**:
  - 예제는 `resources/examples/<kind>/<id>/`의 자체 완결 HTML(`example.html`), 메타(`example.json`), 캡처 이미지(`preview.webp`)다. 폴더를 추가하면 등록 없이 카드에 나타난다. 로컬 예제가 있으면 외부 `previewUrl`보다 우선한다.
  - 앱은 `example.html`을 실행하지 않고 `preview.webp`와 소스 보기만 제공한다. srcdoc 프레임은 앱 CSP를 상속하고, Tauri가 CSP에 nonce를 넣으면 `unsafe-inline`이 무시되어 배포판에서 동작이 달라질 수 있기 때문이다. CSP를 넓히지 않는다.
  - 움직이는 예제는 8프레임 필름스트립 한 장으로 캡처해 CSS `steps()`로 재생한다(호버·확대 보기).
  - 제작·검사는 `pnpm examples`(new·capture·check·backlog·status)로 한다. 외부 리소스·비결정 입력·GSAP·상표명을 금지하고, 캡처 때 네트워크 요청 차단과 프레임 변화·결정성을 확인한다.
  - 일감은 `Examples-Backlog.md`로 생성하며 배치별 소유 폴더가 겹치지 않아 병렬 작업에 공유 파일이 없다.
- **근거**: D-006(생성형 AI 배제), D-007(GSAP 미사용), D-011·D-024(시간 함수 결정성), AGENTS.md §7(외부 콘텐츠 격리).
- **영향**: 데이터 계약 추가 없음(앱 내장 자료). 이미지는 Vite 번들에 포함되어 예제 473개 기준 약 12MB 늘어날 전망이다. 워크스페이스로 복사하지 않으므로 에이전트 참조용 제공은 별도 항목(TE.7)이다. `Technical-Design.md` v1.9. → [[research-2026-11-01-style-tags]]

## D-048 예제 소스의 워크스페이스 복사 제공 — Accepted (2026-11-01)

- **맥락**: D-047 예제(`example.html`)는 앱 번들 안에만 있어 cwd 범위로 일하는 에이전트(D-029)가 읽을 수 없다. TE.7에서 전달 방식을 결정해야 했다.
- **결정**:
  - 신에 `styles`·`template`(프로젝트 템플릿 참조)이 있으면, 해당 `example.html`만 워크스페이스 `references/examples/<kind>-<id>.html`로 복사한다. 복사는 신 생성·스타일 변경·프롬프트 조립 시점에 앱이 수행하고, 덮어쓰기 전에 확인한다.
  - 프롬프트 조립(`generate`·`revise` 클립보드)에는 복사된 상대 경로 한 줄만 추가하고 소스 전문은 넣지 않는다(프롬프트 비대화 방지).
  - 복사된 파일은 **참조용 읽기 전용**이다. 에이전트 되쓰기 화이트리스트에 포함하지 않고, 복제·삽입이 아닌 스타일 분석·구현 참고용으로만 쓴다(D-006, D-026의 레퍼런스 취급 준용).
  - `preview.webp`는 복사하지 않는다(용량). 필요하면 앱 카드에서 본다.
- **근거**: D-022(에이전트 중립 — 파일 복사는 CLI 종류와 무관), D-023(파일이 진실 공급원), D-029(에이전트 작업 범위는 cwd 아래).
- **영향**: 구현은 E 범위를 벗어나므로 후속 항목에서 다룬다(신 파일 감시·가이드 재렌더·프롬프트 조립 변경). `example.html` ≤32KB라 신당 수십 KB 수준이다.
