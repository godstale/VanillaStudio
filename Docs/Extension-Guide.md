# 확장 가이드 (Extension Guide)

> 화면·슬롯·뷰어·설정·명령·문구를 추가하는 정석 절차입니다.
> 예제 도메인(`collections`, `extensions`)을 복사해 시작하는 것을 권장합니다.

## 1. 새 화면 추가하기 (v2 셸)

v2 앱 셸(`src/components/layout/AppShell.tsx`)은 왼쪽 사이드바 + 메인 영역 + 우측 인스펙터 슬롯 + 하단 도크 슬롯이다. 탭 시스템은 없다.

1. `src/pages/MyScreen.tsx`에 화면 컴포넌트를 만든다.
2. `src/App.tsx`의 `AppShell` 아래에 `<Route path="/my-screen" element={<MyScreen />} />` 추가.
3. `AppShell.tsx`의 `NAV_ITEMS`에 `{ to, icon, labelKey }` 추가.
4. `ko.ts`·`en.ts`에 `shell.nav.myScreen` 문구 추가.

## 2. 인스펙터·도크 내용 채우기

`AppShell`의 `Slot`(`data-slot="inspector" | "dock"`)이 자리다. 내용 주입 방식(컨텍스트)은 첫 소비자인 V2 인스펙터(T2.11)에서
정하고 이 절을 갱신한다. 패널 크기는 `react-resizable-panels`가 `autoSaveId`(`vs-shell-h`·`vs-shell-v`)로 저장한다.

## 3. 새 뷰어 추가하기 (파일 종류별)

v1의 탭 뷰어(`EditorTab`·`ImageViewerTab`·`CodeViewer`)는 탭 타입(`WorkspaceTab`)을 props로 받는 상태로 남아 있다.
v2에서 재사용할 때는 화면·인스펙터 안의 일반 컴포넌트로 바꾼다. 편집은 `EditorTab`의 자동 저장 패턴
(`read_text_file` → 편집 → 500ms 디바운스 `write_text_file`)을 따른다.

## 4. 새 설정 페이지 추가하기

1. `src/pages/Settings/SettingsXxx.tsx` 작성 (문구는 `settingsXxx.*` 네임스페이스).
2. `SettingsLayout.tsx`의 `NAV_ITEMS`에 `{ path: '/settings/xxx', labelKey, icon }` 추가.
3. `App.tsx`의 `/settings` 자식 `<Route path="xxx" element={<SettingsXxx />} />` 추가.
4. 전역 설정값이면 `AppSettings` + `app_settings` 테이블 + `settingsRepo`에 필드를
   추가하고, `SettingsContext.updateSettings`로 저장합니다.

## 5. 새 Tauri 명령 추가하기

1. `src-tauri/src/commands/`에 모듈을 추가하거나 기존 모듈에 `#[tauri::command]` 함수를 추가합니다.
2. `lib.rs`의 `invoke_handler![...]` 목록에 등록합니다.
3. 필요한 권한만 `capabilities/default.json`에 추가합니다.
4. 프런트에서는 `invoke('<command>', { ... })`로 호출합니다.
5. 파일·셸 명령은 **워크스페이스 스코프 검증**(`resolve_and_verify_workspace_path` 패턴)을
   그대로 따르고, 셸 실행은 항상 사용자 확인을 먼저 받습니다.

## 6. DB 테이블 추가하기

마이그레이션은 `src/lib/db/migrations/*.sql`을 `?raw`로 읽어 `client.ts`가 실행한다(문장 복제 없음).
모든 문장은 `IF NOT EXISTS`로 멱등이다.

1. 범위에 맞는 파일에 `CREATE TABLE`을 추가한다: `0001_init.sql`(전역·프로젝트 공통), `0002_global.sql`(전역 DB만), `0003_project.sql`(프로젝트 DB만). 새 파일이 필요하면 `0004_*`처럼 번호를 잇고 `client.ts`의 `MIGRATION_SQL`에 등록한다.
2. `MemorySqlFallback`의 `execute`/`select`에 해당 테이블 분기를 추가한다(테스트·웹 프리뷰용).
3. `src/lib/db/repositories/<도메인>Repo.ts`에 CRUD를 작성한다.
4. `migrations.test.ts`가 `node:sqlite`로 실제 SQL을 실행해 검증한다. 새 테이블을 기대 목록에 추가한다.

병렬 작업 시 마이그레이션은 레인 A만 추가한다(`Docs/Planning/Parallel-Execution.md` §4).

## 7. 문구(i18n) 추가하기

1. `ko.ts`에 `'네임스페이스.키': '문구'` 추가.
2. `en.ts`에 같은 키 추가 (타입이 `Dict`를 강제하므로 빠뜨리면 컴파일 에러).
3. `t('네임스페이스.키')`로 사용. `{param}` 치환은 `t('키', { param })`.

## 8. 예제 도메인 제거하기

`collections`·`extensions` 예제는 Vanilla Studio M1(T1.4)에서 이미 제거했다. 같은 방식으로 다른 예제를
걷어낼 때의 순서는 다음과 같다.

- 컴포넌트·lib·타입 삭제, `App.tsx` 라우트와 `AppShell`의 `NAV_ITEMS` 항목 제거, 사전 키 제거, 테이블 제거(§6 역순).
- `grep`으로 참조 0건을 확인한다.
