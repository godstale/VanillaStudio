# BRANDING.md — 로고·앱 이름 교체 가이드

이 템플릿의 브랜드는 전부 **플레이스홀더**입니다. 실제 프로젝트를 시작할 때
아래 체크리스트 순서대로 교체하면 됩니다. 디자인 토큰(`design/tokens.json`,
`theme.css`)은 그대로 유지됩니다.

## 1. 체크리스트

| #   | 할 일                             | 파일                                                                                                       |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | 앱 표시 이름·버전 변경            | `src/lib/brand.ts` (`APP_NAME`, `APP_VERSION`)                                                             |
| 2   | 로고 컴포넌트 교체                | `src/components/brand/AppMark.tsx`                                                                         |
| 3   | 로고 SVG 교체                     | `design/brand/app-mark.svg`, `app-mark-small.svg`                                                          |
| 4   | 파비콘 교체                       | `public/favicon.svg`                                                                                       |
| 5   | 데스크탑 아이콘 재생성            | `pnpm tauri icon design/brand/app-icon.svg`                                                                |
| 6   | 제품명·식별자 변경                | `src-tauri/tauri.conf.json` (`productName`, `identifier`, 창 `title`)                                      |
| 7   | 패키지명 변경                     | `package.json` (`name`)                                                                                    |
| 8   | HTML 타이틀 변경                  | `index.html` (`<title>`)                                                                                   |
| 9   | 저장소 키 접두사 변경(선택)       | `wt_` → 프로젝트 접두사 (`src/lib/i18n/types.ts`, `ThemeContext.tsx`, `WorkspaceContext.tsx`, `client.ts`) |
| 10  | 프로젝트 데이터 폴더명 변경(선택) | `.app-data` (`src-tauri/src/commands/fs_commands.rs`, `client.ts`, `vite.config.ts`)                       |
| 11  | 브랜드 색 변경(선택)              | `design/tokens.json`의 `brand` → `node design/build-theme.mjs`                                             |

## 2. 로고 규격(플레이스홀더 기준)

- `app-mark.svg`: 64×64 viewBox, `currentColor` 단색. 앱 내에서는
  `<AppMark className="text-brand" />`처럼 `text-brand`로 칠합니다.
- `app-mark-small.svg`: 32×32 viewBox, 24px 이하에서 사용합니다.
- `app-icon.svg`: 512×512, 어두운 타일 + 마크. `pnpm tauri icon`의 입력입니다.
- `app-icon-light.svg`: 밝은 배경용 변형입니다.
- 최소 크기는 16px이며, 작은 크기에서는 간소화 마크를 씁니다.

## 3. 사용 규칙

- 브랜드 색(`--brand`)은 **로고에만** 씁니다. 상태·경고 표시에는
  시맨틱 토큰(`success`/`warning`/`destructive`/`info`)을 씁니다.
- 로고에 그라디언트·그림자·광택을 넣지 않습니다.
