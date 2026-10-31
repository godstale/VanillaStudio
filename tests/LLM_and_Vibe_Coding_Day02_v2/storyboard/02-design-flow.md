# 02 — 설계서 (Design Flow)

## 서사 구조

GPT 쇼크 → 코딩 도구의 진화(Copilot → Cursor → Claude Code) → **진화사 01** LLM을 에이전트로(기억·도구·MCP·CLI)
→ **진화사 02** 에이전트의 날갯짓(Plan·Effort·Skill·서브 에이전트·루프·SDD/TDD·독립형·하네스)
→ **진화사 03** 특이점(가속·탈옥·비상·성과) → 맺음말(누가 미래를 보고 있는가).
연도가 있는 화면은 하단 **연대기 바**(2021→2026, 월 단위)에 시점을 표시한다.

## 데이터 구조

1일차와 같은 스키마다.

- `storyboard/data/content.json` — 유일한 문구 원본. `deck{eraFrom,eraTo,eraTicks}`, `chapters[]`, `scenes[]{key,title,chapter,year,screens[]}`.
  화면(`screen`)은 `layout`(cover·divider·statement·split·cards·compare·timeline·stats·bars·figure·quote·hero·photo·table)과
  그 레이아웃의 필드를 가진다. `build: true`면 `items`가 클릭마다 하나씩 드러난다. `**단어**` = 앰버 강조.
  `year`는 `2022`, `2022.11`, `2021.01-2024.11` 형식(월 단위).
- `storyboard/data/items.json` — 도식 데이터와 라벨(탭 코딩 코드, 컨텍스트 스택, LLM+CLI 등식, 사고 강도 단계, 랄프 루프).
- `assets/img/` — 강의자 제공 이미지(ASCII 이름, 큰 이미지는 1920px 이하로 축소).

## 조립 계획

1. `shared/deck/content.ts` — 타입·조회·스텝 계산(`stepsOf`: 화면 1개 = 1스텝, build 화면 = 항목 수만큼), 월 단위 `eraOf`
2. `shared/deck/atoms.tsx` — Rich(강조 파서)·Reveal·Figure(액자 맞춤)·Bullets·Note (1일차 그대로)
3. `shared/deck/diagrams.tsx` — tab-coding·context-stack·equation·effort·loop·manuals·skills·adoption
4. `shared/deck/layouts.tsx` — 레이아웃 14종 (+ 글 없는 도식 화면은 전체 폭 `split--wide`)
5. `shared/deck/DeckShell.tsx` — 1920 무대, 헤더·챕터 칩·연대기 바(선형, 월 단위)·카운터·키 입력
6. `scenes/<slug>/src/Scene.tsx` — `<DeckShell sceneKey="sNN" />` 한 줄. `node scripts/sync-deck.mjs`가 생성
7. `sequence.json` — 23개 신 선형 연결(`key:ArrowRight`, crossfade 500ms)

진행 규칙: 모든 스텝과 엣지는 `key:ArrowRight`. 단독 실행 시 클릭·Space·PageDown·Enter도 다음, ←·PageUp·Backspace는 이전.

## 신 구성 (강의안 Scene → 화면)

| 신 | 챕터 | 화면(step) |
| --- | --- | --- |
| S1 GPT 쇼크 | 01 바이브 코딩의 시작까지 | 표지 · ChatGPT 5일/2개월 · 이전 챗봇 vs ChatGPT · 코드 레드·두려움·열광(순차) |
| S2 프로그래머들의 탐색 | 01 | 활용 4가지 · “물밑의 움직임” |
| S3 GitHub Copilot | 01 | 2022.06 정식 출시 · 삼위일체 VS Code·GitHub·OpenAI(순차, 공통점 Microsoft 배너) |
| S4 탭 코딩 | 01 | 에디터 도식 주석→회색 제안→Tab(순차) · 잘한 것 4 · 단점 5 |
| S5 커서와 코딩 에이전트 | 01 | Copilot vs Cursor · 코딩 에이전트 4 · “Copilot은 옛날 물건” |
| S7 걸음마 | 02 LLM을 에이전트로 | 챕터 구분 · 프롬프트 엔지니어링 · 컨텍스트 스택 · 외부 세계로? |
| S8 도구를 쥔 AI | 02 | ReAct · 도구 사용 4단계(순차) |
| S9 MCP | 02 | MCP 이전/이후 · CI/CD 곳곳의 MCP 툴 5단계(순차) |
| S10 클로드 코드 | 02 | Anthropic 연표(순차) · Claude Code 정식 출시 · 독립 에이전트의 요구 4 · LLM + CLI 앱 = 에이전트 |
| S11 Plan 모드 | 03 에이전트의 날갯짓 | 챕터 구분 · “로그인 기능 넣어 줘” · 파악→계획→확인→수행(순차) · Plan 모드 설명(모드 선택 화면) · “생각을 너무 오래 해” 질문 |
| S12 Thinking Effort | 03 | 사고 강도 도식 · /model + /effort |
| S13 Skill | 03 | MCP 매뉴얼 vs Skill |
| S14 서브 에이전트 | 03 | 문제 3 · 서브 에이전트 · 컨텍스트 엔지니어링 |
| S15 루프 엔지니어링 | 03 | 긴 작업의 벽 · 랄프 루프 · 필수 조건(루프 도식) · 루프 엔지니어링 |
| S16 SDD·TDD | 03 | Coder → Architect & Spec Writer · TDD 3단계(순차) |
| S17 독립형 에이전트 | 03 | 묶인 에이전트 3 · OpenClaw |
| S18 하네스 엔지니어링 | 03 | 왜 하네스인가 · 하네스 4요소 |
| S19 LLM 가속 | 04 특이점 | 챕터 구분 · 출시 42개·간격 38/48일 · 평균 간격 차트 · RSI 80%+ |
| S20 탈옥 | 04 | 통제하고 있는가? · 사건 연표(순차) · 허깅페이스 · 무엇을 보여 주었나 |
| S21 비상 | 04 | 기준의 이동 · GPT-6 Astra · Opus 5.5 쇼릴 · 바이브 디자인 · 상시 비서 · 3종 비교(순차) |
| S22 성과 | 04 | 나비에-스토크스 수치 · 결과 vs 논쟁 · 준-리만 · 과학 · 법률 · 창작(순차) · 보안(순차) · 게임 막대 · Microduck |
| S23 맺음말 | 05 맺음말 | 사용 피라미드(순차) · 마지막 질문 |

## 챕터 범퍼 (motion, 4 s)

각 챕터의 첫 슬라이드 앞에 인트로(S00) 스타일의 짧은 범퍼를 넣는다: S05→**B02**→S07, S10→**B03**→S11, S18→**B04**→S19, S22→**B05**→S23.

- 문구: `storyboard/data/content.json`의 `chapters`(번호·제목)와 `bumper.kicker`. 어떤 챕터 앞에 넣을지는 `bumper.before`.
- 그림·사운드: `shared/bumper/`(Bumper·chalk·sting·timing). 신 폴더 `scenes/bNN-bumper-chNN/`는 챕터 id만 넘기는 얇은 래퍼.
- 연출: 앰버 스파크 → 분필 링 + 세리프 챕터 번호 → `CHAPTER` 타자 → 한글 제목 손글씨 + 앰버 점 → 챕터 레일(지난 챕터 체크, 현재 챕터 스파크) → 링 속으로 zoom-through 후 빈 보드.
- 시퀀스: 슬라이드→범퍼는 `key:ArrowRight`, 범퍼→다음 슬라이드는 `end`(자동 진행). `scripts/sync-deck.mjs`가 scene.json `custom.bumperBefore`로 범퍼 위치를 다시 만든다.
