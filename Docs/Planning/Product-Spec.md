# Vanilla Studio 상세 기획서 (Product Spec)

- 문서 버전: v0.3 (2026-09-29) — v0.2: 디자인 시스템(`DESIGN.md`)·컬러 팔레트(§8, D-015~D-017) / v0.3: 결정 D-011~D-014·D-017 확정 반영(시간 함수 계약 범위, MCP 도구 M)
- 입력: `Docs/Vanilla-Studio-Requirements.txt`, 인터뷰 결정(`Docs/Planning/Decisions.md`)
- 관련 문서: `Docs/Planning/Technical-Design.md`(기술 설계), `Docs/Planning/Feasibility-Risks.md`(구현 난점·리스크)
- 상태: 초안 — 구현 계획서 작성 전 PoC 결과에 따라 갱신

---

## 1. 제품 정의

### 1.1 한 줄 정의

> **코딩 에이전트가 브라우저 기술(HTML/CSS/JS·React·three.js)만으로 웹 페이지·슬라이드·이미지·2D/3D 영상·인터랙티브 페이지를 만들고, 사용자는 기획·검수·미세조정에 집중하는 데스크탑 디자인 스튜디오.**

### 1.2 핵심 원칙

| # | 원칙 | 기획상 의미 |
| --- | --- | --- |
| P1 | **최소 제약** | 출력 플랫폼은 브라우저. 결과물 형식이 달라도 제작은 같은 Scene 런타임에서 한다. |
| P2 | **생성형 AI 배제** | 이미지·영상 생성 서비스 미사용. 절차적 생성 + 사용자 자료 + 오픈 라이선스 리소스(출처 기록 필수). (D-006) |
| P3 | **기획 → 프롬프트 → 코드** | 에이전트는 바로 코딩하지 않는다. 기획서와 구현 계획서(프롬프트)를 먼저 만들고 사용자가 확인한다. |
| P4 | **작은 단위부터 쌓기** | Asset → Animation → Scene → Composition 순서로 구현한다. |
| P5 | **사람은 조절, 에이전트는 생성** | 사용자의 수동 조절 값(파라미터)과 에이전트의 코드는 분리 저장되어 서로 덮어쓰지 않는다. |
| P6 | **에이전트 중립** | Claude Code·Codex·OpenCode·Hermes·AGY 중 무엇을 써도 같은 산출물 구조를 만든다. |
| P7 | **모든 것은 파일** | 프로젝트 상태는 폴더 안 파일이 진실 공급원. DB는 UI 상태·인덱스용. |
| P8 | **디자인은 토큰으로** | 색·타이포·간격은 프로젝트 `DESIGN.md`의 토큰에서만 가져온다. 코드에 색을 하드코딩하지 않으므로 팔레트만 바꿔도 같은 형태의 결과물이 다른 느낌을 낸다. (D-015, D-016) |

### 1.3 대상 사용자

- **1차**: 코딩 에이전트 구독이 있는 개발자·디자이너·마케터·강연자. 코드를 직접 짜지는 않아도 결과물을 보고 판단할 수 있는 사람.
- **2차**: 템플릿을 만들어 배포하려는 크리에이터(템플릿 = Agent Skill).

### 1.4 범위 밖 (Non-Goals, MVP)

- 이미지/영상 생성형 AI 연동, 자체 LLM API 호출(앱이 API 키를 다루지 않음)
- 키프레임 편집기·캔버스 직접 조작(드래그 편집) — 2차 후보
- 오디오 편집(배경음 삽입은 2차), 실시간 협업, 클라우드 렌더
- PPT 내 애니메이션, macOS/Linux 공식 지원(2차)
- 플레이그라운드 서버(다른 사람 작품 조회) — 3차

---

## 2. 결과물 유형 (Output Types)

모든 유형은 **Scene의 집합 + 포맷 규격**으로 표현하며 같은 React 런타임을 쓴다(D-011).
애니메이션 작성 방식은 유형에 따라 다르다. `video`·`image`·`slides`(캡처 export)는 **시간 함수 계약**(같은 `t` → 같은 화면)이 필수다. `web`·`interactive`는 **자유 모드**로 실시간 애니메이션 코드를 허용한다.

| 유형 | ID | 규격(기본값) | Scene 구성 | Export (MVP) | 비고 |
| --- | --- | --- | --- | --- | --- |
| 웹 페이지 | `web` | 반응형, 기준 폭 1440/390 | 섹션 = Scene, 스크롤로 연결 | 정적 사이트 zip, 임베드 패키지 | 스크롤 연동 애니메이션 허용 |
| 인터랙티브 2D/3D | `interactive` | 1920×1080 또는 전체 화면 | 1개 이상 | 정적 사이트 zip, 임베드 패키지 | 입력(마우스·키·스크롤·터치)에 카메라/에셋 반응 |
| 슬라이드 | `slides` | 1920×1080 (16:9) | 슬라이드 = Scene | PPTX(이미지), PPTX(편집 가능, Beta), PDF, HTML 덱 | 슬라이드 내 빌드 애니메이션은 HTML 덱에서만 |
| 이미지 | `image` | 1080×1080 / 1080×1350 / 1920×1080 / 사용자 지정 | 이미지 = Scene(변형 여러 개 가능) | PNG, JPG, WebP (@1x/@2x) | 캠페인 이미지 세트 = 여러 규격 변형 |
| 동영상 2D/3D | `video` | 1920×1080, 30fps, 15초 | 타임라인 위 Scene 연속 | MP4(H.264), WebM, 포스터 PNG | 투명 배경 export는 Beta |

**임베드 패키지**(요구사항 "React + three.js 앱에서 사용할 수 있는 패키지"):
정적 빌드 결과 + `mount(element, { params })` ES 모듈 + React 래퍼 `<VanillaScene>` + Web Component `<vanilla-scene>`.
React가 아닌 환경에서도 쓸 수 있도록 **Web Component를 범용 인터페이스**로 하고 React 래퍼는 얇게 제공한다.

---

## 3. 사용자 여정 (제작 파이프라인)

요구사항 문서의 7단계를 앱의 **6개 파이프라인 단계**로 매핑한다. 좌측 "파이프라인" 패널이 현재 단계와 완료 상태를 보여준다.

```
[1 Brief] → [2 Plan 기획서] → [3 Prompts 구현계획서] → [4 Build 구현] → [5 Review 검수] ⇄ (수정 요청) → [6 Export]
   사용자        에이전트 작성            에이전트 작성              에이전트 실행        사용자 확인·조절               앱
               사용자 승인 ✔           사용자 승인 ✔
```

### 3.1 단계 1 — Brief (결과물 지정 + 자료 제공)

- **새 프로젝트 마법사**: ① 결과물 유형 ② 규격(해상도·fps·길이·슬라이드 수·이미지 변형) ③ 디자인 템플릿(선택/없음) ④ **컬러 팔레트**(템플릿 기본 / 라이브러리에서 선택 / 브랜드 색 입력 / 자료에서 추출, §8.2) ⑤ 사용할 에이전트 ⑥ 저장 폴더.
- 마법사 완료 시 앱이 프로젝트 폴더를 스캐폴딩한다(§6). 이때 템플릿의 `DESIGN.md`(없으면 기본 `DESIGN.md`)에 선택한 팔레트를 적용해 프로젝트 루트에 둔다(§8.1). `pnpm install`·git 초기화는 이 시점에 1회 동의받고 실행(D-012, D-013).
- **Brief 편집기**: 목적, 대상, 핵심 메시지, 톤앤매너, 브랜드 색·폰트(있으면), 필수 포함 요소, 금지 사항, 참고 자료를 입력하는 구조화 폼 + 자유 서술. 저장 위치 `brief/brief.md`.
- **자료 업로드**: 이미지·로고·텍스트·PDF·CSV 등을 `brief/materials/`로 복사. 라이선스/출처 메모 입력란.

**산출물**: `brief/brief.md`, `brief/materials/*`, `vanilla.json`, `DESIGN.md`(초기본)

### 3.2 단계 2 — Plan (기획서)

- 사용자가 "기획서 생성"을 누르면 앱이 에이전트에게 **기획 프롬프트**(브리프 + 템플릿 스킬 + 규격)를 보낸다.
- 에이전트는 세 파일을 쓴다:
  - `DESIGN.md` — 프로젝트 디자인 시스템(§8.1). 초기본을 브리프·무드에 맞게 다듬는다. 색·타이포 토큰과 사용 원칙은 여기에만 쓴다.
  - `plan/plan.md` — 사람용 기획서(콘셉트, 무드, Scene별 설명, 스토리보드 서술). 색·타이포는 `DESIGN.md`의 토큰 이름으로 언급한다.
  - `plan/plan.json` — 기계용 구조(스키마 §7.1): Scene 목록, Scene 내 Asset 배치, Asset 움직임, 애니메이션 타임라인, **각 요소의 최적 구현 방법**, **사용자 조절 가능 범위(params)**
- 앱은 `plan.json`을 스키마로, `DESIGN.md`를 형식 검사(구조·토큰 참조·필수 색 역할·대비)로 검증하고, 실패하면 오류 목록을 에이전트에게 자동 재요청한다(최대 2회, 이후 사용자에게 표시).
- **기획서 뷰어**: Scene 카드(스토리보드), Asset 목록, 타임라인 막대 차트, 파라미터 목록, **디자인 시스템 요약(팔레트 스와치·타이포 샘플)** 을 시각화. `plan.md`는 마크다운 미리보기.
- 사용자는 코멘트를 달아 "기획 수정 요청"하거나 **승인**한다. 승인 시 체크포인트 커밋. 이 단계에서 팔레트를 바꿔 보며 무드를 정할 수 있다(에이전트 재호출 없음).

**산출물**: `DESIGN.md`, `plan/plan.md`, `plan/plan.json` (승인됨)

### 3.3 단계 3 — Prompts (구현 계획서)

- 승인된 기획서를 바탕으로 에이전트가 구현 계획서(프롬프트)를 작성한다.
  - `prompts/00-master.md` — 전체 구현 순서와 원칙(Asset → Animation → Scene → Composition)
  - `prompts/assets/<asset-id>.md`, `prompts/animations/<anim-id>.md`, `prompts/scenes/<scene-id>.md` — 개별 구현 계획서
  - `prompts/tasks.json` — 태스크 목록(id, 종류, 대상, 프롬프트 경로, 의존성)
- **프롬프트 편집기**: 트리(마스터/에셋/애니메이션/씬) + CodeMirror 편집. 사용자가 직접 수정 가능.
- 태스크 그래프 뷰: 의존성 순서와 상태(대기/진행/완료/실패).
- 사용자 **승인** 시 체크포인트 커밋.

**산출물**: `prompts/**` (승인됨)

### 3.4 단계 4 — Build (구현)

- "빌드 시작" → 앱이 `tasks.json`의 위상 정렬 순서대로 태스크를 하나씩 에이전트에게 보낸다(태스크 = ACP 프롬프트 1회).
- 에이전트는 색·타이포를 `DESIGN.md` 토큰(CSS 변수 `--ds-*`, JS `useDesign()`)으로만 쓴다(§8.1).
- 각 태스크 완료 후: ① 런타임 계약 검사(`check_scene`, 하드코딩 색상 경고 포함) ② 스냅샷 생성 ③ 체크포인트 커밋 ④ 다음 태스크.
- 사용자는 **에이전트 패널**에서 진행 로그(메시지·도구 호출·파일 diff)를 보고, 권한 요청에 응답하고, 일시정지/중단할 수 있다.
- 실행 모드: `자동(순차 전체)` / `한 단계씩(태스크마다 확인)`.
- 에이전트는 MCP 도구 `snapshot_scene`로 자기 결과물을 확인하고 스스로 개선할 수 있다(D-014).

**산출물**: `src/**`, `params/*.values.json`(기본값), 태스크 상태, 체크포인트

### 3.5 단계 5 — Review (검수)

**검수 스튜디오** 탭이 핵심 화면이다.

```
┌───────────────────────────────────────────────────────────────┬───────────────────┐
│ Scene 목록 │           미리보기 (iframe, 규격 비율 유지)        │ 파라미터 패널      │
│  ▸ S1 인트로│                                                   │  ▸ Scene: S1       │
│  ▸ S2 제품 │                                                   │   색상 [■ #F5E6C8] │
│  ▸ S3 CTA  │                                                   │   제목 [........]  │
│            │                                                   │   속도 ──●── 1.2x  │
│ 에셋/애니   │                                                   │  ▸ Asset: logo     │
│  ▸ logo    ├───────────────────────────────────────────────────┤   회전 ─●── 15°    │
│  ▸ particles│ ▶ ❚❚  00:03.20 / 00:15.00  ─────●──────────────  │ [기본값] [저장]    │
│            │ S1 ▇▇▇▇ S2 ▇▇▇▇▇▇ S3 ▇▇▇  (타임라인 스크러버)       │                   │
├────────────┴───────────────────────────────────────────────────┴───────────────────┤
│ 수정 요청: 대상 [S2 ▾] 시각 [00:03.20] 코멘트 [......................] [요청 보내기]  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **미리보기**: 프로젝트의 프리뷰 서버(Vite)를 iframe으로 표시. 규격 비율 유지, 확대/맞춤, 배경(체커보드) 토글, 기기 프레임(웹: 데스크탑/모바일 폭).
- **타임라인 스크러버**(`video`, 시간 함수 계약을 따르는 Scene): 재생/정지, 프레임 단위 이동, 구간 반복, Scene 경계 표시. 슬라이드는 이전/다음, 이미지는 변형 전환. `web`·`interactive`(자유 모드)는 재생/일시정지·새로고침만 제공한다(D-011).
- **파라미터 패널**: `plan.json`에서 선언되고 코드에서 등록된 파라미터를 폼으로 조절(색·숫자 슬라이더·텍스트·선택·토글·벡터). 변경 즉시 미리보기 반영, `저장` 시 `params/<scene>.values.json`에 기록 + 체크포인트.
- **디자인 패널**(파라미터 패널 옆 탭 `파라미터 | 디자인`): 현재 팔레트 스와치, 팔레트 라이브러리에서 교체, 역할별 색 편집, 대비 경고. 교체하면 **저장 전에 미리보기에 바로 반영**되고, `적용` 시 `DESIGN.md`의 `colors` 토큰만 갱신 + 체크포인트(§8.2).
- **팔레트 비교**(S): 현재 Scene·시각을 여러 팔레트로 스냅샷해 나란히 비교하고 하나를 고른다.
- **인터랙티브 테스트**: 미리보기에서 직접 마우스/키 입력.
- **수정 요청 (요구사항 6-2)**: 대상(Scene/Asset/Animation) + 시각 + 코멘트 + (자동) 현재 스크린샷·파라미터 값 →
  ① `reviews/R-NNN.md` 생성 ② 대상 구현 계획서에 "Revision R-NNN" 섹션 추가 ③ 에이전트에 반영 요청 ④ 완료 시 새 체크포인트와 **이전/이후 비교**(스크린샷 나란히).
- **체크포인트 히스토리**: 목록, 비교, 되돌리기.

**산출물**: `params/*.values.json`(사용자 조절값), `DESIGN.md`(팔레트 변경 시), `reviews/**`, 체크포인트

### 3.6 단계 6 — Export

- 유형별 export 옵션 다이얼로그(§2 표) → 백그라운드 작업(진행률·로그·취소) → `exports/<timestamp>-<format>/`에 저장.
- 완료 후 "플레이그라운드에 추가" 선택 가능.

**산출물**: `exports/**`

---

## 4. 정보 구조 (IA)와 화면

템플릿의 앱 셸(액티비티바 + 사이드패널 + 탭 + 분할)을 그대로 사용한다.

### 4.1 액티비티바 (좌측 아이콘)

| 순서 | 아이콘 뷰 | 사이드패널 내용 | 폴더 필요 |
| --- | --- | --- | --- |
| 1 | 파이프라인 `pipeline` | 6단계 진행 상태, 단계별 바로가기, 태스크 목록 | ✔ |
| 2 | 탐색기 `explorer` | 파일 트리(템플릿 기능) | ✔ |
| 3 | 에이전트 `agent` | 세션 목록, 연결 상태, 에이전트 전환 | ✔ |
| 4 | 템플릿 `templates` | 설치된 디자인 템플릿·**팔레트 라이브러리** 목록·검색(하위 탭) | — |
| 5 | 플레이그라운드 `playground` | 보관된 결과물 목록 | — |
| 하단 | 설정 `/settings` | 전체 화면 | — |

템플릿 예제 도메인(`collections`, `extensions`)은 제거한다.

### 4.2 탭(센터) 종류

| 탭 타입 | id 규칙 | 설명 |
| --- | --- | --- |
| `welcome` | `welcome` | 최근 프로젝트, 새 프로젝트, 환경 점검 상태 |
| `brief` | `brief` | Brief 편집기 + 자료 목록 |
| `plan` | `plan` | 기획서 뷰어(스토리보드·타임라인·파라미터) |
| `prompts` | `prompts` | 구현 계획서 트리 + 편집기 + 태스크 그래프 |
| `design` | `design` | 디자인 시스템: `DESIGN.md` 토큰 시각화(스와치·타이포 샘플·간격·모서리) + 원문 편집 + 검사 결과 |
| `review` | `review` | 검수 스튜디오 |
| `export` | `export` | export 옵션·작업 이력 |
| `agent-session` | `agent:<sessionId>` | 에이전트 대화·도구 호출·diff 로그 (ACP) |
| `terminal` | `terminal:<id>` | 내장 터미널 (PTY 폴백) |
| `template-viewer` | `template:<id>` | 템플릿 상세·미리보기 |
| `palette-editor` | `palette:<id>` | 팔레트 편집(역할별 색, OKLCH 조정, 잠금, 대비 표, 조화 생성) |
| `playground-item` | `playground:<id>` | 결과물 플레이어 |
| `editor`, `image-viewer` | 기존 | 템플릿 기능 유지 |

### 4.3 에이전트 도크

에이전트 대화는 어느 탭에서든 보이도록 **우측 도크 패널**(접기 가능)로도 제공한다. 입력창, 진행 중 태스크, 권한 요청 배지, 중단 버튼.

### 4.4 설정

- 일반(테마·언어) — 기존
- **에이전트**: 에이전트별 실행 방식(ACP/터미널), 실행 명령, 기본 에이전트, 권한 정책 표시
- **환경 점검(Doctor)**: Node 22+, pnpm, git, 각 에이전트 CLI, FFmpeg, Chrome/Chromium 상태 + 설치 안내/다운로드
- **Export 기본값**: 품질, 코덱, 출력 폴더
- **템플릿·팔레트**: 템플릿 폴더 경로, 가져오기, 사용자 팔레트 가져오기/내보내기

---

## 5. 기능 명세 (MVP)

우선순위: **M** = MVP 필수, **S** = MVP 희망(일정 여유 시), **L** = 이후.

### 5.1 프로젝트

| ID | 기능 | 우선 |
| --- | --- | --- |
| F-PRJ-01 | 새 프로젝트 마법사(유형·규격·템플릿·에이전트·폴더) | M |
| F-PRJ-02 | 프로젝트 스캐폴딩(§6 구조, 런타임·스킬·AGENTS.md 설치) | M |
| F-PRJ-03 | 기존 프로젝트 열기/최근 프로젝트 | M |
| F-PRJ-04 | 체크포인트(git 자동 커밋)·히스토리·되돌리기 | M |
| F-PRJ-05 | 프로젝트 복제(다른 결과물 유형으로 파생) | L |

### 5.2 에이전트

| ID | 기능 | 우선 |
| --- | --- | --- |
| F-AGT-01 | ACP 세션 생성/프롬프트 전송/스트리밍 표시/취소 | M |
| F-AGT-02 | 권한 요청 다이얼로그(D-010 정책) | M |
| F-AGT-03 | 도구 호출·파일 diff 표시 | M |
| F-AGT-04 | 내장 터미널(PTY)로 CLI 실행 — 폴백 | M |
| F-AGT-05 | 에이전트 레지스트리(Claude Code·Codex 공식, OpenCode·Hermes·AGY 실험적) | M |
| F-AGT-06 | 앱 MCP 도구(`snapshot_scene`·`check_scene`·`get_review`·`update_task_status`) — D-014로 M 격상 | M |
| F-AGT-07 | 세션 재개(앱 재시작 후 이어가기) | S |
| F-AGT-08 | 태스크별 에이전트 지정(예: 기획은 Claude, 셰이더는 Codex) | L |

### 5.3 파이프라인

| ID | 기능 | 우선 |
| --- | --- | --- |
| F-PIP-01 | Brief 편집기 + 자료 업로드 | M |
| F-PIP-02 | 기획서 생성 요청 + `plan.json` 검증·자동 재요청 | M |
| F-PIP-03 | 기획서 뷰어(스토리보드·타임라인·파라미터) + 승인/수정 요청 | M |
| F-PIP-04 | 구현 계획서 생성 + 트리 편집 + 승인 | M |
| F-PIP-05 | 태스크 순차 실행(자동/한 단계씩)·일시정지·재시도 | M |
| F-PIP-06 | 태스크 그래프 시각화 | S |

### 5.4 검수

| ID | 기능 | 우선 |
| --- | --- | --- |
| F-REV-01 | 프리뷰 서버 관리 + iframe 미리보기(비율·확대·배경) | M |
| F-REV-02 | 타임라인 스크러버(재생·정지·seek·구간 반복) — 시간 함수 계약 유형만 | M |
| F-REV-03 | 파라미터 패널(스키마 기반 폼, 즉시 반영, 저장) | M |
| F-REV-04 | 수정 요청(대상·시각·코멘트·스크린샷 자동 첨부) | M |
| F-REV-05 | 체크포인트 전/후 비교 | S |
| F-REV-06 | 웹 기기 폭 전환(데스크탑/태블릿/모바일) | S |

### 5.5 Export

| ID | 기능 | 우선 |
| --- | --- | --- |
| F-EXP-01 | 웹/인터랙티브: 정적 사이트 zip | M |
| F-EXP-02 | 임베드 패키지(ES 모듈 + Web Component + React 래퍼) | S |
| F-EXP-03 | 이미지: PNG/JPG/WebP, 배율, 여러 변형 일괄 | M |
| F-EXP-04 | 슬라이드: PPTX(이미지)·PDF | M |
| F-EXP-05 | 슬라이드: PPTX(편집 가능, Beta) | S |
| F-EXP-06 | 동영상: MP4(H.264)·WebM + 포스터 | M |
| F-EXP-07 | 동영상: 투명 배경 | L |
| F-EXP-08 | 작업 큐·진행률·취소·로그 | M |

### 5.6 템플릿 · 플레이그라운드 · 환경

| ID | 기능 | 우선 |
| --- | --- | --- |
| F-TPL-01 | 내장 템플릿 3종 이상(예: 미니멀 에디토리얼 슬라이드, 3D 제품 쇼케이스 영상, 키네틱 타이포 웹) | M |
| F-TPL-02 | 템플릿 갤러리(미리보기 이미지/영상, 태그, 대상 유형) | M |
| F-TPL-03 | 템플릿 가져오기(폴더/zip) | S |
| F-TPL-04 | 현재 프로젝트를 템플릿으로 저장 | L |
| F-PLY-01 | 플레이그라운드: export 결과 보관(앱 데이터), 목록, 재생/열람 | M |
| F-PLY-02 | 플레이그라운드: 태그·검색·삭제 | S |
| F-PLY-03 | 바닐라 스튜디오 서버 연동(공개 작품) | L |
| F-ENV-01 | 환경 점검(Doctor) + 설치 안내 + FFmpeg 다운로드 | M |

### 5.7 디자인 시스템 · 컬러 팔레트 (v0.2 추가)

| ID | 기능 | 우선 |
| --- | --- | --- |
| F-DSN-01 | 프로젝트 `DESIGN.md` 스캐폴딩(템플릿 것 또는 기본본 + 선택 팔레트 적용) | M |
| F-DSN-02 | `DESIGN.md` 검증(구조·토큰 참조·필수 색 역할·WCAG 대비), 실패 시 에이전트 자동 재요청 | M |
| F-DSN-03 | 토큰 바인딩: `DESIGN.md` → 런타임(CSS 변수 `--ds-*`, `useDesign()`), 파일 변경 시 HMR 반영 | M |
| F-DSN-04 | 디자인 탭(토큰 시각화·원문 편집·검사 결과) | M |
| F-DSN-05 | `check_scene` 하드코딩 색상 경고 + 검수 화면 "토큰 미사용 n건" 표시 | S |
| F-DSN-06 | `frame.md`(영상용 모션·페이싱·체류 시간 지침) 작성 지원 — `video` 유형 | S |
| F-DSN-07 | `DESIGN.md` 가져오기/내보내기(다른 도구의 DESIGN.md, Tailwind·DTCG 토큰 내보내기) | S |
| F-DSN-08 | 타이포 프리셋(폰트 페어링) 라이브러리 — 팔레트와 같은 방식으로 교체 | L |
| F-PAL-01 | 팔레트 라이브러리: 내장 팔레트 24종 이상(라이트/다크·무드 태그), 검색·필터 | M |
| F-PAL-02 | 팔레트 적용: `colors` 토큰 교체 → 즉시 미리보기 → 적용 시 저장·체크포인트(에이전트 호출 없음) | M |
| F-PAL-03 | 팔레트 편집기: 역할별 색 지정, OKLCH 명도·채도 조정, 색 잠금 | M |
| F-PAL-04 | 대비 검사: 텍스트/배경 역할 쌍의 WCAG 대비 표시·경고 | M |
| F-PAL-05 | 자료에서 추출: 로고·이미지(`brief/materials/`)의 대표색 추출 → 역할 자동 배정(로컬 계산) | S |
| F-PAL-06 | 기준색 1~2개 → 조화 팔레트 생성(보색·유사색·삼각·단색조, OKLCH) | S |
| F-PAL-07 | 팔레트 비교: 같은 Scene·시각을 여러 팔레트로 스냅샷해 나란히 비교 | S |
| F-PAL-08 | 사용자 팔레트 저장·가져오기·내보내기(`palette.json`, DESIGN.md `colors`) | S |
| F-PAL-09 | 라이트/다크 쌍 팔레트, 웹 결과물의 `prefers-color-scheme` 대응 | L |

---

## 6. 사용자 프로젝트 폴더 구조

```
<project>/
├── vanilla.json                 # 프로젝트 매니페스트(유형·규격·템플릿·팔레트·에이전트·런타임 버전)
├── DESIGN.md                    # 디자인 시스템(색·타이포·간격 토큰 + 사용 원칙) — §8.1, Google DESIGN.md 형식
├── frame.md                     # (선택, video) 영상 프레임용 모션·페이싱 지침 — HyperFrames FRAME.MD 형식
├── AGENTS.md                    # 앱이 생성: 파이프라인·런타임 계약·파일 규칙·DESIGN.md 사용 규칙(에이전트 공통)
├── CLAUDE.md                    # "@AGENTS.md" 한 줄 (Claude Code 호환)
├── brief/
│   ├── brief.md
│   └── materials/               # 사용자 제공 자료
├── plan/
│   ├── plan.md                  # 사람용 기획서
│   └── plan.json                # 기계용 구조 (§7.1)
├── prompts/
│   ├── 00-master.md
│   ├── tasks.json
│   ├── assets/<asset-id>.md
│   ├── animations/<anim-id>.md
│   └── scenes/<scene-id>.md
├── src/
│   ├── main.tsx                 # 앱 소유: 런타임 부트스트랩(수정 금지)
│   ├── composition.tsx          # Scene 조합(타임라인/슬라이드 순서/섹션 순서)
│   ├── scenes/<scene-id>/       # Scene 컴포넌트 + params 선언
│   ├── assets/<asset-id>/       # 재사용 에셋 컴포넌트(SVG/three/셰이더)
│   └── shared/                  # 공통 유틸(색·폰트 값은 두지 않음 → DESIGN.md 토큰)
├── public/                      # 폰트·CC0 텍스처 등 정적 리소스
├── assets/CREDITS.md            # 외부 리소스 출처·라이선스 기록(필수)
├── params/<scene-id>.values.json# 사용자 조절값(에이전트는 요청 없이는 수정 금지)
├── reviews/R-NNN.md (+ .png)    # 수정 요청 기록
├── exports/<ts>-<format>/       # export 결과
├── vanilla/runtime/             # 앱이 설치하는 @vanilla/runtime (수정 금지)
├── package.json / vite.config.ts / index.html / tsconfig.json
├── .claude/skills/, .agents/skills/  # vanilla-core 스킬 + 선택한 템플릿 스킬
└── .vanilla/                    # 앱 전용(app.db·로그·스냅샷 캐시·세션). git 제외
```

---

## 7. 핵심 데이터 계약

### 7.1 `plan.json` (요약)

```jsonc
{
  "version": 1,
  "outputType": "video",               // web | interactive | slides | image | video
  "format": { "width": 1920, "height": 1080, "fps": 30, "durationSec": 15 },
  "concept": { "title": "", "goal": "", "audience": "", "tone": [] },
  "design": { "file": "DESIGN.md", "palette": "biennale-yellow" },  // 색·타이포 값은 DESIGN.md에만
  "scenes": [{
    "id": "s1-intro", "title": "", "purpose": "", "start": 0, "end": 4,
    "layout": "화면 배치 서술", "assets": ["logo"], "animations": ["logo-reveal"],
    "implementation": { "approach": "R3F + 커스텀 셰이더", "libraries": ["three", "@react-three/fiber"], "reason": "" },
    "params": ["bgColor", "title"]
  }],
  "assets": [{ "id": "logo", "kind": "svg|three|shader|text|user-image|ui", "description": "", "implementation": {}, "params": ["logoSpin"] }],
  "animations": [{ "id": "logo-reveal", "target": "logo", "start": 0.5, "end": 2.0, "easing": "expo.out", "description": "" }],
  "params": [{ "id": "bgColor", "scope": "s1-intro", "type": "color", "default": "{colors.canvas}", "label": "배경색" }],
  "customizationNotes": "사용자가 조절 가능한 범위 설명"
}
```

- 파라미터 타입: `color`, `number{min,max,step}`, `text`, `select{options}`, `boolean`, `vec2`, `vec3`.
- `color` 파라미터 기본값은 토큰 참조(`{colors.<role>}`)를 권장한다. 사용자가 값을 직접 고르지 않는 한 팔레트 교체를 따라간다. 우선순위: 코드 기본값 < `DESIGN.md` 토큰 < `params/*.values.json`의 사용자 값.
- `slides`는 Scene = 슬라이드(시간 필드 생략 가능), `image`는 Scene = 이미지 변형(규격 개별 지정 가능).

### 7.2 `tasks.json` (요약)

```jsonc
{ "tasks": [{ "id": "T01", "kind": "asset|animation|scene|compose", "target": "logo",
  "prompt": "prompts/assets/logo.md", "dependsOn": [] }] }
```
태스크 실행 상태는 프로젝트 DB(`.vanilla/app.db`)에 저장한다(파일은 선언, DB는 상태).

### 7.3 Scene 런타임 계약 (요약 — 상세는 기술 설계서 §4)

- Scene은 `defineScene({ id, params, duration? })`로 메타를 등록하는 React 컴포넌트.
- `video`·`image`·`slides`: 애니메이션은 `useTime()`이 주는 `t`(초)의 **순수 함수**로 작성. `Date.now()`·`requestAnimationFrame` 누적·시드 없는 `Math.random()` 금지.
- `web`·`interactive`: 자유 모드. 실시간 애니메이션 허용(D-011). 단 파라미터(`useParams`)·디자인 토큰(`useDesign`) 규칙은 동일.
- 파라미터는 `useParams()`로 읽는다. 기본값은 코드, 사용자 값은 `params/*.values.json`.
- 인터랙티브 입력은 `useInput()` 사용(렌더 모드에서는 비활성).

---

## 8. 디자인 시스템 · 팔레트 · 템플릿

디자인을 세 층으로 나눈다.

| 층 | 내용 | 담는 곳 |
| --- | --- | --- |
| 형태 | 레이아웃·에셋·모션 | 템플릿과 에이전트 코드 |
| 디자인 시스템 | 색·타이포·간격·모서리 토큰과 사용 원칙 | `DESIGN.md` |
| 팔레트 | 색 역할별 값의 묶음 | `DESIGN.md`의 `colors` 토큰 |

층이 분리되어 있으므로 같은 템플릿(형태)에 다른 팔레트를 조합해 느낌을 바꿀 수 있다.

### 8.1 `DESIGN.md` — 에이전트에게 디자인을 전달하는 표준 파일 (D-015)

- **형식**: Google Labs의 오픈 형식 [DESIGN.md](https://github.com/google-labs-code/design.md)(Apache-2.0, 2026-04 공개, 현재 `alpha`).
  - YAML front matter = 기계용 토큰: `colors`, `typography`, `spacing`, `rounded`, `components`. 토큰 참조 문법 `{colors.primary}`.
  - 마크다운 본문 = 사람·에이전트용 사용 원칙. 절 순서: Overview → Colors → Typography → Layout → Elevation & Depth → Shapes → Components → Do's and Don'ts.
  - 공식 CLI(`@google/design.md`): `lint`(구조·대비 검사), `diff`, `export`(Tailwind·DTCG).
- **위치**: 프로젝트 루트 `DESIGN.md`(`AGENTS.md`와 나란히). 프로젝트 `AGENTS.md`와 `vanilla-core` 스킬이 "시각 작업 전에 `DESIGN.md`를 읽고, 값은 토큰으로만 쓴다"를 규칙으로 둔다. 에이전트 종류와 무관하게 같은 파일을 읽으므로 동작 환경이 표준화된다.
- **수명 주기**

  | 단계 | 누가 | 무엇을 |
  | --- | --- | --- |
  | Brief | 앱 | 템플릿의 `DESIGN.md`(없으면 기본본) + 선택 팔레트로 초기본 생성 |
  | Plan | 에이전트 | 브리프·무드에 맞게 본문과 토큰을 다듬음 → 앱이 검증(F-DSN-02) → 사용자 승인 |
  | Build | 에이전트 | 읽기 전용으로 사용(토큰만 참조) |
  | Review | 사용자 | 디자인 패널·팔레트로 `colors` 토큰 수정. 에이전트는 수정 요청(R-NNN)이 있을 때만 `DESIGN.md`를 바꾼다 |

- **소유 규칙**: Plan 승인 이후 `DESIGN.md`의 토큰 값은 사용자 소유다(원칙 P5, `params/*.values.json`과 같은 보호).
  - 앱이 팔레트를 적용할 때는 **front matter의 `colors`만 교체하고 본문은 그대로 둔다**.
  - 그래서 본문은 hex 값 대신 역할 이름(`accent`, `canvas`)으로 색을 설명하도록 `vanilla-core` 스킬에서 안내한다.
- **토큰 바인딩**: 런타임이 `DESIGN.md`를 읽어 두 가지 형태로 제공한다(기술 설계서 §4.4).
  - CSS 변수: `--ds-canvas`, `--ds-accent` …
  - JS 값: `useDesign().colors.accent` — three.js 재질·셰이더 uniform처럼 CSS 변수를 못 쓰는 곳용.
- **`frame.md`(선택, `video`)**: HyperFrames의 FRAME.MD 형식.
  - `DESIGN.md`의 브랜드를 16:9 영상 프레임에 맞게 옮긴 지침: 구도·스케일·페이싱·체류 시간·모션.
  - `video` 프로젝트의 Plan 단계에서 에이전트에게 `DESIGN.md`를 바탕으로 작성하게 할 수 있다(F-DSN-06).
  - 토큰의 진실 공급원은 항상 `DESIGN.md`다. `frame.md`는 모션 지침만 담는다.

### 8.2 컬러 팔레트 (D-016)

같은 형태라도 팔레트가 결과물의 느낌을 크게 바꾼다. 팔레트는 **역할(role)에 색을 배정한 묶음**이며, 적용하면 `DESIGN.md`의 `colors` 토큰이 교체된다.

- **표준 색 역할** (Vanilla 규약. ⚠️ S7에서 DESIGN.md 예제·HyperFrames 프리셋과 대조해 확정)

  | 역할 | 필수 | 용도 |
  | --- | --- | --- |
  | `canvas` | ✔ | 전체 배경 |
  | `surface` | ✔ | 카드·패널·면 |
  | `ink` | ✔ | 제목·본문 텍스트 |
  | `ink-muted` | ✔ | 보조 텍스트·캡션 |
  | `primary` | ✔ | 주 브랜드색·핵심 강조 |
  | `secondary` | ✔ | 보조 강조 |
  | `accent` | ✔ | 포인트(하이라이트·CTA·파티클) |
  | `line` | ✔ | 선·테두리·그리드 |
  | `on-primary` | – | `primary` 위 텍스트 |
  | `data-1`~`data-6` | – | 차트·데이터 시각화 계열색 |

- **팔레트 파일** `palette.json`:
  ```jsonc
  { "version": 1, "id": "biennale-yellow", "name": "Biennale Yellow", "tags": ["editorial", "warm"],
    "scheme": "light",                       // light | dark
    "colors": { "canvas": "#F4EEDF", "ink": "#1F2A5A", "accent": "#F2C230" /* … 역할별 */ },
    "source": "builtin",                     // builtin | user | extracted | generated
    "license": "CC0-1.0" }
  ```
  내장 팔레트는 앱 리소스, 사용자 팔레트는 앱 데이터 `palettes/`에 둔다.
- **적용 흐름**
  1. 라이브러리에서 팔레트 선택 → Bridge로 미리보기에만 즉시 반영(파일 변경 없음).
  2. `적용` → `DESIGN.md`의 `colors` 교체 + `vanilla.json`의 `palette` 갱신 + 체크포인트.
  3. 에이전트는 부르지 않는다.
- **대비 검사**: `ink`/`canvas`, `ink`/`surface`, `ink-muted`/`canvas`, `on-primary`/`primary` 쌍의 WCAG 대비를 계산해 AA 미달이면 경고한다(적용을 막지는 않음).
- **팔레트 만들기**: 모두 로컬 계산이며 생성형 AI를 쓰지 않는다(D-006).
  - 직접 편집: 역할별 색, OKLCH 슬라이더, 색 잠금
  - 기준색에서 조화 생성: 보색·유사색·삼각·단색조
  - 자료 이미지에서 대표색 추출 → 역할 자동 배정
- **파라미터와의 관계**: `color` 파라미터 기본값이 토큰 참조면 팔레트를 따라가고, 사용자가 값을 직접 지정한 파라미터는 팔레트를 바꿔도 유지된다(§7.1).
- **결과물이 팔레트를 따르게 하는 장치**: `vanilla-core` 스킬 규칙(토큰만 사용), `check_scene`의 하드코딩 색상 경고(F-DSN-05), 템플릿 예제 코드의 토큰 사용.

### 8.3 디자인 템플릿

- 템플릿 = Agent Skill 폴더(D-008):
  ```
  <template-id>/
  ├── SKILL.md            # 언제 사용하는지, 스타일 원칙, 기획·구현 지침
  ├── template.json       # 이름·설명·대상 유형·태그·미리보기 경로·버전·라이선스·기본/추천 팔레트
  ├── DESIGN.md           # 템플릿 기본 디자인 시스템(필수) → 프로젝트 DESIGN.md의 초기본
  ├── frame.md            # (선택, video 템플릿) 영상용 모션·페이싱 지침
  ├── palettes/           # (선택) 템플릿이 추천하는 팔레트 palette.json
  ├── references/         # 레이아웃·모션 원칙, 구현 계획서 예시 프롬프트
  ├── examples/           # 예제 Scene·Asset 코드(토큰만 사용)
  ├── preview/            # 썸네일·짧은 미리보기 영상(기본 팔레트 기준)
  └── CREDITS.md          # 참고·차용한 외부 자료 출처와 라이선스
  ```
- 내장 템플릿은 앱 리소스에 번들, 사용자 템플릿은 앱 데이터 `templates/`에 저장.
- 프로젝트 생성 시 선택한 템플릿 + 항상 포함되는 `vanilla-core` 스킬(런타임 계약·파이프라인 규칙·**DESIGN.md 사용 규칙**·심미 체크리스트)을 프로젝트에 복사.
- 템플릿 갤러리에서 카드의 팔레트를 바꿔 미리보기 썸네일을 다시 칠해 볼 수 있다(S, 스냅샷 캐시).

### 8.4 템플릿·프리셋 구성 참고 자료 (D-017)

템플릿·팔레트·에셋 예제를 만들 때 참고할 외부 자료다. 상세 정리는 wiki `research-2026-09-29-design-md-hyperframes`에 있다.

| 자료 | URL | 활용 |
| --- | --- | --- |
| HyperFrames FRAME.MD 디자인 프리셋 | https://www.hyperframes.dev/design | 에디토리얼·코퍼레이트·네오브루탈·포스터 계열 12종. 내장 `DESIGN.md`·팔레트·타이포 페어링과 `frame.md` 작성의 참고 |
| HyperFrames 카탈로그 | https://hyperframes.heygen.com/catalog | 10개 분류(3D Motion, Carousels, Text & Captions, Code, Transitions, Data & Charts, Scenes & Demos, Motion & Effects, Surfaces, Blocks). 템플릿의 Asset·Animation 예제와 구현 계획서 예시 프롬프트의 참고 |
| DESIGN.md 명세 | https://github.com/google-labs-code/design.md | §8.1 형식의 기준 |

- **사용 원칙**
  - 참고용이다. 카탈로그 항목은 GSAP paused timeline 기반 HTML이므로 코드를 그대로 복사하지 않고 Vanilla Scene 런타임(`useTime()` 순수 함수)으로 다시 구현한다(D-007).
  - 항목별 라이선스와 폰트 라이선스를 확인하고, 출처를 템플릿 `CREDITS.md`에 남긴다.
  - 카탈로그 항목의 `params`(color·text·number·select) 설계는 우리 파라미터 스키마(§7.1)와 개념이 같으므로 파라미터 설계의 참고로 쓴다.

## 9. 플레이그라운드

- 저장 위치: 전역 앱 데이터 `playground/<id>/`(export 결과 복사본 + `item.json`: 제목·유형·원본 프로젝트 경로·생성일·썸네일).
- 목록: 그리드(썸네일·유형 배지), 필터(유형), 검색(제목·태그).
- 재생: 웹/인터랙티브는 iframe(로컬 정적 서버), 영상은 `<video>`, 슬라이드는 이미지 뷰어/PDF, 이미지는 이미지 뷰어.
- 3차: 서버 연동(업로드·공개 작품 조회) — 이를 위해 `item.json`에 `visibility`, `remoteId` 필드를 예약.

---

## 10. 비기능 요구사항

| 영역 | 요구 |
| --- | --- |
| 성능 | 파라미터 변경 → 미리보기 반영 < 100ms. 앱 시작 < 3s. 동시 WebGL 미리보기 최대 2개. |
| 결정성 | 동일 체크포인트·파라미터로 두 번 렌더한 영상의 프레임이 시각적으로 동일해야 함. |
| 안정성 | 에이전트/프리뷰 서버/렌더 프로세스가 죽어도 앱은 살아 있고 재시작 버튼 제공. |
| 보안 | 파일 접근은 프로젝트 폴더 스코프, 셸은 매번 확인(D-010), 미리보기 iframe은 sandbox·별도 origin. |
| 다국어 | 앱 UI ko/en. 에이전트 프롬프트 언어는 사용자 언어 설정을 따름. |
| 접근성 | 키보드로 재생/정지(Space)·프레임 이동(←/→)·파라미터 조절 가능. |
| 오프라인 | 에이전트 호출 외 기능(검수·export·플레이그라운드)은 오프라인 동작. |

## 11. 로드맵 (제안)

| 마일스톤 | 내용 |
| --- | --- |
| M0 PoC | S1~S7 기술 검증 (`Feasibility-Risks.md` §3) |
| M1 기반 | 브랜딩 교체, 예제 도메인 제거, 프로젝트 모델·스캐폴딩, Doctor |
| M2 에이전트 | ACP 호스트, 권한 다이얼로그, 에이전트 패널, 터미널 폴백 |
| M3 파이프라인 | Brief·Plan·Prompts·Build 단계 UI와 검증, `DESIGN.md` 스캐폴딩·검증 |
| M4 검수 | 런타임 패키지(토큰 바인딩 포함), 프리뷰 서버, 검수 스튜디오, 디자인 패널·팔레트 교체, 수정 요청, 체크포인트 |
| M5 Export | 웹·이미지·슬라이드·동영상 export, 작업 큐 |
| M6 템플릿·플레이그라운드 | 내장 템플릿 3종(각 `DESIGN.md` 포함), 팔레트 라이브러리·편집기, 갤러리, 플레이그라운드 |
| M7 릴리스 | 인스톨러, 서명, 자동 업데이트, 문서 |

세부 일정·태스크는 다음 단계 산출물인 **구현 계획서(+TODO)** 에서 확정한다.
