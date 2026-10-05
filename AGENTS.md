# AGENTS.md — Vanilla Studio 작업 지침

> 이 저장소(Vanilla Studio 앱)를 개발하는 AI 코딩 에이전트와 개발자를 위한 지침입니다.
> Claude Code는 `CLAUDE.md`(→ 이 파일 import)로, Codex·OpenCode 등은 이 파일을 직접 읽습니다.
> **§9 Wiki 규칙과 §10 단계·플레이북 규칙은 모든 작업에서 반드시 지킵니다.**

## 0. 시작하기 전에 반드시 읽을 것

| 순서 | 문서 | 내용 |
| --- | --- | --- |
| 1 | `wiki/index.md` → `wiki/overview.md` | 현재 단계·상태, 관련 지식 조회 |
| 2 | `Docs/Vanilla-Studio-Requirements.txt` | 요구사항 원본(사용자 작성, 수정 금지) |
| 3 | `Docs/Planning/Refactor-Spec-v2.md` | **v2 기획서 — 무엇을 만드는가(Scene 워크스페이스)**. `Product-Spec.md`(v1)는 참고용으로 격하 |
| 4 | `Docs/Planning/Technical-Design.md` | 기술 설계서 v1.0(v2 기준) — **Vanilla Studio 고유 설계의 진실 공급원** |
| 5 | `Docs/Planning/Feasibility-Risks.md` | 구현 난점·리스크·PoC |
| 6 | `Docs/Planning/Decisions.md` | 결정 기록(D-NNN). Proposed 항목은 사용자 확인 전 전제로 삼지 않는다 |
| 6a | `Docs/Planning/Implementation-Plan.md`, `Docs/Planning/TODO.md` | 구현 계획(마일스톤 M1~M7)과 작업 목록. **구현 작업은 TODO 항목 단위로 진행하고 체크한다**. TODO 맨 위 "▶ 진입점"이 다음 작업이다 |
| 6b | `Docs/Planning/Parallel-Execution.md` | 여러 세션 병렬 실행: 웨이브·레인 배치, 소유 경로, 공유 파일 규칙, 세션 시작 프롬프트, 완료 보고 형식 |
| 7 | `Docs/Playbook/README.md` | 개발 단계(P0~P7)별 할 일·산출물 |
| 8 | `Docs/Architecture.md`, `Docs/Project-Structure.md`, `Docs/Extension-Guide.md` | 기반 템플릿 구조(원본 유지). 충돌 시 `Technical-Design.md` 우선 |
| 9 | `DESIGN.md`, `BRANDING.md` | 앱 UI 디자인 토큰·브랜딩 |

## 1. 프로젝트 개요

**Vanilla Studio v2**: ComfyUI형 캔버스 워크스페이스에서 **Scene**(정적 페이지·모션 그래픽·3D 애니메이션)을 만들고,
신 사이를 전환으로 이어 **시퀀스**(PPT·영상·인터랙티브)를 구성하는 Tauri 2 데스크탑 앱.
앱은 신별 가이드·`DESIGN.md`·`AGENTS.md`를 구조화 데이터(`scene.json`)에서 생성하고, 에이전트 CLI(Claude Code·Codex 등)를
내장 터미널에서 실행하며 프롬프트를 클립보드로 전달한다. 결과물은 에이전트가 **코드**로 만들고 앱의 플레이그라운드가 재생한다.
앱은 에이전트를 조종하지 않는다(D-022). 생성형 이미지/영상 AI는 쓰지 않는다(D-006). 작업 폴더 1개 = 워크스페이스 1개 = 시퀀스 1개(D-029).

- 현재 개발 단계: `wiki/overview.md`의 "현재 상태"를 확인한다(단계 전환 시 갱신).
- 기반: Tauri 2 + React 19 워크스페이스 템플릿(앱 셸·탭·폴더·설정·i18n·테마·SQLite).

## 2. 기술 스택 (고정)

- 패키지 매니저: **pnpm** (npm/yarn 사용 금지)
- 프런트: React 19, TypeScript(strict), Vite 7
- UI: shadcn/ui("new-york") + Radix UI + Tailwind CSS 3 + lucide-react
- 레이아웃: react-resizable-panels / 에디터: CodeMirror 6 / 검증: zod
- 상태관리: **React Context per concern만 사용**. Redux/Zustand/Jotai 등 전역 상태 라이브러리 금지.
- 저장소: 내용은 **파일**(`workspace.json`·`scene.json`·`sequence.json` 등), 앱 상태만 SQLite 전역 DB(`@tauri-apps/plugin-sql`)
- 데스크탑 셸: Tauri 2 (Rust), **Windows 우선**
- 라우팅: react-router-dom v7, **`HashRouter`** 필수 (`BrowserRouter` 금지)
- 다국어: 자체 사전 방식 (`src/lib/i18n`), 외부 i18n 라이브러리 없음
- 확정된 추가 스택(설계서 §2): PTY(`portable-pty` + `@xterm/xterm`), 캔버스 `@xyflow/react` ⚠️(PoC R-5 후 확정), zip(`.vsx`).
  ACP·MCP 서버는 제거 대상이다(D-022). export 스택(HyperFrames·`pptxgenjs`·`dom-to-pptx`)은 코드 보존·v2.0 범위 밖(D-027). ⚠️ 표시 항목은 PoC 결과로 확정 후 사용.
- **앱 기능 코드는 GSAP에 의존하지 않는다**(라이선스, D-007). 생성물 코드에서의 선택적 사용만 허용.

새 의존성을 추가하기 전에 기존 라이브러리로 해결 가능한지 먼저 확인하고(YAGNI), 추가 시 라이선스를 확인해
`Docs/Planning/Feasibility-Risks.md` §2.9 표에 기록합니다.

## 3. 코딩 컨벤션

- TypeScript `strict: true`. **`any` 금지** — `unknown` + 타입 가드. 불가피하면 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + 이유 주석.
- 파일/폴더명은 `Docs/Project-Structure.md`와 `Technical-Design.md` §9를 따릅니다. 구조 변경 시 문서와 코드를 함께 갱신합니다.
- 함수형 컴포넌트 + 훅만. 주석은 "왜"만. 요청 범위를 넘는 리팩터링·추상화 금지.
- 화면 문구 하드코딩 금지: `src/lib/i18n/dictionaries/ko.ts`·`en.ts`에 같은 키를 추가하고 `t('키')` 사용.
  **에이전트에게 보내는 프롬프트·가이드 규칙 본문(`resources/guides/**/prompts/*.md`·`rules.md`)과 JSON 필드명·용어 ID는 번역 대상이 아닙니다**(용어집의 `label{ko,en}`만 표시용 번역).
- 색상은 시맨틱 토큰만 (`DESIGN.md` §3.3). 원시 팔레트 클래스 금지.
- 탭 `meta`에는 직렬화 가능한 값만.
- 새 패널·탭·뷰어·설정·명령·테이블은 `Docs/Extension-Guide.md` 절차를 따릅니다.
- 템플릿 예제 도메인(`collections`, `extensions`)은 M1에서 제거 예정 — 새 코드가 의존하지 않게 합니다.

## 4. 도메인 규칙 (Vanilla Studio 고유)

1. **파일이 진실 공급원**(D-023): 워크스페이스·신·시퀀스 내용(`workspace.json`·`scene.json`·`sequence.json`·`DESIGN.md`·`src/`·`params/`·`references/`)은 파일, 앱 상태(최근 워크스페이스·설정·터미널 세션)만 전역 DB. (설계서 §8)
2. **생성물과 사용자 소유물 분리**: `GUIDE.md`·신 `AGENTS.md`·`prompts/*`는 앱이 `scene.json`에서 렌더하는 **생성물**(마커 구간만 갱신, 마커 밖은 보존). `src/`·`params/*.values.json`·`references/analysis/`·`DESIGN.md` 본문은 사용자·에이전트 소유라 **앱이 명시 요청 없이 덮어쓰지 않는다**.
3. **Scene 런타임 계약**(설계서 §4, D-011·D-024): `motion`·`3d` 신의 애니메이션은 `useTime()`의 순수 함수(`static`은 자유 모드). 런타임·스캐폴딩·검사기를 바꿀 때는 결정성(같은 `t` → 같은 프레임)을 깨지 않는지 테스트로 확인.
4. **에이전트 중립**(D-022): 특정 에이전트 전용 기능을 핵심 경로에 넣지 않는다. 차이는 `src/lib/agents/` 레지스트리가 흡수한다. 앱은 에이전트를 터미널에서 실행하고 프롬프트를 전달할 뿐 대화·권한을 중계하지 않는다.
5. **데이터 계약 변경**: `workspace.json`·`scene.json`·`sequence.json`·`references.json`·`template.json`·`manifest.json`·`palette.json`·DESIGN.md 토큰 스키마·Bridge 메시지 스키마를 바꾸면 zod 스키마, 설계서, 가이드 템플릿(`resources/guides`), 버전 필드를 함께 갱신. 직렬화는 `canonical` 함수만 사용한다(같은 입력 → 같은 바이트, 설계서 §8.3).
6. **디자인 토큰 계약**(D-015, D-016): 생성물의 색·타이포·간격은 `DESIGN.md` 토큰에서만 가져온다(CSS `var(--color-*)`, JS `useDesign()`). 앱이 팔레트를 적용할 때는 front matter의 `colors`를 바꾸고, 본문은 이전 색 값이 적힌 곳만 갱신한다(그 외 바이트 보존). 레퍼런스 분석 결과는 본문의 분석 마커 구간에만 쓴다. 승인된 토큰 값은 `params/*.values.json`처럼 사용자 소유로 보호한다.
7. **생성형 AI 배제**(D-006): 이미지/영상 생성 서비스 연동 코드를 추가하지 않는다. 외부 리소스는 오픈 라이선스 + `CREDITS.md` 기록.
8. **워크스페이스 = 시퀀스 1개**(D-029): 다른 시퀀스는 새 워크스페이스로 만든다. `workspaceId`를 workspace·sequence·scene·생성 `AGENTS.md`·클립보드 프롬프트에 기록하고, 에이전트 작업 범위는 cwd 아래로 한정한다. 다른 워크스페이스의 신은 복사로만 가져온다(참조 링크 금지).
9. **화면 규격은 워크스페이스 전역**(D-030): 화면비·해상도·fps는 `workspace.json.canvas`에만 둔다.
10. **정적 페이지는 사용자 입력으로만 진행**(D-032): `static` 신에서 나가는 시퀀스 엣지의 trigger는 사용자 입력(`click`·`key`·`choice`)만 허용하고 검증 단계에서 거부한다.
11. **레퍼런스 분석은 에이전트 태스크**(D-026): 앱은 레퍼런스 등록·키프레임 추출·분석 프롬프트 생성만 한다. URL은 앱이 내려받지 않는다. 레퍼런스는 스타일 분석용이며 산출물에 복제·삽입하지 않는다.
12. **가이드 템플릿**(D-028, D-031): 내장·사용자 정의 템플릿은 같은 형식(schema·glossary·rules·prompts·checklist)이며 사용자 템플릿은 내장 스키마를 **확장만** 할 수 있다. 신은 `template: <id>@<ver>`를 기록하고 공유 패키지에 사용한 사용자 템플릿을 동봉한다.

## 5. 빌드/검증 명령

```bash
pnpm install         # 의존성 설치
pnpm dev             # Vite 개발 서버 (웹 프리뷰만)
pnpm tauri dev       # 데스크탑 앱 개발 실행
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint . --max-warnings=0
pnpm test            # vitest run
pnpm build           # tsc -b && vite build
pnpm tauri build     # 배포용 인스톨러 빌드
python .claude/skills/llm-wiki/scripts/lint.py --save   # wiki 건강 검사
```

코드 작업을 "완료"로 표시하기 전에 최소한 `pnpm lint`, `pnpm typecheck`, `pnpm test`가 통과해야 합니다(Rust 변경 시 `cargo test`도).
문서만 변경한 경우 wiki lint 결과(orphans·broken links 0)를 확인합니다.

## 6. Git / 커밋 규칙

- **기본 브랜치(main)에 직접 커밋하지 않습니다.** 시작 시 `git status -sb` → `git checkout main`(원격이 있으면 `git pull --ff-only`) → `git checkout -b <type>/<short-topic>`.
  브랜치 접두어: `feat/`·`fix/`·`chore/`·`docs/`·`refactor/`·`test/`·`spike/`(PoC).
- **작게 나누어 자주 커밋.** 하나의 커밋 = 하나의 논리 변경. Conventional Commits(`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- **`git push`는 사용자의 명시적 승인 없이 실행하지 않습니다.**
- `--no-verify`, `--force`, `git reset --hard` 등 파괴적/훅 우회 명령은 사용자 명시 지시 없이 사용 금지.
- 비밀 정보 커밋 금지. `.env`, `*.db*`, `.vanilla/`는 커밋하지 않습니다.
- **같은 브랜치에서 2개 이상의 에이전트/작업이 동시에 작업하지 않습니다.** 병렬 구현은 `Docs/Planning/Parallel-Execution.md`의 레인·워크트리·소유 경로 규칙을 따릅니다. 병렬 작업은 `git worktree add ../VanillaStudio-<topic> -b feat/<topic> main`, 끝나면 `git worktree remove`.
- **시작/중간/마지막 git 체크**: 시작(`git status -sb`, `git branch --show-current`) · 중간(범위 이탈 확인, 논리 단위 커밋) · 마지막(`git status -sb`, `git log --oneline -5`, 검증 결과 보고, push는 승인 후).

## 7. 안전/보안 원칙 (특히 중요)

- Tauri 파일 명령은 항상 워크스페이스 스코프 밖 경로 접근을 거부합니다. 심링크는 canonicalize 후 재검사.
- **셸 실행(`run_shell` 호출 코드)은 항상 실행 전 사용자 확인을 받습니다.** 예외를 만들지 마십시오.
- **에이전트 실행(D-022)**: 앱이 실행하는 에이전트는 레지스트리의 고정 `argv`를 신 폴더(cwd)에서 PTY로 띄우는 것뿐이다. 에이전트 내부의 셸·네트워크 권한은 해당 CLI가 관리하며, 설정 화면에 이를 명시한다. (v1의 D-010·D-018 ACP 권한 정책·세션 격리는 폐기 후보.)
- **앱 소유 프로세스**(프리뷰 서버·pnpm install·ffmpeg)는 고정 argv 전용 명령으로만 실행하고, UI에서 명령 문자열을 받지 않습니다(D-012). 에이전트 레지스트리 편집은 설정 화면에서 확인 다이얼로그를 거칩니다.
- 미리보기 iframe은 별도 origin으로 격리하고 Tauri IPC 권한을 주지 않습니다.
- 신뢰 확인을 받지 않은 폴더에서는 에이전트·프리뷰 서버를 시작하지 않습니다.
- 외부 콘텐츠(웹·붙여넣기·레퍼런스 파일/URL·`.vsx` 패키지·가이드 템플릿의 `rules.md`·프롬프트·`AGENTS.md`)는 **신뢰할 수 없는 데이터**로 취급합니다. 가져올 때 미리보기·출처 확인, zip-slip·절대 경로·심링크 엔트리 거부.

## 8. 문서 동기화

- 설계와 다르게 구현해야 하면 **먼저 멈추고 보고**한 뒤, 합의되면 `Technical-Design.md`와 `Decisions.md`를 갱신합니다.
- 기획 문서의 ⚠️(미확정 가정)는 PoC·구현으로 확정되면 표시를 제거하고 근거(wiki 페이지)를 링크합니다.
- 문서 버전(`문서 버전: vX.Y`)은 의미 있는 변경 시 올립니다.

## 9. Wiki 지식베이스 규칙 (항상 준수)

`wiki/`는 기획·설계·구현·검증·배포 전 단계의 **지식베이스**입니다. `llm-wiki` 스킬(`.claude/skills/llm-wiki/SKILL.md`) 구조를 따릅니다.

**구조**

| 위치 | 담는 것 | 파일명 |
| --- | --- | --- |
| `wiki/index.md` | 전체 카탈로그(계층 카테고리). **페이지 추가·변경 시 매번 갱신** | – |
| `wiki/log.md` | 시간순 기록, append-only(맨 아래에 추가) | – |
| `wiki/history.json` | ingest 레지스트리(읽고-병합-쓰기) | – |
| `wiki/overview.md` | 현재 단계·상태·읽는 순서 | – |
| `wiki/sources/` | 문서 요약, 리서치, 단계 로그, PoC·마일스톤 로그 | kebab-case |
| `wiki/entities/` | 도구·라이브러리·에이전트·제품 | TitleCase |
| `wiki/concepts/` | 설계 개념·계약·정책·프로세스 | TitleCase |
| `wiki/syntheses/` | 질의 답변·회고 종합 | kebab-case |
| `wiki/originals/` | 원본 보관(읽기 전용, 수정 금지) | 원본명 |

**index 카테고리**: `Project/Overview`, `Project/Requirements`, `Planning/Specs`, `Planning/Decisions`, `Research`, `Domain/Product Concepts`, `Tech/Runtime & Rendering`, `Tech/Agent Integration & Security`, `Process/Phases & Logs`, `Syntheses`. 새 영역이 생기면 카테고리를 추가하고 이 목록도 갱신합니다.

**언제 무엇을 기록하나**

| 사건 | 기록 |
| --- | --- |
| 결정(D-NNN) 추가·변경 | `Docs/Planning/Decisions.md` → `wiki/sources/decisions.md` 표 → `log.md` |
| 외부 리서치 | `wiki/sources/research-<date>-<topic>.md`(출처 URL 필수) + 관련 entity/concept |
| PoC 수행 | `wiki/sources/poc-<id>.md`(목표·방법·결과·수치·결론·설계 반영) |
| 마일스톤 완료 | `wiki/sources/milestone-<id>.md`(한 일·결정·문제·해결·교훈) |
| 비자명한 버그 해결 | 관련 concept 페이지의 "Pitfalls" 절 또는 `sources/issue-<topic>.md` |
| 단계(Phase) 종료 | `wiki/sources/phase-<id>-<name>.md` + `overview.md` 현재 상태 갱신 |
| 기획/설계 문서 개정 | 해당 source 페이지 요약·`last_updated` 갱신 |

**작성 규칙**

- 모든 페이지는 frontmatter(`title`, `type`, `tags`, `sources`, `last_updated`)와 `[[WikiLink]]` 연결을 가집니다(대소문자 구분).
- 원문 문서를 통째로 복사하지 않습니다. 요약 + 원문 경로(`source_file`)를 남깁니다. `Docs/`가 진실 공급원, wiki는 색인·요약·경험 기록.
- 작업 시작 시 `wiki/index.md`에서 관련 페이지를 먼저 조회하고, 작업 종료 시 기록합니다.
- 기록 후 `python .claude/skills/llm-wiki/scripts/lint.py --save`로 orphans·broken links 0을 확인합니다.
  (이 스크립트는 `log.md` **맨 위**에 lint 항목을 추가하므로 맨 아래로 옮겨 append-only 순서를 유지합니다.)

## 10. 개발 단계 운영과 플레이북 규칙 (항상 준수)

이 프로젝트는 **P0 준비 → P1 요구사항 → P2 상세 기획 → P3 구현 계획(+PoC·TODO) → P4 구현 → P5 검증·수정 루프 → P6 릴리스·배포 → P7 회고·템플릿화** 단계로 진행합니다.
각 단계의 할 일·입력·산출물·게이트는 `Docs/Playbook/README.md`가 정의합니다.

이 과정은 **비슷한 앱을 새로 만들 때 재사용할 템플릿이자 바이브 코딩 강의 자료**로 쓰입니다. 따라서:

1. **단계 시작**: `Docs/Playbook/README.md`의 해당 단계와 `wiki/overview.md`를 읽고, 산출물 목록을 확인합니다.
2. **단계 진행 중**: 산출물은 `Docs/Playbook/templates/`의 양식을 사용합니다. 사용자가 준 **핵심 프롬프트 원문**과 인터뷰 Q&A를 보존합니다.
3. **단계 종료** 시 반드시:
   - `wiki/sources/phase-<id>-<name>.md` 단계 로그(양식: `Docs/Playbook/templates/Phase-Log-Template.md`) — 입력·활동·산출물·결정·문제·**재사용 가능한 교훈**·지표
   - `Docs/Playbook/prompts/P<n>-*.md`의 "실제 사용 원문"에 이번 단계 핵심 프롬프트 추가 + 일반화 템플릿 보강(`{{변수}}`)
   - `Docs/Playbook/User-Checklist.md`에 사람이 직접 해야 했던 일 추가
   - 다른 프로젝트에도 통하는 절차·양식이 생기면 `Docs/Playbook/`에 일반화해 반영
   - `wiki/overview.md` 현재 단계 갱신
4. 기록 원칙: **진행 기록(무슨 일이 있었나)은 wiki**, **재사용 자료(어떻게 하면 되나)는 Playbook**. 같은 내용을 두 곳에 복사하지 않고 링크합니다.
5. 단계 게이트를 건너뛰어야 하면(예: PoC 없이 구현) 사용자 승인을 받고 `Decisions.md`에 기록합니다.
