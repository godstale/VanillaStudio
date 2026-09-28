<p align="center"><img src="./design/brand/app-banner.svg" alt="WorkspaceTemplate — folder-based Tauri desktop workspace shell" width="100%" /></p>

# WorkspaceTemplate

폴더 기반 데스크탑 앱을 **빠르고 손쉽게 시작**하기 위한 Tauri 2 + React 19 +
TypeScript 스타터 템플릿입니다. 특정 프로젝트의 도메인 로직은 포함하지 않고,
모든 데스크탑 앱에 공통으로 필요한 **앱 셸(레이아웃·탭·파일·설정·다국어·테마·저장소)**만
제공합니다.

## 제공하는 것

- 🖥 **데스크탑 앱 셸**: 좌측 아이콘 사이드바 + 리사이저블 패널 + 우측 탭 콘텐츠
- 📑 **탭 시스템**: 드래그 재정렬, 우클릭 메뉴, **화면 분할**(좌/우/상/하 드롭), 탭 상태 영속화
- 📁 **폴더 기반 동작**: 폴더 열기/최근 폴더/신뢰 확인, 폴더별 프로젝트 DB 분리(`.app-data/`)
- 📝 **파일 뷰어**: CodeMirror 편집기(자동 저장, MD 미리보기·분할 지원) + 이미지 뷰어(줌)
- 🧩 **예제 도메인 2종**: DB 기반 CRUD(`collections`) + 파일 스캔 목록(`extensions`) — 복사해 시작하는 패턴 예제
- 🌐 **한/영 다국어 기본 내장**: 첫 실행 언어 선택, 설정 연동, ko 폴백
- 🌗 **라이트/다크 테마**: `design/tokens.json` 단일 공급원 + WCAG AA 검증 빌드
- 🦀 **Tauri 명령**: 파일 CRUD·트리·검색(grep/find)·셸 실행 (워크스페이스 스코프 강제)
- 🗄 **SQLite 저장소**: 전역 DB + 프로젝트 DB 분리, 테스트·웹 프리뷰용 인메모리 폴백

## 제공하지 않는 것

특정 프로젝트의 도메인 요구사항은 의도적으로 포함하지 않습니다.
필요하면 `Docs/Extension-Guide.md` 절차대로 추가하세요.

## 시스템 요구사항

- **Node.js**: v20.x 이상 (v22.x 권장)
- **pnpm**: 9.x 이상 (npm/yarn 사용 금지 — lockfile 일관성)
- **Rust**: 1.77.2 이상 (stable toolchain)

## 빠른 시작

```bash
# 1. 의존성 설치
pnpm install

# 2. 데스크탑 앱 개발 실행
pnpm tauri dev

# 또는 웹 브라우저 단독 프리뷰 (일부 Tauri 네이티브 기능 제외)
pnpm dev
```

```bash
# 코드 검증
pnpm typecheck
pnpm lint
pnpm test

# 배포용 인스톨러 생성
pnpm tauri build
```

## 새 프로젝트 시작 체크리스트

1. `BRANDING.md`의 교체 체크리스트 수행 (앱 이름·로고·아이콘·식별자).
2. `src/lib/brand.ts`의 `APP_NAME` 변경.
3. `pnpm tauri icon design/brand/app-icon.svg`로 데스크탑 아이콘 생성.
4. 예제 도메인이 필요 없으면 `Docs/Extension-Guide.md` §8 순서대로 제거.
5. 도메인 설계 문서를 새로 작성하고 `Docs/Architecture.md`는 템플릿 원본으로 유지.

## ⌨️ 단축키

| 단축키         | 동작             |
| :------------- | :--------------- |
| `Ctrl+N`       | 새 탭            |
| `Ctrl+W`       | 현재 탭 닫기     |
| `Ctrl+B`       | 사이드바 토글    |
| `Ctrl+Shift+E` | 파일 탐색기 열기 |
| `Ctrl+,`       | 설정 열기        |

## 문서 맵

| 문서                                                     | 내용                                               |
| :------------------------------------------------------- | :------------------------------------------------- |
| [AGENTS.md](./AGENTS.md)                                 | AI 코딩 에이전트 작업 지침 (스택·컨벤션·검증 명령) |
| [Docs/Architecture.md](./Docs/Architecture.md)           | 아키텍처·데이터 모델·보안 규칙의 단일 진실 공급원  |
| [Docs/Project-Structure.md](./Docs/Project-Structure.md) | 디렉터리 구조와 파일 찾기 가이드                   |
| [Docs/Extension-Guide.md](./Docs/Extension-Guide.md)     | 탭·패널·뷰어·설정·명령·DB 추가 절차                |
| [DESIGN.md](./DESIGN.md)                                 | 디자인 시스템(색·타이포·패턴)                      |
| [BRANDING.md](./BRANDING.md)                             | 로고·앱 이름 교체 가이드                           |

## 기술 스택 요약

| 영역          | 채택 기술                                            |
| :------------ | :--------------------------------------------------- |
| Desktop Shell | Tauri 2 (Rust)                                       |
| Frontend      | React 19, TypeScript(strict), Vite 7, Tailwind CSS 3 |
| Component Kit | shadcn/ui("new-york"), Radix UI, lucide-react        |
| Panel Layout  | react-resizable-panels                               |
| Editor        | CodeMirror 6                                         |
| State         | React Context per concern                            |
| Storage       | SQLite (`@tauri-apps/plugin-sql`)                    |
| Routing       | HashRouter (react-router-dom v7)                     |
| i18n          | 자체 사전 방식 ko/en (외부 라이브러리 없음)          |

## 라이선스

[MIT License](./LICENSE)
