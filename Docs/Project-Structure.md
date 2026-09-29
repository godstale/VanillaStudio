# 코드 구조 (Project Structure)

> 새 에이전트·개발자가 이 템플릿을 5분 안에 파악하기 위한 디렉터리 가이드입니다.
> 전체 설계 원칙은 `Docs/Architecture.md`, 확장 절차는 `Docs/Extension-Guide.md`를 참고하세요.

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
| 화면 구조 파악   | `src/pages/Workspace.tsx`, `src/components/layout/*`                                       |
| 탭 동작 파악     | `src/components/workspace/CenterWorkspace.tsx`, `src/lib/context/WorkspaceTabsContext.tsx` |
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
| `src/lib/db/migrations/0002_global.sql`, `0003_project.sql` | 전역·프로젝트 테이블 골격. `collections`·`extensions` 예제 도메인은 제거됨 |
| 프로젝트 데이터 폴더 | `<project>/.vanilla/`(템플릿의 `.app-data` 대체, `.gitignore` 등록) |
| `resources/project-template/`, `resources/design/` | 새 프로젝트 스캐폴딩 원본, 기본 DESIGN.md. `tauri.conf.json`의 `bundle.resources`로 번들 |
| `src-tauri/src/process/` | 프로세스 실행 공통(PATHEXT·fresh PATH·Job Object·타임아웃), FFmpeg 다운로드 |
| `src-tauri/src/commands/` | 추가: `doctor_commands`, `project_commands`, `process_commands`(앱 소유 프로세스, 고정 argv) |
| `src/lib/templates/` | `template.json`·`palette.json` zod 스키마·파서·설치 계획(T6.2). `palette.json` 정본은 `src/lib/design/palettes.ts`, `templates/palette.ts`는 별칭 re-export |
| `resources/skills/` | `vanilla-core` 스킬(T6.1). `tauri.conf.json`의 `bundle.resources`로 번들 |
