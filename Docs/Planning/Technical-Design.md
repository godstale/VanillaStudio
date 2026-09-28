# Vanilla Studio 기술 설계서 (Technical Design)

- 문서 버전: v0.1 (2026-09-28)
- 선행 문서: `Docs/Planning/Product-Spec.md`, `Docs/Planning/Decisions.md`
- 템플릿 공통 아키텍처(`Docs/Architecture.md`)는 **템플릿 원본으로 유지**하고, 이 문서가 Vanilla Studio 고유 설계의 진실 공급원이다. 충돌 시 이 문서가 우선한다.
- ⚠️ 표시 항목은 PoC(`Feasibility-Risks.md` §3)로 확정해야 하는 가정이다.

---

## 1. 시스템 구성

```
┌──────────────────────────── Vanilla Studio (Tauri 2 앱) ────────────────────────────┐
│  WebView (React 19 UI)                                                              │
│   ├ 앱 셸(템플릿) · 파이프라인 · 검수 스튜디오 · 에이전트 패널 · 플레이그라운드       │
│   └ <iframe sandbox src="http://127.0.0.1:<port>">  ← 프로젝트 미리보기              │
│            ▲ postMessage (Vanilla Bridge 프로토콜 §5)                               │
│  ─────────────── invoke / Channel ───────────────                                   │
│  Rust Core                                                                          │
│   ├ fs/search (템플릿) + project_commands (스캐폴딩·체크포인트)                     │
│   ├ agent_host  : ACP 클라이언트 (agent-client-protocol crate) · 권한 정책 · fs 스코프 │
│   ├ pty_host    : portable-pty (터미널 폴백)                                        │
│   ├ process_mgr : 앱 소유 프로세스(프리뷰 서버·export 워커·pnpm install) 고정 argv   │
│   ├ mcp_server  : vanilla-tools (에이전트용 MCP, Streamable HTTP 127.0.0.1) ⚠️       │
│   ├ doctor      : 의존성 점검·FFmpeg 다운로드                                       │
│   └ db          : SQLite (전역 / 프로젝트)                                           │
└────────┬───────────────────┬──────────────────────┬──────────────────────────────────┘
         │ stdio (ACP)       │ spawn (Node 22+)      │ spawn
   ┌─────▼──────┐     ┌──────▼─────────────┐   ┌────▼───────────────────────────────┐
   │ Agent CLI  │     │ Vite dev server    │   │ vanilla-export 워커 (Node)         │
   │ claude/    │     │ (프로젝트별 1개)    │   │  ├ HyperFrames → Chrome + FFmpeg   │
   │ codex/...  │     └────────────────────┘   │  ├ 스틸 캡처(Chrome headless)       │
   └────────────┘                              │  └ pptxgenjs / dom-to-pptx / pdf    │
                                               └────────────────────────────────────┘
```

**설계 원칙**

1. **보안 경계는 Rust에 둔다.** 에이전트의 파일 요청·권한 요청, 프로세스 실행은 모두 Rust에서 스코프·정책을 강제한다. UI는 표시와 사용자 응답만 담당.
2. **프로젝트 내용은 파일, 앱 상태는 DB.** (Product-Spec P7)
3. **앱 소유 프로세스와 임의 셸을 분리한다.** (D-012)
4. **하나의 Scene 런타임, 여러 export.** (D-011)

---

## 2. 기술 스택

### 2.1 앱 (템플릿 고정 스택 유지 + 추가)

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 셸 | Tauri 2 (Rust), Windows 우선 | 템플릿 |
| UI | React 19, TS strict, Vite 7, shadcn/ui, Tailwind 3, lucide-react, react-resizable-panels | 템플릿 |
| 편집기 | CodeMirror 6 | 템플릿 (프롬프트·brief 편집) |
| 상태 | React Context per concern | 템플릿 규칙. 전역 스토어 금지 |
| 저장소 | SQLite (`tauri-plugin-sql`) | 템플릿 |
| 검증 | zod | 이미 의존성 존재. `plan.json`·`tasks.json`·`vanilla.json`·`template.json` 스키마 |
| **ACP 클라이언트** | Rust `agent-client-protocol` crate | 신규. 프로세스 수명·권한·fs를 Rust에서 처리 |
| **터미널** | Rust `portable-pty` + `@xterm/xterm` | 신규. 폴백 경로 |
| **MCP 서버** | Rust `rmcp` (공식 Rust MCP SDK) ⚠️ | 신규(S). 대안: Node 스크립트 |
| **HTTP(로컬)** | Rust `axum`/`tiny_http` 중 택1 ⚠️ | 플레이그라운드 정적 서빙, MCP HTTP |
| **다운로드/압축** | `reqwest`, `zip` crate | FFmpeg 다운로드, zip export |

### 2.2 사용자 프로젝트(생성물) 런타임 — 앱이 스캐폴딩

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 빌드/프리뷰 | Vite + React 19 + TypeScript | HMR로 에이전트 수정 즉시 반영 |
| 3D | three.js + `@react-three/fiber` + `@react-three/drei` | `frameloop="demand"` 강제(결정성) |
| 2D | SVG·Canvas·CSS, 선택: `motion`(MIT), `animejs` v4(MIT) | 시간 함수형 사용 |
| GSAP | **선택적**(생성 코드 내에서만, paused timeline + seek) | 표준 라이선스 제약(D-007) — 앱 기능은 GSAP 비의존 |
| 셰이더 | GLSL(three `ShaderMaterial`) | 절차적 텍스처·배경 |
| 폰트 | `@fontsource/*`(OFL) 로컬 번들 | 오프라인·결정성 |
| 런타임 계약 | `@vanilla/runtime` (앱 번들, `vanilla/runtime/`에 설치) | §4 |

### 2.3 Export 워커 (`vanilla-export`, Node 22+, 앱에 JS 번들로 포함)

| 기능 | 선택 | 비고 |
| --- | --- | --- |
| 동영상 | HyperFrames CLI/라이브러리 (Apache-2.0) | D-004. Chrome + FFmpeg |
| 스틸 캡처 | HyperFrames `snapshot` 또는 `puppeteer-core` + 시스템 Chrome/Edge ⚠️ | S2에서 택1 |
| PPTX(이미지) | `pptxgenjs` (MIT) | 슬라이드 PNG를 전면 배치 |
| PPTX(편집) | `dom-to-pptx` (pptxgenjs 기반) Beta | 브라우저 컨텍스트에서 실행 |
| PDF | Chrome `printToPDF` 또는 `pdf-lib` | 이미지 기반 우선 |
| 정적 사이트 | `vite build` + zip | |

### 2.4 외부 의존성 (Doctor가 점검)

| 의존성 | 필수 여부 | 설치 방식 |
| --- | --- | --- |
| Node.js 22+ | 필수 | 사용자 설치 안내(winget/공식 설치 파일) |
| pnpm | 필수 | `corepack enable` 안내 |
| git | 권장(체크포인트) | 사용자 설치 안내, 없으면 폴더 스냅샷 |
| 에이전트 CLI(1개 이상) | 필수 | 각 공식 설치 안내 + 로그인 상태 확인 |
| ACP 어댑터 | 에이전트별 | `npx`로 실행 또는 전역 설치 ⚠️ |
| FFmpeg | 동영상 export 시 | 앱이 다운로드해 앱 데이터에 저장 |
| Chrome/Chromium | export 시 | HyperFrames가 관리하는 브라우저 또는 시스템 Chrome/Edge ⚠️ |

---

## 3. 에이전트 호스트 (agent_host)

### 3.1 에이전트 레지스트리

전역 DB `agents` 설정(사용자 편집 가능, 기본값은 앱 내장):

| id | 표시명 | 기본 모드 | 실행 명령(기본값, ⚠️ S3에서 확정) | 지원 등급 |
| --- | --- | --- | --- | --- |
| `claude-code` | Claude Code | ACP | `npx -y @agentclientprotocol/claude-agent-acp` | 공식 |
| `codex` | Codex | ACP | `npx -y @agentclientprotocol/codex-acp` | 공식 |
| `opencode` | OpenCode | ACP | `opencode acp` | 실험적 |
| `hermes` | Hermes Agent | ACP | `hermes acp` | 실험적 |
| `agy` | Antigravity CLI | Terminal | `agy` (ACP는 커뮤니티 어댑터 선택 시) | 실험적 |

### 3.2 ACP 흐름

```
UI                         Rust agent_host                         Agent (stdio)
 │ start_agent_session ──▶ spawn(cmd, cwd=project)                     │
 │                         initialize(clientCapabilities: fs.read/write) ─▶
 │                         session/new(cwd, mcpServers=[vanilla-tools]) ─▶
 │ send_prompt(text) ────▶ session/prompt ─────────────────────────────▶
 │ ◀── Channel event ◀──── session/update (message·tool_call·plan·diff) ◀─
 │                         fs/read_text_file, fs/write_text_file ◀──────── (스코프 검사 후 처리)
 │ ◀── permission_req ◀─── session/request_permission ◀──────────────────
 │ respond(allow_once) ──▶ 응답 ─────────────────────────────────────────▶
 │ cancel ───────────────▶ session/cancel ───────────────────────────────▶
```

- **클라이언트 capability**: `fs.readTextFile`, `fs.writeTextFile` 제공(프로젝트 스코프 강제). `terminal`은 **제공하지 않는다** → 에이전트가 자체 셸을 쓰되 `request_permission`을 거치게 한다. ⚠️ 어댑터별 동작 S3에서 확인.
- **권한 정책(D-010)**: 요청의 `toolCall.kind`로 분류
  - `read`/`edit`/`delete`/`move` + 경로가 프로젝트 안 → 자동 허용(로그 기록)
  - `execute`(셸) → 매번 다이얼로그, 선택지는 `allow_once`/`reject_once`만 노출(`allow_always` 숨김)
  - `fetch`(네트워크) → 다이얼로그(D-006 오픈 라이선스 리소스 다운로드 대비)
  - 경로가 프로젝트 밖 → 자동 거부
- **이벤트 전달**: Tauri `Channel`로 세션별 스트림 전송. 세션 로그는 `.vanilla/sessions/<id>.jsonl`에 append(재생·디버깅·강의 자료용).
- **태스크 실행기**(TS, `src/lib/pipeline/`): `tasks.json` 위상 정렬 → 태스크마다 프롬프트 조립(§3.4) → `send_prompt` → `stopReason` 확인 → 검사·스냅샷·체크포인트 → 다음.

### 3.3 PTY 폴백

- `pty_host`가 `portable-pty`로 CLI를 cwd=프로젝트로 실행, xterm.js와 바이트 스트림 연결.
- 파이프라인 태스크는 "프롬프트를 클립보드/터미널에 붙여넣기" 방식으로 반자동 지원. 완료 판정은 사용자가 "완료" 버튼으로 표시.
- PTY로 띄우는 것은 사용자가 고른 에이전트 CLI **실행 파일 자체**이며, 에이전트 내부의 셸 권한은 해당 CLI의 권한 시스템을 따른다(설정 화면에 명시).

### 3.4 프롬프트 조립 규칙

앱이 에이전트에 보내는 프롬프트 = `시스템 프리앰블(단계·규칙 요약)` + `참조 파일 경로 목록` + `사용자 입력`.
본문을 길게 복사하지 않고 **파일 경로를 참조**시켜 에이전트가 직접 읽게 한다(컨텍스트 절약, 에이전트 중립). 프리앰블 원문은 `src/lib/pipeline/prompts/*.md`에 영문으로 두고 번역하지 않는다(AGENTS.md 규칙: LLM 프롬프트 본문은 번역 대상 아님). 출력 언어 지시는 사용자 로케일로 삽입.

---

## 4. Scene 런타임 (`@vanilla/runtime`)

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
  | `render` | HyperFrames seek 이벤트(`hf-seek`) ⚠️ | 동영상·스틸 export |
  | `live` | 실시간 rAF 시계 | 웹/인터랙티브 최종 배포본 |

- R3F: `<VanillaCanvas>`가 `frameloop="demand"`로 Canvas를 감싸고 `t` 변경 시 `invalidate()`/`advance()` 호출.
- 결정성 도우미: `useSeededRandom(seed)`, `noise2D/3D`(시드 고정), `ease.*`, `timeline([...keys])`(키 기반 보간).
- 입력: `useInput()` → 포인터·키·스크롤·자이로. `render` 모드에서는 고정값.
- GSAP 사용 시: `useGsapTimeline(tl)`이 paused timeline을 `t`에 맞춰 `seek` (선택적 헬퍼, gsap은 프로젝트 의존성으로만).

### 4.2 Composition

`src/composition.tsx`가 유형별 배치를 선언: `video` = 타임라인 구간, `slides` = 순서 배열, `web` = 섹션 배열, `image` = 변형 배열(규격 포함). 런타임은 전체 시간 ↔ Scene 로컬 시간 변환과 Scene 전환(transition) 훅을 제공.

### 4.3 계약 검사 (`check_scene`)

정적 검사(ESLint 커스텀 룰 + AST) + 동적 검사(같은 `t`를 두 번 렌더해 픽셀 비교):
- 금지 API: `Date.now`, `performance.now`, 시드 없는 `Math.random`, 자체 `requestAnimationFrame` 루프, `setInterval`
- `defineScene` 누락, 선언되지 않은 파라미터 사용, 외부 URL 리소스 참조(CREDITS 없는 경우)

---

## 5. Vanilla Bridge (호스트 ↔ 미리보기 iframe)

`window.postMessage` 기반, 모든 메시지에 `{ v: 1, type, payload }`. origin 검사 필수.

| 방향 | type | payload |
| --- | --- | --- |
| host→scene | `init` | `{ mode: 'preview', paramsValues }` |
| host→scene | `play` / `pause` | – |
| host→scene | `seek` | `{ t }` (전체 시간) |
| host→scene | `setParams` | `{ sceneId, values }` |
| host→scene | `goto` | `{ sceneId }` (slides/image) |
| host→scene | `capture` | `{ scale }` → `captured` 응답(PNG dataURL, 수정 요청 첨부용) |
| scene→host | `ready` | `{ scenes: SceneMeta[], duration, format }` |
| scene→host | `time` | `{ t, sceneId }` (재생 중 16ms 이하로 스로틀) |
| scene→host | `error` | `{ message, stack, sceneId }` → 검수 화면 오류 배너 + "에이전트에게 수정 요청" 버튼 |

- 미리보기 iframe은 `sandbox="allow-scripts allow-same-origin"`(Vite HMR 필요) + **별도 origin(127.0.0.1:port)** 이므로 앱 origin의 Tauri IPC에 접근 불가. CSP `frame-src http://127.0.0.1:*` 추가. ⚠️ S4에서 WebView2 동작 확인.

---

## 6. 프로세스 관리 (process_mgr, D-012)

| 프로세스 | argv (고정) | 수명 |
| --- | --- | --- |
| 의존성 설치 | `pnpm install --frozen-lockfile=false` (cwd=프로젝트) | 마법사에서 동의 후 1회, 이후 `package.json` 변경 감지 시 확인 후 재실행 |
| 프리뷰 서버 | `node <app>/vite-runner.mjs --root <project> --port 0` | 프로젝트 열림 동안. 포트는 stdout으로 보고 |
| export 워커 | `node <app>/vanilla-export.mjs <job.json>` | 작업 단위. 진행률 NDJSON stdout |

- 명령 문자열을 UI에서 받지 않는다. Rust enum으로 종류를 받고 argv는 Rust가 조립.
- 프로젝트 전환·앱 종료 시 자식 프로세스 트리 정리(Windows Job Object).

---

## 7. Export 파이프라인

```
export 요청 ─▶ 체크포인트 확인 ─▶ vite build (render 모드 엔트리 포함) ─▶ 유형별 처리 ─▶ exports/<ts>-<fmt>/ ─▶ (선택) 플레이그라운드 복사
```

| 유형 | 처리 |
| --- | --- |
| web / interactive | `vite build`(live 모드) → `dist/` zip. 임베드 패키지는 lib 모드 빌드 + Web Component 래퍼 |
| image | render 빌드를 헤드리스 Chrome으로 열어 변형별 `t` 고정 캡처(deviceScaleFactor=배율) → PNG/JPG/WebP |
| slides | 슬라이드별 캡처 → `pptxgenjs`(이미지 PPTX), PDF 결합 / 편집 PPTX는 헤드리스 페이지에서 `dom-to-pptx` 실행 |
| video | render 빌드 → HyperFrames render(fps·해상도·코덱) → MP4/WebM + 포스터 |

⚠️ render 모드가 HyperFrames의 seek 어댑터와 맞물리는지(S1), 폰트 로딩 대기(`document.fonts.ready`)·에셋 프리로드 대기 신호가 필요한지 확인.

---

## 8. 데이터 저장

### 8.1 전역 DB (AppData `app.db`) — 템플릿 확장

| 테이블 | 용도 |
| --- | --- |
| `app_settings` | 기존(테마·언어·최근 폴더) + 기본 에이전트, export 기본값 |
| `agents` | 에이전트 레지스트리(§3.1) 사용자 설정 |
| `playground_items` | 플레이그라운드 인덱스(파일은 `playground/<id>/`) |
| `templates` | 사용자 설치 템플릿 인덱스 |
| `doctor_cache` | 의존성 점검 결과 캐시 |

### 8.2 프로젝트 DB (`<project>/.vanilla/app.db`) — 템플릿의 `.app-data`를 `.vanilla`로 변경

| 테이블 | 용도 |
| --- | --- |
| `app_settings` | 탭 상태(기존) |
| `pipeline_state` | 단계별 상태(초안/승인/완료)·승인 시각·체크포인트 |
| `task_runs` | 태스크 실행 이력(상태·세션·시작/종료·결과 커밋) |
| `agent_sessions` | 세션 메타(에이전트·ACP sessionId·로그 경로) |
| `reviews` | 수정 요청 인덱스(파일은 `reviews/`) |
| `export_jobs` | export 작업 이력 |

마이그레이션은 템플릿 방식(`src/lib/db/migrations/*.sql` + `client.ts` 동기화)을 따른다.

---

## 9. 앱 코드 구조 (추가분)

`Docs/Project-Structure.md` 규칙(도메인별 `src/lib/<도메인>` + `src/components/<도메인>` + `src/lib/types/<도메인>.ts`)을 따른다.

```
src/lib/
  project/     # vanilla.json 스키마, 스캐폴딩 호출, 체크포인트
  agents/      # 레지스트리, ACP 세션 Context, 권한 요청 큐
  pipeline/    # 단계 상태, plan/tasks 스키마(zod), 태스크 실행기, prompts/*.md(프리앰블)
  review/      # Bridge 클라이언트, 파라미터 스키마→폼, 수정 요청 작성
  export/      # 작업 큐 Context, 유형별 옵션
  templates/   # template.json 스키마, 설치
  playground/  # 인덱스·플레이어
  doctor/      # 점검 결과 모델
src/components/{pipeline,agents,review,export,templates,playground,doctor,terminal}/
src-tauri/src/commands/
  project_commands.rs  agent_commands.rs  pty_commands.rs
  process_commands.rs  export_commands.rs doctor_commands.rs  mcp_server.rs
resources/                   # 앱 번들 리소스
  runtime/                   # @vanilla/runtime 소스(프로젝트에 복사)
  project-template/          # 스캐폴딩 원본
  skills/vanilla-core/       # 공통 스킬
  templates/<id>/            # 내장 디자인 템플릿
  workers/                   # vite-runner.mjs, vanilla-export.mjs (빌드 산출물)
```

`@vanilla/runtime`과 export 워커는 별도 pnpm 워크스페이스 패키지(`packages/runtime`, `packages/export-worker`)로 개발·테스트하고 빌드 산출물을 `resources/`로 복사한다. ⚠️ 워크스페이스 도입은 M1에서 확정.

---

## 10. 보안

| 위협 | 대책 |
| --- | --- |
| 에이전트의 프로젝트 밖 파일 접근 | ACP fs 요청은 Rust `resolve_and_verify_workspace_path`로 검사(심링크 canonicalize). 에이전트 자체 도구 사용은 `request_permission`에서 경로 검사 |
| 임의 셸 실행 | `execute` 권한은 매번 확인. 앱 소유 프로세스는 고정 argv(D-012) |
| 미리보기 코드가 앱 IPC 호출 | iframe을 별도 origin으로 격리, Tauri capability는 메인 창에만 부여 |
| `assetProtocol.scope: ["**"]` (템플릿 기본값) | 현재 프로젝트·앱 데이터 경로로 동적 제한(M1 작업) |
| 신뢰하지 않은 프로젝트/템플릿의 스킬 자동 로드 | 폴더 신뢰 확인(템플릿 기능) 후에만 에이전트 세션 시작. 외부 템플릿 가져오기 시 SKILL.md 미리보기·동의 |
| 외부 리소스 라이선스 위반 | `CREDITS.md` 필수, `check_scene`이 외부 URL·파일 출처 누락 경고 |
| 세션 로그 내 비밀정보 | 로그는 `.vanilla/`(git 제외). export·플레이그라운드에 포함하지 않음 |

---

## 11. 테스트 전략

| 레벨 | 대상 | 도구 |
| --- | --- | --- |
| 단위 | zod 스키마, 태스크 위상 정렬, 권한 정책 분류, Bridge 메시지, 런타임 시간 변환 | vitest |
| 컴포넌트 | 파라미터 폼, 타임라인 스크러버, 권한 다이얼로그 | vitest + Testing Library |
| Rust | 경로 스코프, 권한 정책, 프로세스 argv 조립 | `cargo test` |
| 통합 | 목(mock) ACP 에이전트(스크립트화된 응답)로 파이프라인 end-to-end | vitest + Node 목 서버 |
| 골든 | 샘플 프로젝트 export 결과 해시/픽셀 비교(결정성) | export 워커 테스트 |
| 수동 | 실제 에이전트(Claude Code·Codex)로 샘플 브리프 → export | 릴리스 체크리스트 |
