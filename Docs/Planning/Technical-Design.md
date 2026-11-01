# Vanilla Studio 기술 설계서 (Technical Design)

- 문서 버전: **v1.8 (템플릿·스타일 분리, 2026-11-01)** — D-046 반영. 프로젝트 템플릿은 `storyboard/00-project-template.md`를 생성하고, 스타일은 `scene.json.styles`와 `STYLE_LIBRARY.json`(렌더러 `scripts/style-core.mjs`, 앱·CLI 공용)으로 전달한다. v1.7(D-045)은 git 이력에 있다.
- 선행 문서: `Docs/Planning/Refactor-Spec-v2.md`(무엇을 만드는가), `Docs/Planning/Decisions.md`(D-022~D-033)
- 템플릿 공통 아키텍처(`Docs/Architecture.md`)는 **템플릿 원본으로 유지**하고, 이 문서가 Vanilla Studio 고유 설계의 진실 공급원이다. 충돌 시 이 문서가 우선한다.
- ⚠️ 표시 항목은 PoC(`Feasibility-Risks.md`)로 확정해야 하는 가정이다.
- **보존 영역**: §4 런타임·디자인 토큰, §5 Bridge, §2.2~2.4 일부는 v1에서 PoC(S1~S7)로 검증된 내용이며 v2에서도 유효하다. v1 전용(ACP 호스트·파이프라인·검수 스튜디오·MCP)은 제거 대상이고(§11 "기존 코드 처리"), export는 후속(§7) 보존이다.

---

## 1. 시스템 구성

```
┌────────────────────────── Vanilla Studio v2 (Tauri 2 앱) ──────────────────────────┐
│  WebView (React 19 UI)                                                              │
│   ├ 사이드바(시퀀스·신·템플릿·플레이그라운드·설정[하단]) · 시퀀스 캔버스(@xyflow/react, 코멘트 오버레이) │
│   ├ 신 화면(신 목록 · 미리보기/계약 검사 · 코멘트 · 플로팅 인스펙터/터미널)      │
│   ├ 템플릿(가이드·팔레트·구성 기법) · Playground (신 갤러리 + 시퀀스 재생기)      │
│   └ <iframe sandbox src="http://127.0.0.1:<port>/<sceneId>/">  ← 신 미리보기         │
│            ▲ postMessage (Vanilla Bridge §5)                                        │
│  ─────────────── invoke / Channel ───────────────                                   │
│  Rust Core                                                                          │
│   ├ workspace_commands : 워크스페이스·신 스캐폴딩, 파일 읽기/쓰기(스코프 강제), 감시    │
│   ├ pty_host           : portable-pty (에이전트 CLI 실행, 고정 argv 레지스트리)        │
│   ├ process_mgr        : 앱 소유 프로세스(프리뷰 서버·pnpm install·ffmpeg) 고정 argv   │
│   ├ package_commands   : .vsx 패키지 만들기/풀기(zip, 해시 매니페스트)                  │
│   ├ doctor             : 의존성 점검·FFmpeg 다운로드(레퍼런스 키프레임용)              │
│   └ db                 : SQLite 전역(최근 워크스페이스·설정·터미널 세션)                 │
└────────┬───────────────────────────────────────┬───────────────────────────────────┘
         │ PTY (cwd = 신 폴더)                    │ spawn (Node 22+)
   ┌─────▼──────┐                         ┌───────▼─────────────────┐
   │ Agent CLI  │  ← 파일(AGENTS.md 등)    │ Vite dev server (1개)   │
   │ claude/... │     로 지침 인식          │ 워크스페이스 루트 서빙   │
   └────────────┘                         └─────────────────────────┘
```

**설계 원칙**

1. **앱은 에이전트를 조종하지 않는다.** 앱은 지침 파일·프롬프트를 만들고 에이전트 CLI를 PTY로 띄울 뿐이다. 권한·셸 확인은 에이전트 CLI 자체에 맡긴다(D-022).
2. **파일이 진실 공급원.** 워크스페이스·신·시퀀스 내용은 모두 파일(`scene.json` 등). DB는 앱 상태(최근 목록·UI·터미널)만 담는다(D-023).
3. **생성물과 사용자 소유물을 분리.** `GUIDE.md`·`AGENTS.md`·`prompts/*`는 앱이 `scene.json`에서 렌더하는 생성물, `src/`·`params/`·`analysis/`는 에이전트·사용자 소유라 앱이 덮어쓰지 않는다.
4. **하나의 Scene 런타임, 여러 신 타입.** 모션·3D는 시간 함수 계약(clock), 정적은 자유 모드(D-024).
5. **보안 경계는 Rust에 둔다.** 파일 명령은 워크스페이스 스코프 밖을 거부, 앱 소유 프로세스·에이전트 실행은 고정 argv(D-012).
6. **에이전트 중립.** 차이는 `src/lib/agents/` 레지스트리가 흡수한다.

---

## 2. 기술 스택

### 2.1 앱

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 셸 | Tauri 2 (Rust), Windows 우선 | 템플릿 |
| UI | React 19, TS strict, Vite 7, shadcn/ui, Tailwind 3, lucide-react, react-resizable-panels | 템플릿 |
| 캔버스 | `@xyflow/react`(MIT) | ComfyUI형 노드 그래프. PoC R-5 통과(`wiki/sources/poc-r5.md`: 100노드 60fps) |
| 편집기 | CodeMirror 6 | 프롬프트·마크다운 보기/편집 |
| 상태 | React Context per concern | 전역 스토어 금지 |
| 저장소 | SQLite (`tauri-plugin-sql`) | 앱 상태 전용 |
| 검증 | zod | `workspace.json`·`scene.json`·`sequence.json`·`template.json`·`references.json`·`manifest.json` |
| 터미널 | Rust `portable-pty` + `@xterm/xterm` | v1 자산 재사용 |
| 패키지 | `zip` crate, SHA-256 | `.vsx` 공유 패키지 |
| DESIGN.md | `yaml` + 자체 zod (`src/lib/design`) | v1 자산 재사용. `extends` 상속·분석 마커 구간 추가(§4.5) |
| 색 계산 | `culori` | v1 자산 재사용 |
| 다운로드 | `reqwest` | FFmpeg(키프레임 추출용) |

**제거 대상**: Rust `agent-client-protocol`, `rmcp`·`axum`(MCP 서버), ACP 어댑터 설치. 로컬 HTTP는 프리뷰 서버(Vite, `vite-runner`) 하나다. 플레이그라운드도 같은 서버를 쓰므로 별도 정적 서버(`tiny_http` 등)는 두지 않는다(V6 확정, T6.7). 빌드 산출물을 정적으로 서빙하는 일은 공유 패키지(.vsx) 재생(V7)에서 다시 판단한다.

### 2.2 신(생성물) 런타임 — 앱이 워크스페이스에 설치

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 빌드/프리뷰 | Vite + React 19 + TypeScript | 워크스페이스 루트에서 신별 엔트리(`scenes/<slug>/src/index.html`)를 멀티 엔트리로 서빙. HMR로 에이전트 수정 즉시 반영. `vite build`는 발표 화면(`play.html`)과 모든 신 엔트리를 묶어 `dist/`가 어떤 정적 서버에서 동작(`base: './'`, D-040) |
| 발표 화면 | `play.html` + `play/`(매니페스트·Bridge 호스트·내비게이터·플레이어 UI, 의존성 추가 없음) | 스튜디오 없이 시퀀스 재생·발표. 루트(`/`)·`pnpm dev` URL이 여기로 리다이렉트. Bridge v2 프로토콜로 신과 대화, 전환은 컷/페이드로 단순화(§4.2.2) |
| 3D | three.js + `@react-three/fiber` + `@react-three/drei` | `frameloop="demand"` 강제(결정성) |
| 2D | SVG·Canvas·CSS, 선택: `motion`(MIT), `animejs` v4(MIT) | 시간 함수형 사용 |
| GSAP | **선택적**(생성 코드 내에서만, paused timeline + seek) | 표준 라이선스 제약(D-007) — 앱 기능은 GSAP 비의존 |
| 셰이더 | GLSL(three `ShaderMaterial`) | 절차적 텍스처·배경 |
| 폰트 | `@fontsource/*`(OFL) 로컬 번들 | 오프라인·결정성 |
| 런타임 계약 | `@vanilla/runtime` (앱 번들, `vanilla/runtime/`에 설치) | §4 |
| 디자인 토큰 | `@vanilla/runtime/vite` 플러그인이 `DESIGN.md`를 가상 모듈로 제공 | §4.4 |

### 2.3 Export 워커 (`vanilla-export`) — **v2.0 범위 밖, 코드 보존(D-027)**

> v2.0에서는 앱에서 호출하지 않는다. 신·시퀀스 구조에 맞춘 재연결은 후속 마일스톤이다. 아래 표는 v1 검증 결과를 보존한 것이다.

| 기능 | 선택 | 비고 |
| --- | --- | --- |
| 동영상 | HyperFrames CLI (Apache-2.0, 0.8.82에서 검증) | D-004. Chrome + FFmpeg. 루트 `data-no-timeline`, 환경 변수 `DO_NOT_TRACK=1`·`HYPERFRAMES_SKIP_SKILLS=1`·`HYPERFRAMES_FFMPEG_PATH`·`HYPERFRAMES_FFPROBE_PATH`, `--workers`는 메모리 기준(S1) |
| 스틸 캡처 | `puppeteer-core` + HyperFrames가 관리하는 `chrome-headless-shell` (S2 확정) | `deviceScaleFactor`로 @1x/@2x, 준비 신호 대기 후 캡처. HyperFrames `snapshot`은 전체 @2x 미지원 + Gemini 자동 분석 위험(`--describe false` 필수) |
| PPTX(이미지) | `pptxgenjs` (MIT) | 슬라이드 PNG를 전면 배치 |
| PPTX(편집) | `dom-to-pptx` 2.1.2 (MIT) Beta — **브라우저 번들(`dist/dom-to-pptx.bundle.js`, 3.6MB)만 벤더링** | npm 패키지는 puppeteer 전체를 끌어오므로 쓰지 않음. 변환 후 `wrap="none"` 후처리 필수 (S5) |
| PDF | `pdf-lib`로 캡처 이미지를 16:9 페이지에 배치 (S2 확인) | 이미지 기반 |
| 정적 사이트 | `vite build` + zip | |
| DESIGN.md lint | `@google/design.md` CLI (Apache-2.0, alpha) ⚠️ | 구조·대비 검사. 형식 변경에 대비해 버전 고정, 실패 시 자체 zod 검사만 사용 |

### 2.4 외부 의존성 (Doctor가 점검)

| 의존성 | 필수 여부 | 설치 방식 |
| --- | --- | --- |
| WebView2 Runtime | 필수(앱 실행) | 레지스트리 `EdgeUpdate\Clients\{F3017226-…}`의 `pv`로 확인. 인스톨러가 부트스트래퍼 포함 (S6) |
| Node.js 22+ | 필수 | `node --version` 메이저 ≥ 22. 없으면 `winget install OpenJS.NodeJS.LTS` 안내 |
| pnpm | 필수 | `pnpm.cmd` shim 해석. 없으면 `corepack enable pnpm` 안내 |
| git | 권장(분석 반영 되돌리기·변경 이력) | 사용자 설치 안내, 없으면 `.vanilla/history/` 파일 스냅샷 |
| 에이전트 CLI(1개 이상) | 생성 실행 시 필수 | 각 공식 설치 안내. 앱은 PATH에서 실행 파일 존재만 확인(로그인 상태는 읽지 않음) |
| FFmpeg | 레퍼런스 영상 키프레임 추출 시(export는 후속) | 앱이 사용자 동의 후 다운로드해 앱 데이터에 저장, 경로는 환경 변수로 전달. MP4(H.264)는 libx264가 있는 **GPL 빌드** 필요(S1). 시스템 PATH의 FFmpeg는 버전이 낮을 수 있어 신뢰하지 않음 |
| Chrome/Chromium | export·썸네일 캡처 시 | HyperFrames가 관리하는 `chrome-headless-shell`(`hyperframes browser`) — S1 확인 |

**Doctor 구현 규칙 (S6)**

- 명령 해석: cmd.exe와 같이 PATH 순서 × `.exe/.cmd/.bat/.com`으로 찾는다. `.ps1`은 건너뛴다.
- 실행 조건: stdin 닫힘, `CREATE_NO_WINDOW`, 15~20초 타임아웃.
- **재점검 시 PATH를 레지스트리에서 새로 읽는다**(HKLM/HKCU `Environment`의 `Path`, `%VAR%` 확장). 앱 실행 중 설치한 도구를 인식하기 위해서다. 이 PATH는 앱이 띄우는 모든 자식 프로세스에도 전달한다.
- FFmpeg 판정: `-encoders`에 `libx264`가 있어야 하고, `-colorspace bt709` 인코딩 시험을 통과해야 한다. PATH의 FFmpeg보다 앱 관리본을 우선한다.
- **FFmpeg 다운로드**: 다음 순서로 진행한다(약 190MB, 23초).
  1. BtbN GitHub 릴리스 API로 win64 GPL zip을 고른다(**검증된 메이저 계열로 고정**).
  2. `checksums.sha256`로 SHA-256을 검증한다.
  3. `ffmpeg.exe`·`ffprobe.exe`·`LICENSE.txt`만 앱 데이터 `tools/ffmpeg/`에 추출한다.
  4. 받은 자산 이름·해시를 기록하고 사후 점검한다.
  - FFmpeg 버전이 바뀌면 출력 바이트가 바뀌므로, 골든 테스트는 FFmpeg 버전까지 고정한다.
---

## 3. 에이전트 실행 (터미널 + 클립보드, D-022)

### 3.1 에이전트 레지스트리 (`src/lib/agents/`)

ACP·세션 격리 설정을 없애고 다음 형태로 축소한다. 전역 DB `agents` 설정으로 사용자가 편집할 수 있고 기본값은 앱 내장이다.

```ts
type AgentEntry = {
  id: 'claude-code' | 'codex' | 'opencode' | 'hermes' | 'agy' | string;
  label: string;
  argv: string[];            // 고정 argv. UI에서 임의 명령 문자열을 받지 않는다
  instructionFile: 'CLAUDE.md' | 'AGENTS.md';   // 에이전트가 읽는 지침 파일(둘 다 생성, CLAUDE.md는 @AGENTS.md)
  detect: { exe: string };   // PATH 존재 확인
  pasteMode: 'clipboard' | 'bracketed-paste';   // 자동 붙여넣기 옵션용
};
```

- `argv`는 Rust 명령에서 enum/레지스트리 키로만 받는다. 사용자가 레지스트리를 편집해도 **설정 화면에서만** 가능하고 확인 다이얼로그를 거친다(D-012).
- 특정 에이전트 전용 기능을 핵심 경로에 넣지 않는다(AGENTS.md §4-4).

### 3.2 실행 흐름

```
UI [에이전트 실행]            Rust pty_host                      Agent CLI
 │ run_agent(sceneId, agentId, task) ─▶ 신 폴더 canonicalize·스코프 검사
 │                              ─▶ spawn(argv, cwd=scenes/<slug>)      ─▶ (AGENTS.md·GUIDE.md 자동 인식)
 │ ◀ 클립보드 복사(generate.md 조립본) + 토스트 "Ctrl+V"
 │ ◀ PTY 바이트 스트림 ◀── xterm 표시 ◀────────────────────────────────
 │ (선택) auto-paste: 에이전트 준비 감지 후 bracketed paste
 └ 파일 감시 이벤트 → 신 상태·썸네일 갱신
```

- **task** 종류: `generate`(신 생성/수정), `analyze-reference`, `revise`(사용자 프롬프트 변경분). 각각 `prompts/<task>.md`를 클립보드로 보낸다.
- 신뢰 확인: 신뢰하지 않은 워크스페이스 폴더에서는 에이전트를 시작하지 않는다(AGENTS.md §7).
- 실행 중 터미널 세션 메타(에이전트·신·시작 시각)는 전역 DB `terminal_sessions`에 기록한다. PTY 출력 로그는 `scenes/<slug>/.vanilla/sessions/`(공유 제외).
- 에이전트 종료·완료 판정: 프로세스 종료 또는 사용자 "완료" 버튼. 완료 시 `scene.json` zod 검증 + 엔트리 존재 확인 → 상태 `generated` 또는 `needs-revision`.

### 3.3 프롬프트 조립 규칙

클립보드 프롬프트 = `[workspace: <name> / scene: <name>]` 헤더 + 한 줄 지시 + 사용자 프롬프트 + 되쓰기 허용 필드 요약. 규칙 본문은 복사하지 않고 **`AGENTS.md`·`GUIDE.md` 파일을 읽게** 한다(컨텍스트 절약·에이전트 중립). 프롬프트 템플릿 원문은 가이드 템플릿(`prompts/*.md`)에 영문으로 두고 번역하지 않는다. 출력 언어 지시는 `scene.json.brief.language`에서 삽입한다.

### 3.4 가이드 엔진 (`src/lib/guides/`)

```
guide template(schema·glossary·rules·prompts·checklist) + scene.json
   └─▶ render: GUIDE.md · 신 AGENTS.md · prompts/{generate,analyze-reference,revise}.md   (마커 구간만 갱신)
   └─▶ UI: schema → 인스펙터 폼, glossary → 콤보박스
```

- 렌더는 **순수 함수**(`renderGuide(scene, template) → Record<path, string>`)이고 같은 입력 → 같은 바이트(정규화, 공유·diff 용이).
- 마커 규약: `<!-- vanilla:begin:<id> --> … <!-- vanilla:end:<id> -->` 안만 앱이 쓴다. 마커 밖(사용자·에이전트 추가분)은 보존한다. `GUIDE.md`는 전체가 생성물이며 헤더에 `scene.json` 해시를 둔다.
- 템플릿 해석 순서: 워크스페이스 `guide-templates/` > 설정 `templatesDir` > 내장 `resources/guides/`. 템플릿 `schema.json`은 내장 스키마의 확장만 허용(필드 추가·숨김·기본값)하고 zod로 검증한다(D-031).
- 되쓰기 검증: 에이전트 종료·파일 변경 후 `scene.json`을 zod로 검증하고, 에이전트가 쓸 수 있는 필드 화이트리스트(`AGENTS.md`에 명시) 밖이 바뀌었으면 경고한다. 변경은 `.vanilla/history/`에 스냅샷하고 diff로 사용자 승인/되돌림.

## 4. Scene 런타임 (`@vanilla/runtime`) — 보존·확장

### 4.1 API

```ts
// 등록
export default defineScene({
  id: 's1-intro',
  duration: 4,                       // video: 초, slides/image: 생략
  params: {
    bgColor: param.color('#F5E6C8', { label: '배경색' }),
    speed:   param.number(1, { min: 0.2, max: 3, step: 0.1 }),
    title:   param.text('Hello'),
  },
  Component: IntroScene,
});

// 사용
function IntroScene() {
  const t = useTime();                 // 현재 Scene 로컬 시간(초)
  const { bgColor, speed, title } = useParams<typeof params>();
  const p = ease.expoOut(clamp01((t * speed - 0.5) / 1.5));
  ...
}
```

- `useTime()`: 모드에 따라 시간 공급원이 다르다.

  | 모드 | 시간 공급원 | 용도 |
  | --- | --- | --- |
  | `preview` | 호스트(Bridge)의 play/pause/seek | 검수 스튜디오 |
  | `render` | HyperFrames seek 이벤트(`hf-seek`, `waitUntil`) — S1 확인 | 동영상·스틸 export |
  | `live` | 실시간 rAF 시계 | 웹/인터랙티브 미리보기와 최종 배포본 |

  타입별 시간 모드(D-011·D-024): `motion`과 `3d`는 **clock 계약**(preview·render 모드, `t`의 순수 함수; 3D는 시드 고정·시간 구동 카메라). `static`은 **free 모드**(`live`)로 자체 rAF를 허용하고 Bridge `seek`는 무시한다. v1 유형 매핑: video·image→`motion`, slides·web→`static`, interactive→`static`/`3d`.

- R3F: `<VanillaCanvas>`가 Canvas를 감싼다. render 모드는 `frameloop="never"` + `advance(t)`로 동기 렌더, preview는 `demand` + `invalidate()` (S1).
- **render 모드 시간 주입(S1 확정)**: `hf-seek` 리스너에서 `waitUntil(sceneReady.then(() => setTime(t)))`를 동기로 호출한다. `setTime`은 React DOM을 `flushSync`로 커밋하고 R3F를 `advance`로 그린다. `sceneReady` = 모든 Canvas `onCreated` + `document.fonts.ready` + 에셋(텍스처·HDRI) 로딩. 준비 전에 시각을 적용하면 워커 첫 프레임이 달라진다(`wiki/sources/poc-s1.md`).
- 결정성 도우미: `useSeededRandom(seed)`, `noise2D/3D`(시드 고정), `ease.*`, `timeline([...keys])`(키 기반 보간).
- **준비 신호(S1·S2)**: `registerAsset(promise)`로 텍스처·HDRI·모델 로딩을 등록한다. 런타임은 다음 순서로 기다린 뒤 준비를 선언한다.
  1. 모든 Canvas `onCreated` + 등록된 에셋 + `DESIGN.md` typography 폰트의 `document.fonts.load()` 완료
  2. 시각 적용 후 2프레임 페인트
  3. `window.__vanillaReady = true` 설정(스틸), `hf-seek`의 `waitUntil` 해제(영상)
  - `document.fonts.ready`만으로는 늦게 요청되는 웹 폰트를 놓친다(S2 대조 실험).
- 입력: `useInput()` → 포인터·키·스크롤·자이로. `render` 모드에서는 고정값.
- 디자인 토큰: `useDesign()` → `{ colors, typography, spacing, rounded }`(§4.4). CSS에서는 `var(--color-<role>)`.
  `param.color(token('accent'))`처럼 파라미터 기본값에 토큰을 참조할 수 있다.
- GSAP 사용 시: `useGsapTimeline(tl)`이 paused timeline을 `t`에 맞춰 `seek` (선택적 헬퍼, gsap은 프로젝트 의존성으로만).

### 4.2 신 단위 구성과 시퀀스

- **신 내부**: `scenes/<slug>/src/index.html`이 엔트리이고, `scene.json.beats[]`가 시간 구조(motion·3d), `steps[]`가 사용자 입력 장면 전환(`static.mode=steps`, §5.1)이다. 화면비·해상도·fps는 `workspace.json.canvas`에서 주입한다(D-030).
- **신 사이**: 신은 다른 신을 알지 못한다. 전환·분기는 `sequence.json`을 해석하는 **시퀀스 매니저**(Playground 호스트, §5.2)가 맡는다.

#### 4.2.1 시퀀스 재생 (V6)

- **구조**: `src/lib/sequence/manager.ts`(상태 머신)는 신을 `SceneHandle`로, 전환 재생을 `TransitionRunner`로 주입받는다. 브라우저 구현은 `src/lib/playground/iframeScene.ts`(신 iframe + Bridge v2)와 `sceneTransitions.ts`다. 검증(`validate.ts`)이 통과해야 재생한다.
- **trigger**: `end`(motion·3d가 끝 시각 도달 — 런타임은 끝에서 멈출 뿐 `done`을 보내지 않으므로 호스트가 `time`과 `ready.duration`을 비교해 판단), `timeout:Ns`(일시정지하면 타이머도 멈춤), `click`·`key:K`(static 신은 타입 입력으로 위임해 `advance`와 맞을 때만 진행, D-038), `choice:<label>`(신 UI의 `choice` 또는 호스트 선택지).
- **검증 규칙**(`validate.ts`): static 신에서 나가는 `end`·`timeout` 금지, 같은 신에서 같은 trigger 두 개 금지, 자동 엣지만으로 된 순환 금지(입력 엣지가 낀 순환은 허용), linear는 신당 나가는 엣지 1개·`choice` 금지, 시작 신 필수·도달 불가 신은 경고, 알 수 없는 전환 금지.
- **전환 합성(PoC R-1, `wiki/sources/poc-r1.md`)**: 두 신을 별도 origin iframe으로 겹쳐 두고 나가는 신 iframe 요소에 Web Animations를 건다(`cut`·`crossfade`·`slide-left/right/up/down`·`mask-wipe`·`circular-reveal`·`zoom-through`). 다음 신은 이웃 프리로드로 미리 로드하며, **숨긴 신은 `visibility:hidden`이 아니라 맨 아래 투명 층(opacity 0)** 에 둔다(보이지 않는 cross-origin iframe은 Chrome이 렌더를 멈춰 `ready`가 오지 않는다). `match-cut`은 v2.0에서 제외, `custom`은 코드가 아니라 선언형 `transitions/<name>.json`(속성·값 화이트리스트)이다.
- **입력**: 투명한 입력 레이어가 iframe 위를 덮어 클릭을 받고 키는 창 전체에서 받는다(신 안의 버튼은 재생 중 누를 수 없고 분기는 호스트 선택지로 고른다).
- **측정**(헤드리스 Chrome, 샘플 시퀀스, `pnpm test:e2e:sequence`): 시작 신 콜드 로드 1.23s, 비이웃 신 점프 0.13s, 프리로드 이웃 전환은 설정값 + 10~120ms.

#### 4.2.2 Standalone play (D-040)

워크스페이스는 앱 없이 자체 빌드·발표할 수 있다. 발표 화면(`play.html` + `play/`)은
`workspace.json`·`sequence.json`·`scenes/*/scene.json`을 빌드 시점에 번들한 뒤(Bridge v2 호스트 +
내비게이터로) 한 번에 한 신씩 iframe에 띄운다. 입력 레이어가 클릭·키를 받아 타입 입력(`input`)으로
위임하므로 `static` 신은 `advance` 규칙대로만 진행하고, 마지막 단계 입력이 시퀀스 엣지 `trigger`를
평가한다. `choice` 엣지는 화면 아래 선택지로 고른다. 전환 합성(§4.2.1, 두 iframe 오버레이 + WAAPI)은
포함하지 않고 컷/페이드로 단순화한다. 스크립트: `pnpm dev`(루트가 `play.html`로 리다이렉트) ·
`pnpm play` · `pnpm build`(멀티 엔트리) · `pnpm preview`.

### 4.3 계약 검사 (`check_scene`)

정적 검사(ESLint 커스텀 룰 + AST) + 동적 검사(같은 `t`를 두 번 렌더해 픽셀 비교). 시간 관련 규칙과 동적 검사는 clock 계약 타입(`motion`·`3d`)에만 적용한다. v2에서는 에이전트가 직접 호출하는 MCP 도구가 없으므로 신 폴더 스크립트(`pnpm check:scene`)와 앱 [검사] 버튼으로 실행하고, 결과를 `.vanilla/self-check.md`에 쓴다:
- 금지 API: `Date.now`, `performance.now`, 시드 없는 `Math.random`, 자체 `requestAnimationFrame` 루프, `setInterval`
- `defineScene` 누락, 선언되지 않은 파라미터 사용, 외부 URL 리소스 참조(CREDITS 없는 경우)
- 하드코딩 색상(경고): TSX·CSS의 hex/rgb/hsl 리터럴 중 토큰이 아닌 것. 셰이더 상수·투명도 등 예외는 주석 `// ds-ignore`로 표시

### 4.4 디자인 토큰 파이프라인 (D-015, D-016)

```
DESIGN.md ──(Vite 플러그인 @vanilla/runtime/vite: front matter 파싱, 토큰 참조 해석)──▶ virtual:vanilla/design
   │ 파일 변경 → HMR                                                                   │
   │                                                  ┌────────────────────────────────┤
   │                                                  ▼                                ▼
   │                                  :root { --color-canvas: …; --color-accent: … }   useDesign() (JS 값)
   │                                                  ▲                                ▲
Bridge setDesign { colors } ─────────── 미리보기 전용 오버라이드(파일 변경 없음) ──────┘
```

- **읽기**(S7 확인): 런타임의 Vite 플러그인이 빌드·프리뷰 시 `DESIGN.md`를 파싱해 가상 모듈 `virtual:vanilla/design`으로 제공한다.
  - 생성 파일(`tokens.css` 등)을 두지 않으므로 에이전트가 잘못 수정할 대상이 없고, export 빌드도 같은 경로를 쓴다.
  - 파일이 바뀌면 `handleHotUpdate`에서 가상 모듈을 무효화하고, 런타임이 `import.meta.hot.accept`로 받는다(약 26ms). 파일이 깨지면 마지막 정상 토큰을 유지하고 경고만 낸다.
- **CSS 변수 이름**: `--color-<name>`, `--spacing-<name>`, `--rounded-<name>`. 공식 CLI의 `export --format css-vars`와 같다.
- **역할 파생**: 핵심 4개(`canvas`·`ink`·`primary`·`accent`)가 있으면 나머지를 OKLCH 혼합으로 채운다. 대비는 `ink-muted` 3:1, `on-primary` 최대 대비를 보장한다(상세 기획서 §8.2).
- **해석 순서**: 토큰 참조(`{colors.primary}`) 해석 → CSS 변수 주입 → `useDesign()` 값. `color` 파라미터는 코드 기본값 < 토큰 < 사용자 값(`params/*.values.json`) 순으로 결정.
- **미리보기 교체**: 팔레트를 고르면 Bridge `setDesign`으로 CSS 변수와 `useDesign()` 값을 즉시 바꾼다. R3F는 `invalidate()`로 다시 그린다. 목표 < 100ms(파라미터와 동일).
- **적용(쓰기)**: 앱(`src/lib/design`)이 front matter의 `colors` 블록만 줄 단위로 교체한다. flow 스타일이면 YAML 문서 API로 처리한다.
  - 선택하면 본문에 적힌 이전 hex도 새 값으로 바꾼다.
  - 나머지 바이트·줄바꿈(CRLF)은 보존되고, 왕복하면 파일이 완전히 복원된다(S7 단위 테스트).
  - 이후 HMR로 반영하고 체크포인트를 만든다.
- **검증**(F-DSN-02): ① 자체 zod 스키마(필수 색 역할, 색 형식, 참조 대상 존재) ② WCAG 대비(역할 쌍) ③ 선택: 공식 CLI `lint`(export 워커 경유, **stdin을 닫고 실행**해야 멈추지 않음). `orphaned-tokens` 경고는 Scene 코드가 쓰는 역할 토큰이라 UI에서 걸러 낸다. Plan 단계에서 실패하면 오류 목록을 에이전트에 자동 재요청.
- **결정성**: 토큰은 빌드 시점 상수이므로 같은 `DESIGN.md` → 같은 프레임. 렌더 모드에서는 `setDesign`을 받지 않는다.

- **Text Fidelity 검사(motion)**: `scene.json.copy.items`의 원문이 렌더 결과 DOM 텍스트에 정확히 포함되는지 비교(후속 V3+에서 규칙화).
- `endCard.holdSeconds ≥ 0.7`, `beats` 시간 합 = `duration` 검증(스키마 수준).

### 4.5 DESIGN.md 확장 (v2)

- **상속**: 신 `DESIGN.md` front matter의 `extends: ../../DESIGN.md`가 있으면 워크스페이스 토큰을 기본으로 하고 신에 적힌 토큰만 오버라이드한다. 파서(`src/lib/design`)가 상속 해석을 담당하며 쓰기 대상은 항상 해당 파일 자신이다.
- **분석 마커 구간**: 본문의 `<!-- vanilla:begin:analysis -->…<!-- vanilla:end:analysis -->`(저장소 공통 마커 형식, `src/lib/design/analysis.ts`)는 레퍼런스 분석 결과(분위기 키워드·팔레트 메모)용으로 에이전트가 갱신할 수 있는 유일한 본문 구간이다. 그 밖은 사용자 소유이며 바이트를 보존한다(D-016).
- **mood**: front matter `mood: [..]` 배열은 선택 필드이며 가이드 `visualStyle.mood`와 같은 용어 ID를 쓴다.


---

## 5. Vanilla Bridge (호스트 ↔ 신 iframe) — 보존·확장

`window.postMessage` 기반, 모든 메시지에 `{ v: 2, type, payload }`(**v2**: 정적 페이지 step 진행과 캔버스 주입 추가, v가 다른 메시지는 무시). origin 검사 필수.

| 방향 | type | payload |
| --- | --- | --- |
| host→scene | `init` | `{ mode: 'preview', paramsValues, canvas?: { width, height, fps } }` — `canvas`는 `workspace.json.canvas`(D-030), 신은 `useFrame()`으로 읽는다. 직접 열 때는 `?w=&h=&fps=` |
| host→scene | `play` / `pause` | – |
| host→scene | `seek` | `{ t }` (전체 시간) |
| host→scene | `setParams` | `{ sceneId, values }` |
| host→scene | `goto` | `{ stepId }` (`static` steps 직접 이동) |
| host→scene | `setDesign` | `{ colors }` 미리보기 전용 토큰 오버라이드, `null`이면 해제 (§4.4) |
| host→scene | `capture` | `{ scale }` → `captured` 응답(PNG dataURL, 수정 요청 첨부·팔레트 비교용) |
| scene→host | `ready` | `{ scene: SceneMeta, duration, mode: 'clock'|'free', stepMode?: 'scroll'|'steps', design: { hash, roles } }` |
| scene→host | `time` | `{ t, sceneId }` (재생 중 16ms 이하로 스로틀) |
| scene→host | `error` | `{ message, stack, sceneId }` → 검수 화면 오류 배너 + "에이전트에게 수정 요청" 버튼 |
| scene→host | `hmr` | `{ modules: string[], at }` — 런타임 Vite 플러그인이 `vite:afterUpdate`에서 보고(HMR 누락 감지용, S4) |
| host→scene | `reload` | – 전체 새로고침. 이후 `ready` → host가 `init`으로 파라미터·시각 복원 |
| host→scene | `next` / `prev` | – 사용자 입력 위임(플레이그라운드 키·클릭 → `static` 신 step 이동, D-032) |
| scene→host | `step` | `{ index, total }` 현재 step 보고(스크롤형은 total 1) |
| scene→host | `done` | `{ }` 마지막 step에 입력이 들어옴(static) 또는 끝 시각 도달(motion·3d) → 호스트가 시퀀스 엣지 `trigger`를 평가 |
| scene→host | `choice` | `{ label }` 신 내부 UI가 분기 선택을 보고(`trigger: choice:<label>`) |

- 미리보기 iframe은 `sandbox="allow-scripts allow-same-origin"`(Vite HMR 필요) + **별도 origin(`127.0.0.1:port`)**. CSP에 `frame-src http://127.0.0.1:*`를 추가한다.
  - S4 확인: WebView2는 Tauri IPC 초기화 스크립트를 iframe에도 주입한다(`__TAURI_INTERNALS__` 존재). 그러나 capability ACL이 로컬 origin만 허용하므로 앱·플러그인 명령은 모두 거부된다. cross-origin이라 부모 창 접근은 `SecurityError`다.
  - 따라서 **어떤 capability에도 `remote.urls`로 `127.0.0.1`/`localhost`를 넣지 않는다.** 개발 모드 host(`localhost:1430`)와 미리보기(`127.0.0.1`)의 호스트명을 달리해 origin을 구분한다.
- 성능(S4): `setParams`·`seek` 왕복 p95 34ms(2프레임 대기 포함), HMR 반영 약 27ms. Fast Refresh로 상태가 유지된다.
- **HMR 누락 대응(S4)**: 같은 모듈을 약 30ms 간격으로 연속 쓰면 Vite가 마지막 변경을 놓칠 수 있다. 앱은 다음 순서로 대응한다.
  1. 프로젝트 파일 변경을 직접 감시한다(Rust `notify`).
  2. 변경이 500ms 멈추면, 미리보기가 보고한 `hmr` 모듈 목록과 비교한다.
  3. 누락이 있으면 `reload`로 새로고침한다.
  4. 빌드 태스크가 끝날 때마다 이 확인을 거친다.
- Fast Refresh 경계: 부트스트랩 `src/main.tsx`(앱 소유)와 Scene 모듈(컴포넌트만 export)을 분리한다. Bridge 리스너는 effect cleanup으로 해제한다.

- 변경 항목(`goto` payload, `ready` payload, `step`·`done`·`choice`·`next`·`prev`)은 **Bridge 스키마 v2**(`v: 2`)이다. 구현 시 zod 스키마와 이 표를 함께 갱신하고 `v` 불일치 메시지는 무시한다(AGENTS.md §4-5).


---

## 6. 프로세스 관리 (process_mgr, D-012)

| 프로세스 | argv (고정) | 수명 |
| --- | --- | --- |
| 의존성 설치 | `pnpm install --frozen-lockfile=false` (cwd=워크스페이스) | 워크스페이스 생성 시 동의 후 1회, `package.json` 변경 시 확인 후 재실행 |
| 프리뷰 서버 | `node <app>/vite-runner.mjs --root <workspace> --port 0` | 워크스페이스 열림 동안. 포트는 stdout으로 보고 |
| 에이전트 CLI | 레지스트리 `argv` (cwd=신 폴더, §3) | 터미널 세션 동안 |
| 키프레임 추출 | `<appData>/tools/ffmpeg/ffmpeg …` 고정 인자 | 레퍼런스 등록 시 1회 |

- 명령 문자열을 UI에서 받지 않는다. Rust enum으로 종류를 받고 argv는 Rust가 조립한다.
- 공통 실행 규칙(S6·S7): PATHEXT 순서로 해석, 레지스트리에서 새로 읽은 PATH 전달, stdin 닫기(PTY 제외), 콘솔 창 비표시.
- 워크스페이스 전환·앱 종료 시 자식 프로세스 트리 정리(Windows Job Object). 터미널 세션도 함께 종료 확인.

---

## 7. Export 파이프라인 — **후속(v2.0 범위 밖, D-027) · v1 설계 보존**

v2.0의 "공유"는 `.vsx` 패키지(§8.4)이며 재생은 Playground가 맡는다. 아래는 후속 재연결 때 참고할 v1 설계다(신 단위 → 시퀀스 단위로 입력만 바꾼다).

```
export 요청 ─▶ 체크포인트 확인 ─▶ vite build (render 모드 엔트리 포함) ─▶ 유형별 처리 ─▶ exports/<ts>-<fmt>/ ─▶ (선택) 플레이그라운드 복사
```

| 유형 | 처리 |
| --- | --- |
| web / interactive | `vite build`(live 모드) → `dist/` zip. 임베드 패키지는 lib 모드 빌드 + Web Component 래퍼 |
| image | render 빌드를 헤드리스 Chrome으로 열어 변형별 `?variant&t` 지정 → `__vanillaReady` 대기 → 캡처(deviceScaleFactor=배율) → PNG/JPG/WebP. 3840×2160 한 장 약 0.3~0.5초(S2) |
| slides | 슬라이드별 캡처(image와 동일) → `pptxgenjs` `LAYOUT_WIDE` 전면 이미지(이미지 PPTX), `pdf-lib` PDF.
편집 PPTX(S5): 헤드리스 페이지에 `dom-to-pptx` 번들을 주입해 `exportToPptx(slides, {width: 13.333, height: 7.5, skipDownload})` 실행(3장 약 0.24초).
이어서 JSZip으로 한 줄짜리 텍스트 상자에 `wrap="none"`을 넣는다.
제약: 웹 폰트 임베드를 PowerPoint가 쓰지 않으므로 시스템·설치 폰트가 조건이다. 결과 폴더에 폰트 파일과 안내를 넣는다. 그라데이션 각도·그림자는 근사치다. WebGL Canvas는 `preserveDrawingBuffer`가 필요하다 |
| video | render 빌드 → HyperFrames render(fps·해상도·코덱) → MP4/WebM + 포스터 |

render 모드와 HyperFrames seek의 연결, 준비 대기 신호는 S1에서 확정했다(§4.1). 결정성은 **같은 렌더러(GPU/소프트웨어) 안에서** 보장된다. 골든 테스트는 렌더러를 고정한다(CI는 `--no-browser-gpu`).

---

## 8. 데이터 저장

### 8.1 전역 DB (AppData `app.db`) — 앱 상태 전용

| 테이블 | 용도 |
| --- | --- |
| `app_settings` | 테마·언어·기본 에이전트·`templatesDir`·터미널 옵션(자동 붙여넣기) |
| `workspaces` | 최근 워크스페이스(`workspaceId`·경로·이름·마지막 열람, 신뢰 확인 여부) |
| `agents` | 에이전트 레지스트리 사용자 설정(§3.1) |
| `terminal_sessions` | 터미널 세션 메타(에이전트·워크스페이스·신·시작/종료) |
| `playground_items` | v1 플레이그라운드 인덱스(후속 공유 시퀀스 열람용으로 보존) |
| `palettes`·`templates` | v1 인덱스(보존, 사용처는 V3에서 가이드 템플릿 목록으로 대체) |
| `doctor_cache` | 의존성 점검 결과 캐시 |

프로젝트 DB(`<project>/.vanilla/app.db`)와 `pipeline_state`·`task_runs`·`agent_sessions`·`reviews`·`export_jobs`는 제거 대상이다. 신별 앱 상태(썸네일·실행 이력·self-check·history)는 DB가 아니라 `scenes/<slug>/.vanilla/` 파일에 둔다. 마이그레이션은 `src/lib/db/migrations/*.sql`(0004는 v1 플레이그라운드가 사용 중이라 v2는 0005_v2_global — `workspaces`·`terminal_sessions`·`app_settings.templates_dir` — 과 0006_v2_project_cleanup — 제거 테이블 drop)로 한다.

### 8.2 워크스페이스 파일 (`Refactor-Spec-v2.md` §4·§5의 구현 계약)

| 파일 | 스키마(zod) | 비고 |
| --- | --- | --- |
| `workspace.json` | `src/lib/workspace/schema.ts` | `version`·`workspaceId`·`name`·`canvas{aspect,width,height,fps}`·`defaultAgent`·`view`(캔버스 뷰포트) |
| `sequence.json` | `src/lib/sequence/schema.ts` | `version`·`workspaceId`·`id`·`mode`·`nodes[]`·`edges[]`·`start`. 검증: static 신 발신 엣지는 사용자 입력 trigger만, `workspaceId` 일치, 노드의 `sceneId`는 `scenes/*/scene.json`에 존재, start 도달성 |
| `scenes/<slug>/scene.json` | `src/lib/scene/schema.ts` (공통 + 타입별 확장 `static`·`motion`·`3d`) | 신 ID(`id`, `scn_<alnum>`) 불변, 용어는 glossary ID로 저장, 정규화 직렬화(§8.3, 시간 키 `start`·`end`·`seconds`·`holdSeconds`). 타입 확장은 평면 필드: `static`=`mode`·`steps`·`sections`·`layout`·`breakpoints`·`accessibility`, `3d`=motion 공통 + `composition`·`materials`·`lighting`·`cameraPath`·`performanceBudget`. 검증: `beats`는 0에서 시작·연속·합=`duration.seconds`, `endCard.holdSeconds ≥ 0.7`, static `steps[].advance`는 `click`·`key:`·`choice:`만, 알 수 없는 필드 거부. 사용자 템플릿이 더한 필드 값은 `custom{}`에 저장(D-031). 용어집은 템플릿별 `glossary.json`(`terms[]`: category·id·label·definition·implementationHint·tags), `schema.json`은 `hide`·`defaults`·`fields`(추가 필드)만 허용 |
| `scenes/<slug>/references/references.json` | `src/lib/scene/references.ts` | `{id, kind: video|image|url, path|url, note, analysis}` |
| `scenes/<slug>/comments.json` | `src/lib/scene/comments.ts` | `{version, sceneId, comments[{id, createdAt, body, status, history[{at, action}]}]}` — 사용자가 에이전트에게 남기는 수정 요청(D-034) |
| `WORK_ORDER.md` · `.vanilla/work-order.json` | `src/lib/workspace/workOrder.ts` | 바닐라 스튜디오 UI 변경사항(시퀀스·신·가이드·파라미터·팔레트)과 신별 코멘트를 집계한 통합 작업 지시서(D-036) |
| `VANILLA_GUIDE.md` · `.vanilla/resources/` | (초기화 시 복사) | 스튜디오 동작 가이드·스키마·파라미터 역할 및 내장 템플릿·프리셋·팔레트 오프라인 카탈로그(D-036) |
| `scripts/vanilla-agent.mjs` | (초기화 시 복사) | `pnpm vanilla <cmd>` 에이전트 연동 CLI 브리지(`status`·`templates`·`inspect-template`·`scaffold-scene`·`sync-guides`·`work-order`·`resolve`, D-036) |
| `scripts/pack-workspace.mjs` + `pack-workspace.d.mts` | (초기화 시 복사) | `pnpm dist` 수업 배포용 zip(Node 내장만, D-041). `node_modules/`·`.vanilla/`·`.git/`(어느 깊이든)·루트 `dist/`·로그·`.env*` 제외, `pnpm-lock.yaml` 포함, 최상위 폴더는 `package.json` `name` |
| `pnpm-workspace.yaml` | (초기화 시 복사) | `minimumReleaseAge: 0` — pnpm v11+ 24시간 게이트 해제, 받는 쪽 무개입 `pnpm install`(D-041) |
| `guide-templates/*/template.json` | `src/lib/guides/templateSchema.ts` | `{id, version, type, extends, label}` |
| `manifest.json`(.vsx 내부) | `src/lib/package/manifest.ts` | 파일별 SHA-256, 앱·스키마 버전, 사용 템플릿 목록 |

### 8.3 정규화 직렬화

`src/lib/json/canonical.ts`: 키 순서는 스키마 정의 순, 2-space 들여쓰기, LF, 시간(초)은 소수 3자리 고정, 배열 순서는 의미 순서만. 같은 입력 → 같은 바이트. 워크스페이스·신·시퀀스 JSON은 이 함수로만 쓴다(앱), 에이전트가 쓴 JSON은 검증 후 앱이 정규화해 저장할 수 있다(사용자 승인 시).

### 8.4 `.vsx` 공유 패키지

zip. 루트에 `manifest.json`. 포함: 신(또는 시퀀스+전 신)의 `scene.json`·`GUIDE.md`·`AGENTS.md`·`DESIGN.md`·`prompts/`·`src/`·`params/`·`references/references.json`·`analysis/`, 사용한 사용자 정의 템플릿, `CREDITS.md`. 제외: `.vanilla/`, 원본 레퍼런스 영상(옵션). 열 때: 경로 정규화(zip-slip 검사), 해시 검증, 스키마 버전 확인(불일치 시 마이그레이션 제안), 템플릿·`rules.md` 출처 확인 다이얼로그(§10). 가져온 신의 `workspaceId`는 현재 워크스페이스로 다시 쓴다(D-029).

### 8.5 v1 프로젝트 마이그레이션 (D-033)

`src/lib/migrate/v1.ts`: `vanilla.json`을 읽어 새 폴더에 변환 결과를 만든다(원본 불변). 매핑 규칙은 `Refactor-Spec-v2.md` §11.1. 출하 조건(샘플 3종 무손실 재생)을 만족하지 못하면 UI 진입점을 숨기고 "v1 앱으로 열기"를 안내한다.

---

## 9. 앱 코드 구조

`Docs/Project-Structure.md` 규칙(도메인별 `src/lib/<도메인>` + `src/components/<도메인>` + `src/lib/types/<도메인>.ts`)을 따른다.

```
src/lib/
  workspace/   # workspace.json 스키마, 열기·생성, 워크스페이스 Context, 스위처
  scene/       # scene.json 스키마(타입별), 스캐폴딩 호출, references 스키마, 상태 모델
  sequence/    # sequence.json 스키마·검증, 그래프 모델, 시퀀스 매니저(재생 상태 머신)
  guides/      # 가이드 엔진(템플릿 해석, 렌더, 용어집 로더), 되쓰기 검증
  agents/      # (축소) 레지스트리, 실행 요청, 프롬프트 조립
  design/      # (보존) DESIGN.md 파싱·검증·상속·마커 구간·colors 교체, 팔레트, 색 계산
  package/     # .vsx 만들기/풀기, manifest
  migrate/     # v1 → v2 변환
  playground/  # (확장) 시퀀스 플레이어, 입력 라우팅
  json/        # canonical 직렬화
  doctor/      # 점검 결과 모델
src/components/{workspace,canvas,scene,inspector,guides,terminal,playground,doctor,layout}/
src-tauri/src/commands/
  workspace_commands.rs  scene_commands.rs  pty_commands.rs  process_commands.rs
  package_commands.rs    doctor_commands.rs
src-tauri/src/{process,watch.rs}     # 보존
resources/
  runtime/                     # @vanilla/runtime 소스(워크스페이스에 설치)
  workspace-template/          # 워크스페이스 스캐폴딩 원본(workspace.json·AGENTS.md·CLAUDE.md·DESIGN.md·package.json·pnpm-workspace.yaml(D-041, `allowBuilds` 생략 — D-043)·vite.config.ts·play.html·play/·scripts/pack-workspace.mjs(D-041, `pnpm dist`)·scripts/ascii-cwd.mjs(D-043·D-044: 비ASCII cwd에서 node 스크립트는 junction 별칭 실행, vite는 그대로 실행하고 exit 3221225477일 때만 영문 경로 안내))
  guides/<type>/<id>@<ver>/    # 내장 가이드 템플릿(motion/commercial-v1, static/web-page-v1, 3d/three-scene-v1)
  glossary/                    # 용어집(템플릿이 참조)
  palettes/*.json              # 보존
  samples/                     # 골든 샘플(보존)
  workers/                     # vite-runner.mjs (+ vanilla-export.mjs 보존)
legacy/                        # v1 전용 코드 보관(빌드 제외) 또는 삭제(§11 기존 코드 처리)
```

`@vanilla/runtime`과 export 워커는 pnpm 워크스페이스 패키지(`packages/runtime`, `packages/export-worker`)를 유지한다.

---

## 10. 보안

| 위협 | 대책 |
| --- | --- |
| 워크스페이스 밖 파일 접근(앱) | 모든 파일 명령은 Rust `resolve_and_verify_workspace_path`로 검사(심링크 canonicalize). 워크스페이스 전환 시 이전 경로는 스코프에서 제외 |
| 에이전트의 범위 이탈 | 앱은 에이전트 파일 접근을 가로채지 못한다. 대신 ① cwd=신 폴더 ② `AGENTS.md`의 범위 규칙(§4.1 `Refactor-Spec-v2`) ③ 에이전트 CLI 자체 권한 시스템에 의존한다. 설정 화면에 "에이전트의 셸·네트워크 권한은 각 CLI가 관리한다"를 명시 |
| 임의 명령 실행 | 앱이 실행하는 것은 레지스트리 `argv`와 고정 argv뿐(D-012). 레지스트리 편집은 설정 화면 + 확인 다이얼로그 |
| 미리보기 신 코드가 앱 IPC 호출 | iframe 별도 origin, Tauri capability는 메인 창 로컬 origin만. `remote.urls` 금지(S4) |
| `assetProtocol.scope` | 현재 워크스페이스·앱 데이터로 제한(D-021 Proposed 처리 대상) |
| 신뢰하지 않은 폴더·패키지 | 폴더 신뢰 확인 전에는 에이전트·프리뷰 서버 시작 금지. `.vsx`·템플릿의 `rules.md`·`prompts/*`·`AGENTS.md`는 **신뢰할 수 없는 데이터**: 가져올 때 내용 미리보기와 출처 확인을 거친다. zip-slip·절대 경로·심링크 엔트리 거부 |
| 프롬프트 인젝션(레퍼런스·URL) | 레퍼런스 파일·URL 본문은 데이터로 취급한다고 `analyze-reference.md`·`AGENTS.md`에 명시. 앱은 URL을 내려받지 않는다(D-026) |
| 외부 리소스 라이선스 | `CREDITS.md` 필수. 생성형 AI 연동 금지(D-006) |
| 터미널 로그 내 비밀정보 | `.vanilla/sessions/` 로그는 공유 패키지에서 제외 |

---

## 11. 테스트 전략

| 레벨 | 대상 | 도구 |
| --- | --- | --- |
| 단위 | zod 스키마(workspace·scene·sequence·references·template·manifest), canonical 직렬화(왕복·바이트 동일), 시퀀스 검증(static 엣지 규칙·workspaceId·도달성), 가이드 렌더(마커 보존·결정성·스냅샷), 용어집 로더, Bridge v2 메시지, 런타임 시간 변환 | vitest |
| 단위(디자인) | DESIGN.md 파싱·상속·마커 구간, `colors` 교체 왕복(본문 바이트 보존), WCAG 대비 | vitest (v1 테스트 이관) |
| 컴포넌트 | 인스펙터 폼(스키마 → 폼), 용어 콤보박스, 캔버스 노드·엣지 편집, 시퀀스 플레이어 입력 라우팅 | vitest + Testing Library |
| Rust | 경로 스코프, 고정 argv 조립, zip-slip 거부·해시 검증, 신 스캐폴딩 트리, 파일 감시 | `cargo test` |
| 마이그레이션 | v1 샘플 프로젝트 3종 → v2 변환·재생 비교 | vitest + 샘플 |
| 통합 | 목(mock) 에이전트 스크립트(PTY에서 파일을 쓰고 종료)로 실행→검증→상태 갱신 | vitest + Node |
| E2E | 앱 실행 → CDP로 캔버스·신 생성·플레이그라운드 재생·입력 전환 검사 | Node CDP 스크립트(v1 하네스 재사용) |
| 골든 | 샘플 신(`resources/samples/`)을 같은 `t`로 두 번 렌더해 동일성, 가이드 렌더 스냅샷 | vitest + 런타임 |
| 수동 | 실제 에이전트(Claude Code·Codex)로 신 생성·레퍼런스 분석 E2E, 다른 PC에서 `.vsx` 재현 | 릴리스 체크리스트 |

### 기존 코드 처리 (D-022, `Refactor-Spec-v2.md` §11)

| 대상 | 처리 시점 |
| --- | --- |
| `src-tauri/src/agent_host/`, `mcp_server/`, `commands/agent_commands.rs`, `src/lib/agents/`(ACP 세션), `src/components/agents/`, `src/lib/pipeline/`, `src/components/pipeline/`, `src/lib/review/`, `src/components/review/`, 프로젝트 마법사·`vanilla.json` 스키마 | **V1 말미에 `v1-final` 태그를 만든 뒤 제거**한다(삭제 전 사용자 확인). 마이그레이션(§8.5)이 필요로 하는 `vanilla.json` 읽기 스키마는 `src/lib/migrate/legacy-schema.ts`로 이관 |
| `src/lib/design/`, `packages/runtime`, `src-tauri/src/process`, `watch.rs`, PTY·xterm, doctor, playground, `packages/export-worker`, 팔레트·샘플 | 보존·확장 |
| 템플릿 갤러리·`resources/templates/*` | V3에서 가이드 템플릿으로 재구성한 뒤 제거 |
