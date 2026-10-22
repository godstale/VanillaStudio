# 아키텍처 개요 (Vanilla Studio v2 + 기반 템플릿)

> **문서 버전 v2.0 (2026-10-22)**. 이 문서의 **Part A**는 Vanilla Studio v2의 현재 아키텍처 개요이며, 상세·계약은
> `Docs/Planning/Technical-Design.md`가 진실 공급원이다(충돌 시 그쪽 우선). **Part B(§0 이하)**는 앱이 올라선
> Tauri 워크스페이스 **기반 템플릿**의 구조로, 앱 셸·테마·i18n·SQLite·파일 명령에는 여전히 유효하지만
> 탭 시스템·`collections`·`extensions` 예제 등 일부는 v2에서 제거되었다(각 절에 표시).

---

# Part A. Vanilla Studio v2 아키텍처

## A.1 한눈에 보기

```
┌──────────────────────── Vanilla Studio (Tauri 2 앱) ────────────────────────┐
│ WebView (React 19)                                                           │
│  사이드바(스토리보드·시퀀스·신·템플릿·플레이·설정) · 시퀀스 캔버스(@xyflow/react)   │
│  신 인스펙터/코멘트 · 하단 터미널 도크(xterm) · 플레이그라운드                   │
│  └ <iframe src="http://127.0.0.1:<port>/<scene>/"> 신 미리보기 ◀─ Bridge v2 ─┐ │
│ ───────────── invoke / Channel ─────────────                                │ │
│ Rust Core                                                                   │ │
│  workspace/scene/template/reference_commands : 스캐폴딩·파일 I/O(스코프 강제)  │ │
│  pty_commands (portable-pty)  : 에이전트 CLI를 고정 argv로 실행                │ │
│  process_commands/process/    : 프리뷰 서버(Vite)·pnpm install·ffmpeg         │ │
│  package_commands · workspace_archive : .vsx 패키지, 워크스페이스 zip          │ │
│  doctor_commands · trust_commands · migrate_commands · watch.rs              │ │
│  SQLite 전역 DB: 최근 워크스페이스·설정·터미널 세션                              │ │
└──────────────┬─────────────────────────────────┬────────────────────────────┘
        PTY (cwd = 신 폴더)                spawn (Node 22+)
        ┌──────▼──────┐                 ┌─────────▼──────────┐
        │ Agent CLI   │ ← AGENTS.md 등   │ Vite dev server    │
        │ claude/codex│    파일로 지침     │ 워크스페이스 루트 서빙 │
        └─────────────┘                 └────────────────────┘
```

## A.2 설계 원칙

1. **앱은 에이전트를 조종하지 않는다**(D-022): 지침 파일·프롬프트 생성 + PTY 실행 + 클립보드 전달뿐. 권한·셸 확인은 CLI가 담당. 에이전트 차이는 `src/lib/agents/` 레지스트리가 흡수.
2. **파일이 진실 공급원**(D-023): 워크스페이스·신·시퀀스 내용은 파일, 전역 SQLite는 앱 상태(최근 워크스페이스·설정·터미널 세션)만. 직렬화는 `src/lib/json/canonical.ts`만 사용.
3. **생성물과 사용자 소유물 분리**: `GUIDE.md`·신 `AGENTS.md`·`prompts/*`는 `scene.json`에서 렌더(마커 구간만 갱신), `src/`·`params/`·`DESIGN.md` 본문은 사용자·에이전트 소유.
4. **결정적 런타임**(D-011·D-024): `motion`·`3d` 신은 `useTime()`의 순수 함수. 같은 `t` → 같은 프레임.
5. **워크스페이스 = 시퀀스 1개**(D-029), 화면 규격은 `workspace.json.canvas`에만(D-030).
6. **생성형 AI 배제**(D-006), 외부 리소스는 오픈 라이선스 + `CREDITS.md`.

## A.3 데이터 계층

| 위치 | 내용 | 스키마/코드 |
| --- | --- | --- |
| `workspace.json` | `workspaceId`·이름·캔버스 규격·기본 에이전트·뷰포트 | `src/lib/workspace/schema.ts` |
| `sequence.json` | 신 노드·전환 엣지·시작 신 (static 발신 엣지는 사용자 입력 trigger만) | `src/lib/sequence/schema.ts`, `validate.ts` |
| `scenes/<slug>/scene.json` | 공통 + 타입별(`static`·`motion`·`3d`) 구조화 데이터, 용어는 glossary ID | `src/lib/scene/schema.ts` |
| `scenes/<slug>/` 기타 | `GUIDE.md`·`AGENTS.md`·`prompts/`·`src/`·`params/`·`references/`·`comments.json`·`.vanilla/`(썸네일·이력) | `src/lib/guides/`, `src/lib/scene/` |
| 루트 생성물 | `DESIGN.md`·`WORK_ORDER.md`·`VANILLA_GUIDE.md`·`scripts/`(`vanilla-agent`·`ascii-cwd`·`pack-workspace`) | `resources/workspace-template/` |
| 전역 SQLite | `app_settings`·`workspaces`·`agents`·`terminal_sessions`·`doctor_cache` | `src/lib/db/migrations/0005_v2_global.sql` 외 |
| `.vsx` | 해시 매니페스트 zip (신/시퀀스 공유) | `src/lib/package/`, `package_commands.rs` |

## A.4 주요 모듈 지도

| 영역 | 프런트(`src/`) | Rust(`src-tauri/src/`) |
| --- | --- | --- |
| 워크스페이스·온보딩·히스토리·zip | `lib/workspace/`, `components/workspace/`, `lib/context/WorkspaceContext.tsx` | `commands/workspace_commands.rs`, `workspace_archive.rs`, `trust_commands.rs` |
| 신·가이드·인스펙터 | `lib/scene/`, `lib/guides/`, `components/scene·guides·inspector/` | `commands/scene_commands.rs`, `template_commands.rs` |
| 시퀀스·캔버스·플레이그라운드 | `lib/sequence/`, `lib/playground/`, `components/canvas·playground/` | — |
| 에이전트·터미널 | `lib/agents/`, `lib/terminal/`, `components/terminal/` | `commands/pty_commands.rs` |
| 프리뷰·Bridge·계약 검사 | `lib/review/`(Bridge·프리뷰 서버), `lib/scene/check.ts` | `commands/process_commands.rs`, `process/`, `watch.rs` |
| 레퍼런스 분석 | `lib/scene/references.ts`, `referenceFrames.ts` | `commands/reference_commands.rs`, `process/ffmpeg.rs` |
| 디자인 토큰·팔레트 | `lib/design/`, `components/design/` | — |
| 패키지·마이그레이션 | `lib/package/`, `lib/migrate/` | `commands/package_commands.rs`, `migrate_commands.rs` |
| Doctor | `components/doctor/` | `commands/doctor_commands.rs` |
| 신 런타임 | `packages/runtime/` (`resources/runtime/`에 번들 사본) | — |

## A.5 실행 흐름 요약

1. **신 생성**: 인스펙터 → `scene_commands` 스캐폴딩 → `scene.json` 저장(canonical) → 가이드 엔진이 `GUIDE.md`·`AGENTS.md`·프롬프트 렌더(마커 구간만).
2. **에이전트 실행**: 레지스트리 argv를 `pty_commands`가 신 폴더 cwd로 실행 → 프롬프트는 클립보드(브래킷/플레인 붙여넣기 모드) → 에이전트가 `src/`·`params/` 작성.
3. **미리보기**: `process_commands`가 워크스페이스 루트에서 Vite를 띄움(`node_modules` 없으면 자동 `pnpm install`) → 신 iframe(별도 origin, Tauri IPC 권한 없음)이 Bridge v2로 `ready`/`time`/`capture` 교환 → 썸네일은 여러 시점을 캡처해 점수가 가장 높은 프레임 저장.
4. **시퀀스 재생**: `manager.ts` 상태 머신이 `SceneHandle`·`TransitionRunner`를 주입받아 trigger(`end`·`timeout`·`click`·`key`·`choice`)를 평가하고 두 iframe 오버레이로 전환 합성.
5. **공유**: `.vsx`(신/시퀀스) 또는 워크스페이스 zip. 가져올 때 zip-slip·절대 경로·심링크·암호화 항목 거부, 빈 폴더에만 복원, 신뢰 확인 후 열기.

## A.6 보안 요약

파일 명령은 워크스페이스 스코프 안에서만(심링크 canonicalize 후 재검사) · 앱이 실행하는 프로세스는 고정 argv뿐(D-012) · 신뢰 확인 전에는 에이전트·프리뷰 서버 미시작 · 미리보기 iframe 격리 · 외부 콘텐츠(`.vsx`·템플릿·레퍼런스)는 신뢰할 수 없는 데이터. 표는 `Technical-Design.md` §10.

## A.7 한글 경로 제약 (D-043·D-044)

Node 22.13 리졸버가 특정 한글 음절 경로에서 크래시(exit 3221225477)한다. 워크스페이스 스크립트는 `scripts/ascii-cwd.mjs` 런처가 비ASCII cwd에서 junction 별칭으로 실행하고, vite 명령은 그대로 실행하다 해당 종료 코드일 때만 영문 경로 이전 안내를 출력한다.

---

# Part B. 기반 템플릿 구조 (원본)

> 아래는 Vanilla Studio가 시작한 Tauri 워크스페이스 템플릿의 구조다. v2에서 **탭 시스템(§1.3)·사이드패널(§1.1~1.2)·`collections`/`extensions` 예제(§3.3)는 제거**되었고, 앱 셸은 `AppShell`(사이드바 + 라우트 + 플로팅 인스펙터/터미널)로 대체되었다. 폴더 스코프·테마·i18n·SQLite·Tauri 파일 명령은 그대로 유효하다.

## 0. 한눈에 보는 요약

- **형태**: Tauri 2 기반 데스크탑 앱 (Windows 우선)
- **프런트엔드**: React 19 + TypeScript(strict) + Vite 7
- **UI 시스템**: shadcn/ui("new-york") + Radix UI + Tailwind CSS 3 + lucide-react
- **레이아웃**: 좌측 아이콘 사이드바 + 좌측 리사이저블 패널 + 우측 탭 콘텐츠
  (+ 탭 드래그 재정렬·화면 분할) + 파일 뷰어
- **상태관리**: React Context per concern (Redux/Zustand 등 금지)
- **저장소**: SQLite (`tauri-plugin-sql`) — 전역 DB + 프로젝트별 DB 분리
- **다국어**: ko/en 기본 내장 (`src/lib/i18n`)
- **패키지 매니저**: pnpm
- **라우팅**: react-router-dom v7, **`HashRouter`** 필수
  (Tauri 번들 자산 프로토콜에 SPA fallback이 없으므로 `BrowserRouter` 금지)

---

## 1. 레이아웃

### 1.1 좌측 아이콘 사이드바 (`ActivityBar.tsx`)

데이터 기반 배열, 순수 컨트롤드 컴포넌트, 활성 아이콘에 `bg-primary/10 text-primary` 타일.

```ts
type SidePanelView = 'explorer' | 'collections' | 'extensions' | null;
```

- 아이콘 클릭 시 패널이 없으면 펼치고 해당 뷰로 전환, 이미 활성인 아이콘을 다시 클릭하면 패널이 접힘 (`Workspace.tsx`의 `handleActivityBarSelect`).
- Settings는 `<Link to="/settings">`로 이동 (사이드패널이 아닌 전체 화면 전환).
- 폴더가 열려 있지 않으면 `explorer` 외의 패널은 비활성화.

### 1.2 좌측 패널 (`WorkspaceLayout.tsx` + `SidePanel.tsx`)

- `react-resizable-panels`의 `PanelGroup`(`direction="horizontal"`, `autoSaveId="apptemplate-layout-v1"`).
- 사이드패널: `defaultSize={20} minSize={16} collapsible collapsedSize={0}`, `ImperativePanelHandle` ref로 ActivityBar와 연동.
- 센터: `minSize={40}`.
- `SidePanel.tsx`는 `activeView`에 따라 컴포넌트를 렌더링하는 얇은 라우터.
  새 패널을 추가하는 방법은 `Docs/Extension-Guide.md` 참고.

### 1.3 우측 탭 콘텐츠 (`CenterWorkspace.tsx`)

```ts
type WorkspaceTabType =
  | 'editor'
  | 'image-viewer'
  | 'collection-editor'
  | 'extension-viewer'
  | 'welcome';

interface WorkspaceTab {
  id: string; // 예: "editor:${filePath}", "collection:${itemId}"
  type: WorkspaceTabType;
  title: string;
  meta?: Record<string, unknown>;
  pane?: 'primary' | 'secondary';
}
```

- **멱등 openTab**: 같은 `id`로 열면 기존 탭으로 포커스만 이동. 파일은 `editor:${path}`,
  엔티티는 `<type>:<id>` 규칙으로 id를 만들 것.
- **탭 드래그**: HTML5 draggable. 같은 페인에서는 순서 변경, 다른 페인 탭 위에서는
  해당 위치에 삽입, 탭 스트립 빈 공간에 놓으면 맨 뒤로 이동.
- **화면 분할**: 콘텐츠 영역의 좌/우/상/하 가장자리(35% 기준)에 드롭하면
  `splitTab()`으로 `primary`/`secondary` 2분할. 분할 상태에서는 반대편으로 이동만 가능.
- 우클릭 메뉴: 닫기/왼쪽 닫기/오른쪽 닫기/다른 탭 닫기/모두 닫기 + 분할/이동.
- 탭 콘텐츠는 **모두 마운트 유지 + `hidden` 전환** (비활성 탭 상태 보존).
- 탭 목록/활성 탭은 SQLite `app_settings`에 디바운스(500ms) 저장 후 재시작 시 복원.
- 새 탭 종류를 추가하는 방법은 `Docs/Extension-Guide.md` 참고.

### 1.4 파일 뷰어

- `EditorTab.tsx`: CodeMirror 6 기반 편집기. 텍스트·코드·마크다운(편집/미리보기/분할 3모드) 지원, 500ms 자동 저장.
- `ImageViewerTab.tsx`: `convertFileSrc` + 25~400% 줌.
- `CodeViewer.tsx`: 읽기 전용 코드 블록(구문 강조 내장).

---

## 2. 폴더(프로젝트) 기반 동작

- `TopMenuBar`/`WelcomeGuide`에서 `pick_project_folder`로 폴더를 선택하면
  `WorkspaceContext`가 `workspaceRoot`를 세팅하고 `set_active_workspace`를 호출해
  Rust 측 스코프를 고정합니다.
- 폴더가 없으면 사이드패널은 `explorer`로 강제되고 센터에는 `WelcomeGuide`가 표시됩니다.
- 폴더를 열면 `{workspaceRoot}/.app-data/`가 자동 생성되고 프로젝트 DB가 열립니다.
- **워크스페이스 스코프**: 모든 파일 명령은 `workspace_root` 밖 경로 접근을 거부합니다
  (심링크는 canonicalize 후 재검사). 신뢰하지 않은 폴더에서는 셸 실행을 하지 마십시오.
- **신뢰 확인**: 처음 여는 폴더는 `TrustWorkspaceDialog`로 신뢰 여부를 묻고,
  신뢰한 폴더 목록은 `trusted_workspaces`에 저장됩니다.

---

## 3. 데이터 모델

### 3.1 AppSettings — `src/lib/types/settings.ts`

```ts
export interface AppSettings {
  id: string; // 'singleton'
  openTabs: WorkspaceTab[]; // 프로젝트 DB에만 저장
  activeTabId: string | null; // 프로젝트 DB에만 저장
  theme: ThemeMode;
  language: Locale;
  enabledExtensions: string[];
  trustedWorkspaces: string[];
  lastWorkspaceRoot: string | null;
}
```

### 3.2 저장소 분리: 전역 데이터 vs 프로젝트 데이터

1. **프로젝트 데이터 (`{workspaceRoot}/.app-data/`)**:
   - `app.db`: 해당 폴더의 `items` 예제 테이블 + 탭 상태(`open_tabs`, `active_tab_id`)
   - `logs/`: 런타임 로그, `.gitignore` 자동 생성
2. **전역 데이터** (OS 표준 AppData 디렉터리, `app.db`):
   - 테마·언어·신뢰 폴더·최근 폴더·`last_workspace_root`
3. **동작**: 폴더가 열려 있으면 탭 상태는 프로젝트 DB에만 저장/복원, 나머지는 전역 DB.
   폴더가 없으면 전역 DB가 fallback.

### 3.3 예제 도메인 (교체 대상)

- **Collections** (`items` 테이블, `src/lib/collections/itemsRepo.ts`):
  목록·생성·이름 변경·삭제 + `collection-editor` 탭 패턴의 예제. 실제 프로젝트의
  엔티티 CRUD를 만들 때 이 파일들을 복사해 시작하십시오.
- **Extensions** (`{workspaceRoot}/.extensions/*/extension.json`,
  `src/lib/extensions/scanner.ts`): 파일 스캔 + 활성/비활성 토글 +
  `extension-viewer` 탭 패턴의 예제.

---

## 4. Tauri 명령 (Rust)

`src-tauri/src/commands/`:

| 모듈              | 명령                                                                                                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fs_commands`     | `pick_project_folder`, `set_active_workspace`, `ensure_app_dir`, `get_app_paths`, `read_project_folder_tree`, `read_text_file`, `write_text_file`, `create_file`, `create_folder`, `rename_path`, `delete_path`, `list_dir`, `copy_path`, `reveal_in_explorer` |
| `search_commands` | `grep_files`, `find_files`                                                                                                                                                                                                                                     |
| `shell_commands`  | `run_shell`                                                                                                                                                                                                                                                    |

보안 규칙:

- 파일 명령은 항상 워크스페이스 스코프 안에서만 동작합니다.
- **`run_shell`은 항상 실행 전에 사용자에게 명시적 확인을 받습니다.**
  승인 없는 자동 셸 실행 코드를 작성하지 마십시오.

---

## 5. 다국어 (i18n)

- `src/lib/i18n/dictionaries/ko.ts`·`en.ts`에 평탄한 `키: 문구` 사전, ko 폴백.
- `useLanguage()`의 `t('네임스페이스.키', {param})`으로 표시. `<html lang>` 자동 반영.
- 첫 실행 시 `LanguageSelectDialog`가 언어를 묻고, 설정은 DB(`language`)와
  localStorage에 함께 저장됩니다.
- **새 화면/문구를 추가하면 양쪽 사전에 같은 키를 반드시 추가합니다.**
  LLM 프롬프트 본문·DB 스키마 필드명은 번역 대상이 아닙니다.

## 6. 테마

- `design/tokens.json`이 단일 진실 공급원. 자세한 규칙은 `DESIGN.md`.
- `ThemeContext`가 `light | dark | system`을 저장하고 `<html>` 클래스를 토글.
- 컴포넌트는 `dark:` 변형 없이 **시맨틱 토큰만으로** 양쪽 테마를 처리합니다.

## 7. 단축키

`src/hooks/useKeyboardShortcuts.ts`: `Ctrl+N` 새 탭, `Ctrl+W` 탭 닫기,
`Ctrl+B` 사이드바 토글, `Ctrl+Shift+E` 탐색기, `Ctrl+,` 설정.

## 8. 확장점

새 패널·탭·뷰어·설정 페이지·명령을 추가하는 절차는
`Docs/Extension-Guide.md`를 따릅니다.
