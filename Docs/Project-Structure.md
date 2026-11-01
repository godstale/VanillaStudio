# 코드 구조 (Project Structure)

> **문서 버전 v2.0 (2026-10-22)**. **Part A**는 Vanilla Studio v2의 현재 디렉터리 구조, **Part B**는 앱이 시작한 기반 템플릿 트리(이력)다.
> 설계 원칙은 `Docs/Architecture.md`·`Docs/Planning/Technical-Design.md` §9, 확장 절차는 `Docs/Extension-Guide.md`.

# Part A. 현재 구조 (v2)

```
.
├── AGENTS.md / CLAUDE.md          # 작업 지침 (CLAUDE.md는 AGENTS.md import)
├── README.md · DESIGN.md · BRANDING.md · NOTICE.md
├── package.json · pnpm-workspace.yaml   # pnpm 워크스페이스 (루트 + packages/*)
├── design/                        # 앱 UI 토큰(tokens.json → theme.css, 대비 검증), 브랜드 자산
├── src/
│   ├── App.tsx · main.tsx         # HashRouter + Provider 조합
│   ├── pages/                     # Storyboard · Workspace(시퀀스 캔버스) · Workspaces · Scenes · Templates
│   │   │                          # · Play · Playground · Settings/(general·workspace·templates·agents·app·doctor)
│   ├── components/
│   │   ├── layout/                # AppShell(사이드바·슬롯), TitleBar, FloatingPanel
│   │   ├── workspace/             # Onboarding, Switcher, TrustWorkspaceDialog, MigrateV1Dialog
│   │   ├── canvas/                # WorkspaceCanvas (@xyflow/react)
│   │   ├── scene/                 # SceneWorkspace, SceneNode, Preview, CheckPanel, 썸네일(useThumbnailCapture)
│   │   ├── inspector/             # SceneInspector, EdgeSection, References, DesignSection
│   │   ├── guides/                # SceneForm, TermCombobox, TemplateEditor, Beats/StepsEditor
│   │   ├── terminal/              # TerminalDock, TerminalProvider (xterm + PTY)
│   │   ├── playground/            # SequencePlayer, PlayerTab, AnnotationLayer
│   │   ├── design/ · comments/ · storyboard/ · doctor/ · package/ · export/(보존) · ui/(shadcn)
│   └── lib/
│       ├── workspace/             # workspace.json 스키마·열기/생성·히스토리·zip(archive)·작업 지시서
│       ├── scene/                 # scene.json 스키마·검사·참조·코멘트·썸네일·frameScore
│       ├── sequence/              # sequence.json 스키마·검증·편집·재생 매니저
│       ├── guides/                # 가이드 엔진(템플릿 해석·렌더·마커·용어집·프롬프트)
│       ├── agents/                # 에이전트 레지스트리·클립보드
│       ├── design/                # DESIGN.md 파서·재작성·팔레트·대비
│       ├── playground/ · review/  # 시퀀스 재생·전환 / Bridge·프리뷰 서버·타임라인
│       ├── package/ · migrate/    # .vsx / v1 마이그레이션
│       ├── terminal/ · storyboard/ · json/(canonical) · db/ · context/ · i18n/ · types/
├── src-tauri/src/
│   ├── lib.rs · main.rs · watch.rs
│   ├── commands/                  # workspace·scene·template·reference·pty·process·package·doctor·trust·migrate
│   │                              # + workspace_archive(zip) + fs·search·shell(템플릿 기반)
│   └── process/                   # 프로세스 실행 공통(PATHEXT·Job Object·타임아웃), FFmpeg 다운로드
├── packages/
│   ├── runtime/                   # @vanilla/runtime (defineScene·useTime·Bridge·토큰 Vite 플러그인·ESLint 룰)
│   └── export-worker/             # export 워커 (코드 보존, v2.0 범위 밖)
├── resources/
│   ├── workspace-template/        # 워크스페이스 스캐폴딩 원본 (workspace.json·AGENTS.md·play/·scripts/…)
│   ├── guides/{static,motion,3d}/ # 내장 가이드 템플릿 <id>@<ver>/
│   ├── runtime/ · palettes/ · samples/ · skills/ · workers/ · design/
├── tests/e2e/                     # CDP E2E (scene-preview·sequence-playback·samples-playback·v1-migration)
├── Docs/                          # Planning/ · Playbook/ · User-Guide/ · Verification/ · Architecture · Extension-Guide
└── wiki/                          # 지식베이스 (index·overview·log, sources/entities/concepts/syntheses)
```

## 어디를 먼저 읽을까 (v2)

| 목적 | 파일 |
| --- | --- |
| 화면·라우트 | `src/App.tsx`, `src/components/layout/AppShell.tsx` |
| 워크스페이스 열기·히스토리·zip | `src/lib/context/WorkspaceContext.tsx`, `src/lib/workspace/*`, `src-tauri/src/commands/workspace_commands.rs`, `workspace_archive.rs` |
| 신 생성·스키마·가이드 | `src/lib/scene/schema.ts`, `src/lib/guides/*`, `resources/guides/` |
| 시퀀스 검증·재생 | `src/lib/sequence/validate.ts`, `manager.ts`, `src/lib/playground/` |
| 에이전트 실행 | `src/lib/agents/registry.ts`, `src-tauri/src/commands/pty_commands.rs` |
| 미리보기·Bridge | `src/lib/review/`, `packages/runtime/` |
| 문구 추가 | `src/lib/i18n/dictionaries/ko.ts` + `en.ts` |
| 새 기능 추가 | `Docs/Extension-Guide.md` |

---

# Part B. 기반 템플릿 트리 (이력)

> 아래 트리는 앱이 시작한 템플릿 원본이다. 탭 시스템·사이드패널·`collections`·`extensions`·`WorkspaceTabsContext` 등은 v2에서 제거되었다. 현재 구조는 Part A를 따른다.

```
.
├── AGENTS.md                  # AI 코딩 에이전트 작업 지침 (이 리포지토리용)
├── BRANDING.md                # 로고·앱 이름 교체 체크리스트
├── DESIGN.md                  # 디자인 시스템(색·타이포·패턴)
├── package.json               # pnpm 스크립트·의존성
├── index.html                 # <html class="light"> 시작(FOUC 방지), <title>
├── tailwind.config.ts         # design/tailwind.preset.ts 사용
├── components.json            # shadcn/ui 설정
├── design/
│   ├── tokens.json            # 색·폰트 단일 진실 공급원 (수정 후 build-theme 실행)
│   ├── build-theme.mjs        # theme.css 생성 + 대비율 검증
│   ├── theme.css              # 생성물(HSL 변수)
│   ├── tailwind.preset.ts     # Tailwind v3 프리셋(토큰 매핑)
│   └── brand/                 # 로고 플레이스홀더 (교체 대상)
├── public/favicon.svg         # 파비콘 (교체 대상)
├── src/
│   ├── main.tsx               # 진입점 (StrictMode + ErrorBoundary + App)
│   ├── App.tsx                # HashRouter + Provider 조합 + 첫 실행 언어 팝업
│   ├── index.css              # 테마 변수 + 폰트 + base 스타일
│   ├── lib/brand.ts           # APP_NAME/APP_VERSION (교체 대상)
│   ├── components/
│   │   ├── brand/AppMark.tsx          # 로고 컴포넌트 (교체 대상)
│   │   ├── layout/                    # ActivityBar, TopMenuBar, WorkspaceLayout
│   │   ├── sidepanel/SidePanel.tsx    # activeView → 패널 라우터
│   │   ├── explorer/FileTree.tsx      # 파일 트리 (Tauri fs_commands 사용)
│   │   ├── collections/CollectionListPanel.tsx  # 예제: DB 기반 목록 패널
│   │   ├── extensions/ExtensionListPanel.tsx    # 예제: 파일 스캔 목록 패널
│   │   ├── workspace/
│   │   │   ├── CenterWorkspace.tsx    # 탭 바 + 드래그 + 분할 + 콘텐츠 라우팅
│   │   │   ├── EditorTab.tsx          # CodeMirror 편집기 (자동 저장)
│   │   │   ├── ImageViewerTab.tsx     # 이미지 뷰어 (줌)
│   │   │   ├── CodeViewer.tsx         # 읽기 전용 코드 블록
│   │   │   ├── CollectionEditorTab.tsx# 예제: 엔티티 편집 탭
│   │   │   ├── ExtensionViewerTab.tsx # 예제: 매니페스트 뷰어 탭
│   │   │   ├── WelcomeGuide.tsx       # 폴더 없음/시작 가이드
│   │   │   ├── TabPlaceholder.tsx     # 미등록 탭 타입 폴백
│   │   │   └── TrustWorkspaceDialog.tsx # 폴더 신뢰 확인
│   │   ├── language/LanguageSelectDialog.tsx # 첫 실행 언어 선택
│   │   ├── ui/                        # shadcn/ui 프리미티브 (직접 수정 금지, CLI로 추가)
│   │   └── ErrorBoundary.tsx
│   ├── pages/
│   │   ├── Workspace.tsx              # Provider 조립 + ActivityBar 동작 + 시작 탭
│   │   └── Settings/                  # 전체 화면 설정 라우트
│   │       ├── SettingsLayout.tsx     # 좌측 네비 + Outlet (항목 추가 지점)
│   │       ├── SettingsGeneral.tsx    # 테마·언어
│   │       └── SettingsApp.tsx        # 예제: 앱 설정 페이지
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts    # 전역 단축키
│   └── lib/
│       ├── utils.ts / fileIcons.ts
│       ├── types/                     # workspaceTab, settings, collection, extension, fileTree
│       ├── context/                   # concern별 Context (전역 스토어 금지)
│       │   ├── WorkspaceContext.tsx   # workspaceRoot + 신뢰 + 최근 폴더
│       │   ├── WorkspaceTabsContext.tsx # 탭 상태 + 드래그/분할 + 영속화
│       │   ├── SidePanelContext.tsx   # activeView
│       │   ├── SettingsContext.tsx    # AppSettings
│       │   └── ThemeContext.tsx       # light/dark/system
│       ├── i18n/                      # Locale, 사전(ko/en), LanguageContext
│       ├── db/
│       │   ├── client.ts              # 전역/프로젝트 DB + MemorySqlFallback
│       │   ├── migrations/0001_init.sql # 스키마 원본 (client.ts와 동기화 유지)
│       │   └── repositories/          # settingsRepo + 도메인 repo
│       ├── collections/itemsRepo.ts   # 예제: items CRUD
│       └── extensions/scanner.ts      # 예제: .extensions 스캔
└── src-tauri/
    ├── tauri.conf.json        # productName/identifier/창/CSP (교체 대상)
    ├── Cargo.toml
    ├── capabilities/default.json # Tauri 권한 (필요 최소한만)
    └── src/
        ├── main.rs / lib.rs   # 플러그인 + invoke_handler 등록 지점
        └── commands/          # fs/search/shell 명령 (신규 명령 추가 지점)
```

## 어디를 먼저 읽을까

| 목적             | 파일                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| 화면 구조 파악   | `src/App.tsx`(라우트), `src/components/layout/AppShell.tsx`(사이드바·슬롯)                  |
| 워크스페이스 흐름 | `src/components/workspace/Onboarding.tsx`·`Switcher.tsx`, `src/lib/workspace/*`, `src-tauri/src/commands/workspace_commands.rs` |
| 데이터 흐름 파악 | `src/lib/db/client.ts`, `src/lib/db/repositories/settingsRepo.ts`                          |
| 문구 추가        | `src/lib/i18n/dictionaries/ko.ts` + `en.ts`                                                |
| 새 기능 추가     | `Docs/Extension-Guide.md`                                                                  |

## 소유 규칙

- 새 도메인 엔티티는 `src/lib/<도메인>/` + `src/components/<도메인>/` +
  `src/lib/types/<도메인>.ts` 세트를 새로 만듭니다. 기존 예제(`collections`,
  `extensions`)를 복사해 시작하세요.
- `src/components/ui/`는 shadcn CLI로만 추가하고 직접 수정하지 않습니다.
- 파일/폴더명은 이 트리의 위치를 그대로 따릅니다. 구조 변경이 필요하면
  이 문서와 코드를 함께 갱신합니다.

## Vanilla Studio 추가·변경분 (M1 기준)

위 트리는 기반 템플릿 원본이다. 다음이 달라졌거나 추가됐다(설계서 §9가 진실 공급원).

| 위치 | 내용 |
| --- | --- |
| `pnpm-workspace.yaml`, `packages/runtime`, `packages/export-worker` | pnpm 워크스페이스(T1.3). 루트 `typecheck`가 패키지까지 돈다. lint·vitest는 `packages/**`를 자동 포함, `spikes/`는 제외 |
| `packages/runtime/` | `@vanilla/runtime`: `defineScene`·시계·준비 신호·`VanillaCanvas`·Bridge 클라이언트·디자인 Provider·결정성 도우미·`eslint-plugin`(`check_scene`), `vite.ts`(디자인 토큰 플러그인) |
| `src/lib/design/` | DESIGN.md 파서·재작성·역할 파생·대비(S7 이관) |
| `src/lib/project/`, `src/lib/types/project.ts` | `vanilla.json` zod 스키마·마법사 검증·열기·에이전트 접근 판정 |
| `src/components/project/` | `NewProjectWizard`, `ProjectInstall`(pnpm install 동의·로그를 마법사 밖에서 소유) |
| `src/components/doctor/` | Doctor 화면·배지·FFmpeg 동의·설치 다이얼로그 |
| `src/components/layout/shellRegistry.ts` | 액티비티바·탭 종류 등록(pipeline·explorer·agent·templates·playground, brief·plan·prompts·design·review·export) |
| `src/lib/db/migrations/0002_global.sql`, `0003_project.sql`, `0004_playground.sql` | 전역·프로젝트 테이블 골격 + 플레이그라운드 인덱스. `collections`·`extensions` 예제 도메인은 제거됨 |
| 프로젝트 데이터 폴더 | `<project>/.vanilla/`(템플릿의 `.app-data` 대체, `.gitignore` 등록) |
| `resources/project-template/`, `resources/design/` | 새 프로젝트 스캐폴딩 원본, 기본 DESIGN.md. `tauri.conf.json`의 `bundle.resources`로 번들 |
| `src-tauri/src/process/` | 프로세스 실행 공통(PATHEXT·fresh PATH·Job Object·타임아웃), FFmpeg 다운로드 |
| `src-tauri/src/commands/` | 추가: `doctor_commands`, `project_commands`, `process_commands`(앱 소유 프로세스, 고정 argv) |
| `src/lib/design/extract.ts`, `harmony.ts` | 팔레트 추출·조화 생성·비교 스냅샷 순수 함수(T6.9) |
| `resources/skills/` | `vanilla-core` 스킬(T6.1). `tauri.conf.json`의 `bundle.resources`로 번들 |
| `resources/palettes/` | 내장 팔레트 24종(T6.3). 추가 시 `palettes.ts` 명시 import 1줄 |

### v2 V1 기반 정리 반영분

v1 파이프라인·검수·ACP 에이전트·프로젝트 마법사·탭 셸은 제거했다(`v1-final` 태그로 복구, 계획: `wiki/sources/issue-v2-legacy-removal.md`). 위 표에서 `src/lib/project/`·`src/components/project/`·`shellRegistry.ts` 항목과 `0003_project`의 파이프라인 테이블은 더 이상 없다.

| 위치 | 내용 |
| --- | --- |
| `src/lib/workspace/` | `schema.ts`(workspace.json zod·캔버스 프리셋), `file.ts`(읽기·뷰포트 저장), `files.ts`(경로·파일 헬퍼), `api.ts`(Rust 명령 래퍼), `switchGuard.ts`(전환 시 정리할 작업 등록) |
| `src/lib/json/canonical.ts` | 정규화 직렬화(같은 입력 → 같은 바이트) |
| `src/lib/migrate/legacy-schema.ts` | v1 `vanilla.json` 읽기 스키마(마이그레이션 입력, V7) |
| `src/components/layout/AppShell.tsx` | 사이드바(워크스페이스·신·플레이그라운드·설정) + 메인 + 인스펙터·도크 슬롯 |
| `src/components/canvas/` | `WorkspaceCanvas`(@xyflow/react 빈 캔버스, 뷰포트 복원) |
| `src/components/workspace/` | `Onboarding`, `Switcher`, `TrustWorkspaceDialog`(+ v1 탭 뷰어 `EditorTab`·`ImageViewerTab`·`CodeViewer`는 V2 이후 재사용 대기) |
| `src/pages/` | `Workspace`·`Scenes`·`Playground`(빈 화면)·`Settings/*` |
| `src/lib/db/repositories/workspacesRepo.ts` | 최근 워크스페이스·신뢰(전역 DB `workspaces`) |
| `src/lib/db/migrations/0005_v2_global.sql`, `0006_v2_project_cleanup.sql` | `workspaces`·`terminal_sessions`, 프로젝트 DB의 v1 테이블 drop |
| `src-tauri/src/commands/workspace_commands.rs` | 폴더 판별·워크스페이스 생성/열기·스코프 검사 |
| `resources/workspace-template/` | 새 워크스페이스 스캐폴딩 원본(`AGENTS.md`·`CLAUDE.md`·`DESIGN.md`·`package.json`·`vite.config.ts`…) |
| `spikes/r5-canvas/` | PoC R-5 캔버스 스파이크 |

### v2 V2·V3 반영분

| 위치 | 내용 |
| --- | --- |
| `src/lib/scene/` | `schema.ts`(scene.json zod, static·motion·3d), `files.ts`(신 폴더 입출력·상태 갱신), `status.ts`(상태 파생) |
| `src/lib/sequence/` | `sequence.json` 스키마·노드 위치·파일 입출력 |
| `src/lib/guides/` | 가이드 엔진: `markers.ts`(마커 렌더), `template.ts`(템플릿 형식·내장 로더), `merge.ts`(extends 병합 규칙), `resolve.ts`·`catalog.ts`(우선순위 해석), `forms.ts`(인스펙터 폼 정의), `agentsMd.ts`·`guideMd.ts`·`prompts.ts`(생성물), `writeback.ts`(되쓰기 화이트리스트), `templateEditor.ts` |
| `resources/guides/<type>/<id>@<ver>/` | 내장 가이드 템플릿 3종(`template.json`·`schema.json`·`glossary.json`·`rules.md`·`checklist.md`·`prompts/*`) |
| `src/components/scene/`·`inspector/`·`guides/` | 신 노드·생성 다이얼로그·캔버스, 인스펙터(개요·가이드·DESIGN·프롬프트), 용어 콤보박스·beats/steps 편집기·템플릿 편집기 |
| `src-tauri/src/commands/{scene,template}_commands.rs` | 신 폴더 명령, 템플릿 폴더 읽기(읽기 전용·크기 상한·심링크 거부) |
| 워크스페이스 `guide-templates/` | 사용자 정의 템플릿 저장 위치(우선순위 최상위) |

### v2 V4~V7 반영분

| 위치 | 내용 |
| --- | --- |
| `src/lib/agents/`·`src/lib/terminal/`·`src/components/terminal/` | 에이전트 레지스트리(고정 argv)·프롬프트 클립보드 전달·터미널 세션 관리·터미널 도크 |
| `src-tauri/src/commands/{pty,trust}_commands.rs` | 신뢰된 폴더에서만 PTY 실행(레지스트리 키로만 argv), 신뢰 저장 |
| `src/lib/scene/` (추가) | `writeback.ts`(완료 판정·스냅샷·diff·되돌림), `thumbnail.ts`, `check.ts`(계약 검사), `revision.ts`(재생성 변경 필드), `references.ts`·`referenceFrames.ts`, `analysisReview.ts`, `saveAsTemplate.ts` |
| `resources/workspace-template/scripts/check-scene{,-core}.mjs` | `pnpm check:scene`. 코어는 앱과 CLI가 공유(Node 의존 없음) |
| `src-tauri/src/commands/reference_commands.rs` | 영상 레퍼런스 키프레임·메타(FFmpeg 고정 argv) |
| `src/lib/design/` (추가) | `analysis.ts`(분석 마커 구간, CRLF 보존), `extends.ts`(워크스페이스 DESIGN.md 상속) |
| `packages/runtime/src/` (추가) | Bridge v2(`step`·`done`·`choice`·`next`·`prev`)·canvas 주입·`hostedBridge.ts`(신 컴포넌트가 쓰는 호스트 Bridge)·`paramsFiles.ts`(신별 params) |
| `src/lib/sequence/` (추가) | `validate.ts`(교차 검증), `edit.ts`(엣지 연산), `manager.ts`(재생 상태 머신) |
| `src/lib/playground/` (추가) | `iframeScene.ts`(신 iframe + Bridge), `sceneTransitions.ts`, `transitions/`(9종 계획 + WAAPI 실행기 + 선언형 `custom`) |
| `src/components/{playground,canvas,package}/` | `SequencePlayer`, 엣지 편집(`useSequenceEdges`·`EdgeSection`), `.vsx` 공유·가져오기 다이얼로그 |
| `src/lib/package/` | `manifest.ts`(zod)·`api.ts`·`import.ts`(`.vsx`) |
| `src-tauri/src/commands/package_commands.rs` | `.vsx` 만들기(허용 목록·결정적 zip)·검사(zip-slip·심링크·해시)·추출(덮어쓰기 없음) |
| `src/lib/migrate/v1.ts`·`applyV1.ts`, `src-tauri/src/commands/migrate_commands.rs` | v1 프로젝트 읽기(읽기 전용) → 변환 계획 → 적용 |
| `resources/examples/<kind>/<id>/`, `scripts/examples.mjs`, `src/lib/examples/` | 카드용 예제와 `pnpm examples` 도구(D-047). 제작 규칙은 `resources/examples/README.md`. 폴더 추가만으로 등록 |
| `resources/samples/` | 샘플 워크스페이스 4종(motion·static·3d·시퀀스). JSON은 `src/lib/sequence/sample*.test.ts`가 생성·검사 |
| `tests/` | `e2e/`(실제 Chrome E2E 스크립트·하네스·목 에이전트), `fixtures/`(v1 샘플·manifest 골든), `repro/`(재현성) |
| `spikes/r1-transition/` | PoC R-1 전환 합성 스파이크 |
| `Docs/User-Guide/` | v2 사용자 문서 7종(`legacy/`는 v1 보관) |

