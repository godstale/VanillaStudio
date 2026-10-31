# Vanilla Studio 템플릿

## slide-template — 키노트형 슬라이드 프로젝트

문구(`content.json`)만 바꾸면 발표 슬라이드가 만들어지는 **Vanilla Studio 워크스페이스** 템플릿입니다.
짙은 네이비 + 앰버 한 가지 강조색의 키노트 스타일이고, 레이아웃 14종과 챕터 범퍼(챕터 전환 모션)를 포함합니다.

이 템플릿은 아래 두 실전 덱에서 뽑아낸 뼈대입니다. 완성형 예제가 필요하면 참고하세요.

- [`tests/LLM_and_Vibe_Coding_Day01_v2`](../tests/LLM_and_Vibe_Coding_Day01_v2) — 1일차 덱 (모션 인트로·범퍼 포함)
- [`tests/LLM_and_Vibe_Coding_Day02_v2`](../tests/LLM_and_Vibe_Coding_Day02_v2) — 2일차 덱 (이미지·영상 슬라이드 포함)

> 예제 덱의 이미지(`assets/img/`, `references/images/`, `references/template-design/`)는 저작권 때문에 저장소에 포함하지 않았습니다. 이미지가 필요한 슬라이드는 그대로는 열리지 않으니, 예제는 `content.json`과 레이아웃을 참고하는 용도로 보세요.

### 준비물

- [Node.js](https://nodejs.org) 22, [pnpm](https://pnpm.io) 10 (이 버전으로 검증)
- (선택) Vanilla Studio 앱 — 신 그래프·시퀀스 편집, 코멘트, 썸네일
- (선택) Claude Code 등 에이전트 CLI — 슬라이드 작성을 맡길 때

### 빠르게 시작하기

1. **폴더 복사** — `template/slide-template` 폴더를 원하는 위치에 복사하고 이름을 바꿉니다.
   Windows에서는 가능하면 **영문 경로**(예: `C:\Workspace\my-deck`)를 쓰세요. 한글 경로는 Node가 비정상 종료하는 경우가 있습니다.
2. **의존성 설치** — 복사한 폴더에서 `pnpm install`
3. **재생** — `pnpm play` (브라우저에서 전체 시퀀스가 열립니다. 방향키 → 로 넘기고 `F`로 전체 화면)
4. **Vanilla Studio에서 열기** (선택) — 앱에서 "폴더 열기"로 복사한 폴더를 선택하면 신 그래프가 보입니다.

> 워크스페이스 이름은 `workspace.json`의 `name`입니다. 복사본마다 원하는 이름으로 바꾸세요(`AGENTS.md`·`WORK_ORDER.md` 머리글의 `slide-template` 표기도 같이 바꾸면 좋습니다).

### 내용 바꾸기

슬라이드 문구의 **유일한 원본**은 `storyboard/data/content.json`입니다. 편집 후 다음 한 줄로 신 폴더·시퀀스에 반영합니다.

```bash
node scripts/sync-deck.mjs && pnpm vanilla sync-guides
```

#### `content.json` 구조

```jsonc
{
  "deck": { "title": "...", "course": "표지에 보일 부제", "audience": "청중", "eraFrom": 2020, "eraTo": 2027, "eraTicks": [2020, 2021] },
  "chapters": [{ "id": "ch01", "no": "01", "label": "시작하기" }],
  "bumper": { "kicker": "CHAPTER", "durationSeconds": 4, "before": ["ch02"] }, // 이 챕터 앞에 범퍼 재생
  "scenes": [
    { "key": "s01", "title": "신 제목", "chapter": "ch01", "year": "2023-2025",
      "screens": [ { "id": "s01-cover", "layout": "cover", "heading": "제목\n**강조**" } ] }
  ]
}
```

- 한 **신(Scene)** = 한 폴더(`scenes/<key>-<slug>/`) = 시퀀스의 노드. 한 신 안에 화면(`screens`)이 여러 장 들어갑니다.
- 텍스트 안의 `**단어**`는 강조색, `\n`은 줄바꿈입니다.
- `year`(신 또는 화면)를 쓰면 화면 하단 연표에 시기가 표시됩니다. 쓰지 않으면 연표는 숨겨집니다.
- `build: true`인 화면은 항목이 클릭(→)마다 하나씩 나타납니다.

#### 레이아웃 14종

| layout | 주요 필드 | 용도 |
| --- | --- | --- |
| `cover` | `kicker`, `heading`, `text` | 표지 |
| `divider` | `kicker`, `heading` | 챕터 구분 |
| `statement` | `kicker`, `heading`, `bullets`, `text` | 한 문장 선언 |
| `split` | `figure`, `value`, `heading`, `bullets`, `note` | 그림 + 설명 2단 |
| `cards` | `title`, `sub`, `cols`, `items[{title,text}]` | 카드 그리드 |
| `compare` | `left`/`right {tag,title,tone,bullets}`, `link` | 좌우 비교 |
| `timeline` | `items[{date,title,text}]`, `build` | 연표 목록 |
| `stats` | `items[{value,unit,label}]`, `figure`, `note` | 큰 숫자 |
| `bars` | `items[{label,value,display,tone}]`, `unit`, `max`, `bullets` | 막대 비교 |
| `table` | `cols`, `rows`, `foot` | 표 |
| `quote` | `quote`, `source`, `text`, `note` | 인용 |
| `figure` | `figure {src,caption,paper}` | 큰 그림 한 장 |
| `video` | `videos[{src,caption}]` | 클릭 재생 영상 |
| `versus` | `heading`, `figures`, `link` | 그림 두 장 대결 |
| `hero` / `photo` | `kicker`, `heading` / `lines`, `figure` | 전면 이미지 |

필드 타입 정의는 `shared/deck/content.ts`, 실제 쓰임은 위 예제 덱의 `content.json`에서 찾아볼 수 있습니다.
샘플 `content.json`에는 이미지가 없는 레이아웃만 담겨 있습니다.

#### 이미지·영상

- 이미지는 `assets/img/`, 영상은 `assets/video/`에 넣고 `figure.src`·`videos[].src`에는 **파일명만** 적습니다.
- 외부 이미지는 오픈 라이선스만 쓰고 `CREDITS.md`에 출처와 라이선스를 기록합니다.
- 생성형 이미지/영상 AI 서비스는 쓰지 않는 것이 이 프로젝트의 원칙입니다.

#### 디자인(색·글꼴) 바꾸기

`DESIGN.md` front matter의 `colors`·`typography`만 수정합니다. 신 코드에 색을 직접 쓰지 않습니다(`var(--color-*)` 사용).

### 에이전트에게 맡기기

복사한 폴더에서 에이전트(Claude Code 등)를 실행하면 `AGENTS.md`/`CLAUDE.md`를 읽고 작업합니다. 예:

> `storyboard/01-brief.md`를 아래 내용으로 채우고, 02·03 문서와 `storyboard/data/content.json`을 작성한 뒤
> `node scripts/sync-deck.mjs && pnpm vanilla sync-guides`로 반영해 줘. 샘플 슬라이드는 지워도 돼.
> 주제: …, 청중: …, 분량: 20장

### 폴더 구성

| 경로 | 내용 | 직접 수정 |
| --- | --- | --- |
| `storyboard/` | 기획·설계·비주얼 문서 3종(`01~03`)과 `data/content.json` | ✅ 여기서 시작 |
| `DESIGN.md` | 디자인 토큰 | ✅ |
| `assets/` | 이미지·영상 | ✅ |
| `CREDITS.md` | 외부 리소스 출처·라이선스 | ✅ |
| `scenes/` | 신 폴더(`scene.json`, `src/`). `sync-deck.mjs`가 갱신 | ❌ 보통 손대지 않음 |
| `shared/deck/` | 레이아웃·무대·CSS (모든 슬라이드 공유) | 레이아웃을 바꾸고 싶을 때만 |
| `shared/bumper/` | 챕터 범퍼(분필 스타일 모션) | 〃 |
| `sequence.json` | 신 연결 그래프. `sync-deck.mjs`가 갱신 | ❌ |
| `scripts/`, `vanilla/`, `play/` | 실행 도구·런타임·플레이어 | ❌ |

### 자주 쓰는 명령

```bash
pnpm play                   # 시퀀스 재생
pnpm dev                    # Vite 개발 서버
pnpm check:scene            # 신 검사 (런타임 계약·토큰 사용)
pnpm build                  # 정적 빌드(dist/)
pnpm dist                   # 배포용 zip 생성
pnpm vanilla status         # 워크스페이스·신 요약
```

### 신(Scene)을 늘리거나 줄이기

1. `content.json`의 `scenes`에 새 신(`key`: `s04` 등)을 추가합니다.
2. 신 폴더를 만듭니다: `pnpm vanilla scaffold-scene s04-topic --name "신 제목" --type static --template opus-narrative-deck@1 --intent slide`
   (폴더 이름은 반드시 `<key>-`로 시작해야 합니다.)
3. `node scripts/sync-deck.mjs && pnpm vanilla sync-guides`
4. 신을 지울 때는 `content.json`에서 항목을 지우고 `scenes/` 폴더도 삭제한 뒤 같은 명령을 실행합니다. 시퀀스에서 잠시 빼기만 하려면 신에 `"hidden": true`를 넣습니다.

> `scaffold-scene`의 `--template`은 `.vanilla/resources/guides`가 있어야 인식됩니다. 이 폴더는 Vanilla Studio가 워크스페이스를 열 때 만들어 줍니다.

### 알려 둘 점

- `.vanilla/`(앱 상태·썸네일)와 `node_modules/`, `dist/`는 Git에 포함되지 않습니다. 첫 실행 시 Vanilla Studio가 썸네일을 다시 만듭니다.
- 샘플 챕터 범퍼(`scenes/b02-bumper-ch02`)는 챕터 02 앞에 4초 동안 재생됩니다. 챕터를 바꾸면 해당 범퍼 신의 `src/Scene.tsx`의 `CHAPTER` 값과 `scene.json`의 `custom.bumperBefore`를 함께 맞추세요.
  범퍼가 필요 없으면 `bumper.before`를 비우고 범퍼 폴더를 삭제합니다.
- 인트로 모션(Day01/Day02의 `s00-intro`)은 덱마다 고유한 작품이라 템플릿에 넣지 않았습니다. 필요하면 예제 폴더의 `scenes/s00-intro`를 복사해 사용하세요.
