# Vanilla Studio v2 리팩토링 기획서 — Scene Workspace

> 문서 버전: v0.3 (인터뷰 3차 반영, 사용자 검토 대기) · 작성: 2026-10-05
> 위치: `Docs/Planning/` · 상태: **Proposed** — 승인 전에는 `Product-Spec.md`·`Technical-Design.md`를 대체하지 않는다.
> 관련 결정: D-022~D-033(`Decisions.md`, 모두 Proposed)

## 1. 한 줄 정의

Vanilla Studio v2는 **"에이전트가 일하기 좋은 작업 폴더를 만들어 주고, 결과물을 바로 재생해 보는 Scene 워크스페이스"**다.
앱은 AI 에이전트를 직접 조종하지 않는다. 대신 (1) 신(Scene)별 가이드·DESIGN.md·AGENTS.md를 **구조화된 데이터에서 생성**하고,
(2) 에이전트를 내장 터미널에서 띄워 **미리 만든 프롬프트를 클립보드로 전달**하며, (3) 생성된 신·시퀀스를 **플레이그라운드에서 재생**한다.

### 1.1 v1 대비 변화

| 항목 | v1 (현재) | v2 |
| --- | --- | --- |
| 시작 | 프로젝트 마법사(유형·템플릿·팔레트) | **작업 폴더 하나만 지정** |
| 화면 | 탭 기반 파이프라인 UI | **ComfyUI형 무한 캔버스 워크스페이스** + 좌측 사이드바 |
| 작업 단위 | 프로젝트(1결과물) | **Scene**(폴더) → Sequence(그래프) |
| 에이전트 | ACP 구동·세션·권한 호스트 | **터미널 실행 + 클립보드 프롬프트** |
| 지침 | 앱 스킬(`vanilla-core`) | **신/워크스페이스별 `AGENTS.md`·`GUIDE`·`DESIGN.md` 자동 생성** |
| 공유 | export(MP4/PPTX/PNG) | **정규화된 폴더/zip 패키지 + 재생** (export는 후속) |

### 1.2 비목표 (v2 v1.0)

- 생성형 이미지/영상 AI 연동(D-006 유지). 에이전트가 **코드**로 결과물을 만든다.
- 앱 내부에서 에이전트 대화·권한 처리(ACP). 에이전트 자체 UI(터미널)를 쓴다.
- MP4/PPTX export(후속 마일스톤), 공유 마켓플레이스(플레이그라운드는 로컬 재생만, 외부 시퀀스 조회는 후속).

## 2. 사용자 시나리오

1. 앱 최초 실행 → **작업 폴더 선택**(이후 `workspace.json`으로 기억, 설정에서 변경).
2. 워크스페이스 캔버스에서 우클릭/`+`로 **Scene 노드 생성** → 타입 선택(정적 페이지 / 모션 그래픽 / 3D 애니메이션) → `scenes/<slug>/` 폴더 자동 생성.
3. 노드 클릭 → 우측 **Scene 인스펙터**에서 가이드 항목별 편집(드롭다운 용어 선택 포함), 사용자 프롬프트·레퍼런스 추가.
4. (선택) 레퍼런스 영상/URL 등록 → **[분석 실행]** → 터미널에서 에이전트가 분석 → 결과가 `reference-analysis.md`와 DESIGN.md·scene.json에 반영.
5. **[에이전트 실행]** → 내장 터미널에서 선택한 에이전트(Claude Code 등)가 신 폴더에서 시작, 생성 프롬프트는 이미 클립보드에 있음 → 붙여넣기.
6. 신 노드에 **미리보기 썸네일/재생** 표시. 수정은 인스펙터 편집 → 재생성 프롬프트(변경분 포함)로 반복.
7. 신들을 엣지로 연결, 엣지에 **전환(transition)** 정의 → **시퀀스** 구성(PPT형·영상형·인터랙티브 분기형).
8. **플레이그라운드**에서 시퀀스 재생. 시퀀스를 **공유 패키지**로 내보내 다른 사람이 재현/재활용.

## 3. 화면 구성

### 3.1 레이아웃 (ComfyUI 형태, 가장 좌측 사이드바만 유지)

```
┌──┬──────────────────────────────────────────────┬──────────────┐
│사│  상단 툴바: 워크스페이스명 · 실행/재생 · 줌     │              │
│이├──────────────────────────────────────────────┤  인스펙터     │
│드│                                              │ (선택 노드/엣지│
│바│        무한 캔버스 (패닝·줌·미니맵)             │  가이드 폼)   │
│  │   [Scene A]──transition──▶[Scene B] ...      │              │
│  ├──────────────────────────────────────────────┴──────────────┤
│  │  하단 도크: 터미널(PTY) · 로그 탭                              │
└──┴─────────────────────────────────────────────────────────────┘
```

- **사이드바(유지)**: Workspace(캔버스) · Scenes 목록 · Playground · Settings. 템플릿의 탭 시스템·폴더 트리는 단순화/제거.
- 캔버스·노드 모양·다크 톤·핸들/엣지 스타일은 ComfyUI와 거의 동일하게 맞춘다(구현 후보: `@xyflow/react`, 라이선스 MIT — 도입 시 `Feasibility-Risks.md` §2.9 기록. 대안: 자체 구현).
- 노드 우측 패널(인스펙터)과 하단 터미널 도크는 접을 수 있다.

### 3.2 Scene 노드

- 헤더: 타입 아이콘·이름·상태 배지(`draft` / `prompt-ready` / `generated` / `needs-revision`).
- 본문: 썸네일(없으면 플레이스홀더), 길이(모션/3D), 레퍼런스 개수.
- 하단 버튼: `에이전트 실행` · `재생` · `폴더 열기`.
- 입력/출력 핸들: 시퀀스 엣지 연결용(`out`→`in`, 분기 노드는 다중 `out`).

### 3.3 Scene 인스펙터 (섹션)

`개요 · 가이드(항목별) · DESIGN · 레퍼런스 · 사용자 프롬프트 · 실행 이력`

- 가이드 항목은 폼으로 편집, 변경 즉시 `scene.json` 저장 + `GUIDE.md`·`AGENTS.md` 재렌더.
- **용어 드롭다운**: 모션·그래픽 전문용어 필드는 §6의 용어집에서 선택(다중 선택·자유 입력 허용, 툴팁에 한 줄 정의).
- **프롬프트 미리보기**: 에이전트에 줄 최종 프롬프트(클립보드에 들어갈 내용)를 열람·복사.

### 3.4 플레이그라운드

시퀀스 단위 재생기. 재생/일시정지/시크, 신 점프, 분기 선택(인터랙티브), 전환 확인. 후속: 다른 사람의 공유 시퀀스 열람.

## 4. 작업 폴더 구조 (파일이 진실 공급원)

```
<작업폴더>/
├─ workspace.json            # 버전, workspaceId, 이름, canvas{aspect,width,height,fps}(전역 고정, 프리셋 16:9 1920×1080 30fps·9:16 1080×1920·1:1 1080×1080 + 사용자 지정), 캔버스 뷰, 기본 에이전트
├─ AGENTS.md                 # 워크스페이스 공통 규칙(앱 생성, 전 신 공통)
├─ CLAUDE.md                 # `@AGENTS.md` 한 줄 (Claude Code 호환)
├─ DESIGN.md                 # 워크스페이스 기본 디자인 토큰(팔레트·분위기). 신이 상속/오버라이드
├─ sequence.json             # ★ 워크스페이스당 시퀀스 1개: 노드(신 참조)·엣지·전환·분기
├─ scenes/
│  └─ <slug>/
│     ├─ scene.json          # ★ 구조화 가이드(진실 공급원, zod 스키마·version)
│     ├─ GUIDE.md            # scene.json에서 렌더(읽기 전용 생성물, 수동 편집 금지 헤더)
│     ├─ AGENTS.md           # 이 신에서 에이전트가 따를 규칙·입출력 계약
│     ├─ DESIGN.md           # (선택) 신 전용 오버라이드. 없으면 워크스페이스 것을 상속
│     ├─ prompts/            # user-prompt.md, generate.md, analyze-reference.md (생성)
│     ├─ references/         # 사용자가 넣은 영상·이미지 + references.json(URL 포함)
│     │  └─ analysis/        # 에이전트 분석 결과(reference-analysis.md, 키프레임 등)
│     ├─ src/                # ★ 에이전트가 작성하는 결과물 코드(index.html + 모듈)
│     ├─ params/             # 사용자 조절값(*.values.json, 사용자 소유 — 덮어쓰기 금지)
│     └─ .vanilla/           # 앱 상태(썸네일, 실행 이력). 커밋/공유 제외
├─ guide-templates/          # (선택) 이 워크스페이스 전용 사용자 정의 가이드 템플릿(§6.5)
└─ CREDITS.md                # 외부 리소스 출처·라이선스
```

### 4.1 워크스페이스 = 시퀀스 1개 (D-029)

- 한 작업 폴더에는 시퀀스가 **하나**(`sequence.json`)뿐이다. 다른 시퀀스를 만들려면 **새 워크스페이스(폴더)**를 만든다. 앱은 최근 워크스페이스 목록과 사이드바 상단 워크스페이스 스위처를 제공한다.
- **에이전트 구분 규칙**(워크스페이스 간 혼동 방지):
  1. `workspace.json`의 `workspaceId`·`name`이 워크스페이스를 식별한다. 루트 `AGENTS.md` 첫 줄에 "이 폴더는 워크스페이스 `<name>`(`<id>`)이며 시퀀스는 `sequence.json` 하나다"를 명시한다.
  2. 에이전트의 작업 범위는 **cwd 아래**로 한정한다(상위·형제 폴더 접근 금지. 신 폴더 cwd 실행 시 신 폴더 + 워크스페이스 루트의 `DESIGN.md`·`AGENTS.md`·`sequence.json` 읽기만 허용).
  3. 신 `AGENTS.md`에는 자기 `sceneId`와 소속 `workspaceId`를 함께 적고, 클립보드 프롬프트에도 `[workspace: <name> / scene: <name>]` 헤더를 포함한다.
  4. 다른 워크스페이스의 신은 앱의 **가져오기(복사)**로만 들여오며 참조 링크를 만들지 않는다(자기완결성 → 공유·재현 용이).

- **앱 상태(DB)**: 최근 작업 폴더 목록, 터미널 세션, UI 상태만 전역 SQLite. 신·시퀀스의 내용은 모두 파일.
- 앱은 `AGENTS.md`/`GUIDE.md`/`prompts/*`를 **생성물**로 취급하고, 사용자·에이전트가 쓰는 파일(`src/`, `params/`, `analysis/`, `DESIGN.md` 본문)은 **덮어쓰지 않는다**(재생성 시 마커 구간만 갱신).

## 5. 데이터 계약

> 데이터 계약 변경은 zod 스키마·설계서·버전 필드를 함께 갱신한다(AGENTS.md §4-5).

### 5.1 `scene.json` (v1)

```jsonc
{
  "version": 1,
  "id": "scn_01H...",            // 불변 ID(폴더명 변경에도 유지)
  "name": "강동 숲 도서관 홍보",
  "type": "motion",              // "static" | "motion" | "3d"
  "template": "commercial-v1",   // 가이드 템플릿 ID@버전 (재현성)
  "brief": { "subject": "", "goal": "", "audience": "", "message": "", "language": "ko" },
  "duration": { "seconds": 10 }, // motion·3d 전용. static은 생략(사용자 입력으로 진행)
  "creativeMode": ["premium-product-motion", "kinetic-typography"],
  "structure": "multi-shot",     // multi-shot | continuous | hybrid
  "adStructure": "typography-led",
  "brandVoice": ["confident", "warm"],
  "visualStyle": { "medium": "", "lighting": "", "typography": "", "density": "", "cameraFeeling": "", "mood": "" },
  "motionVocabulary": { "typography": [], "object": [], "camera": [], "material": [], "transition": [] },
  "beats": [                     // 시간 구조(Shot/구간). 총합 = duration
    { "id": "b1", "start": 0.0, "end": 2.1, "role": "hook",
      "copy": "정확한 원문", "visual": "", "motion": [], "camera": "", "transitionOut": "hard-cut", "notes": "" }
  ],
  "copy": { "textFidelity": "exact", "items": [] },   // 화면 문구 원문 목록(불변 자산)
  "identity": { "product": "", "character": "", "mustKeep": [] },
  "endCard": { "holdSeconds": 0.85, "elements": [] },
  "audio": { "voiceOver": null, "soundDesign": null, "music": null },
  "constraints": { "avoid": [], "noUnspecifiedElements": true },
  "references": [ { "id": "r1", "kind": "video|image|url", "path": "references/ref1.mp4", "url": null, "note": "", "analysis": "references/analysis/r1.md" } ],
  "userPrompt": "자유 서술",
  "runtime": { "contract": "scene-runtime@1", "entry": "src/index.html" },
  "status": "draft"
}
```

- 화면비·해상도·fps는 신이 아니라 **`workspace.json.canvas`(전역 고정)**에서 온다. 신 스키마에는 두지 않는다(D-030).
- 타입별 확장 필드: `static`(**`mode: "scroll" | "steps"`**, 섹션·레이아웃·반응형 브레이크포인트·접근성, `mode=steps`일 때 **`steps[]`** — §8.1), `3d`(씬 구성·재질·조명·카메라 경로·성능 예산). 공통 필드는 위와 같다.
- **정규화 규칙**: 키 순서 고정, 2-space 들여쓰기, 줄바꿈 LF, 시간은 소수 3자리, 배열은 의미 순서만. 같은 입력 → 같은 바이트(공유·diff 용이).

### 5.2 `sequence.json` (v1)

```jsonc
{
  "version": 1,
  "workspaceId": "ws_01H...",
  "id": "seq_main",
  "mode": "linear",                       // "linear"(PPT/영상) | "interactive"(분기)
  "nodes": [ { "sceneId": "scn_...", "pos": { "x": 0, "y": 0 } } ],
  "edges": [ {
    "from": "scn_a", "to": "scn_b",
    "trigger": "end | click | key:ArrowRight | timeout:3s | choice:<label>",
    "transition": { "type": "crossfade", "durationMs": 600, "easing": "ease-in-out", "params": {} }
  } ],
  "start": "scn_a"
}
```

- 전환 종류(내장): `cut`, `crossfade`, `slide-*`, `mask-wipe`, `circular-reveal`, `zoom-through`, `match-cut`(요소 ID 지정), `custom`(에이전트가 `transitions/<name>.ts` 구현). 목록은 용어집(§6)과 동일 소스.
- `trigger`로 PPT형(`click`/`key`), 영상형(`end`), 인터랙티브(`choice`) 구성.
- **검증 규칙**: `from`이 `static` 신이면 trigger는 사용자 입력(`click`·`key:*`·`choice:*`)만 허용한다(`end`·`timeout` 금지). `sequence.json`의 `workspaceId`가 `workspace.json`과 다르면 로드를 거부한다.

### 5.3 DESIGN.md

기존 표준(D-015) 유지: front matter `colors`(시맨틱 토큰) + 본문(분위기·타이포·간격·사용 규칙). v2에서 추가:

- `mood`(키워드 배열)·`references`(분석에서 파생된 팔레트/분위기 메모 링크) 섹션을 본문 규약 섹션으로 정의.
- 신 `DESIGN.md`는 워크스페이스 것을 **상속**(front matter에 `extends: ../../DESIGN.md`), 필요한 토큰만 오버라이드.
- 레퍼런스 분석이 반영될 때는 에이전트가 **마커 구간**(`<!-- vanilla:begin:analysis -->` ~ `<!-- vanilla:end:analysis -->`(저장소 공통 마커 형식))만 갱신(D-016의 바이트 보존 원칙 유지). 승인된 토큰 값은 사용자 소유.

## 6. 가이드 시스템 (규칙화의 핵심)

### 6.1 가이드 템플릿

`resources/guides/<type>/<templateId>@<ver>/`에 앱이 번들로 제공(사용자 확장 가능, 후속).

| 타입 | 템플릿 | 원천 |
| --- | --- | --- |
| `motion` | `commercial-v1` | `Docs/Commercial-Motion-Graphic-Prompt-Guide.txt`를 앱용으로 개편 |
| `static` | `web-page-v1` | 신규 작성(레이아웃·타이포·반응형·접근성·카피 규칙) |
| `3d` | `three-scene-v1` | 신규 작성(씬·재질·조명·카메라 경로·성능 예산·결정성) |

각 템플릿(내장·사용자 정의 동일 형식, §6.5) = ① **스키마**(`scene.json` 타입별 zod + UI 폼 정의) ② **용어집**(드롭다운 데이터) ③ **규칙 본문**(에이전트용 원칙) ④ **프롬프트 템플릿**(`generate.md`·`analyze-reference.md`) ⑤ **검수 체크리스트**.

### 6.2 모션 그래픽 가이드 개편 방향 (원문 → 앱)

원문은 "영상 생성 모델용 프롬프트 1개 출력"이 목적이다. v2에서는 목적을 **"코드 기반 모션 그래픽을 에이전트가 구현"**으로 바꾼다.

| 원문 섹션 | v2 처리 |
| --- | --- |
| 1 영상 기본 설정(길이만 지정) | `duration.seconds` 필드. 화면비·fps는 DESIGN/`workspace.json`의 캔버스 설정으로 이동 |
| 2 Creative Mode / 3 구조 / 4 광고 구조 | 드롭다운 필드(`creativeMode`, `structure`, `adStructure`) |
| 5 Brand Voice / 6~7 카피·사실 구분 | `brandVoice` 다중 선택 + `copy.items`(원문 불변) + 미확인 효능 금지 규칙 → AGENTS.md 규칙 |
| 9 Visual Style | `visualStyle` 필드 + DESIGN.md 토큰 연동(색은 토큰만 사용) |
| 10 Motion Vocabulary | 카테고리별 용어집 → 드롭다운. 각 용어에 **구현 힌트**(예: `scale punch` → easeOutBack 스케일 1→1.12→1) 추가 |
| 11 의미-모션 연결 | 규칙 본문 + `beats[].motion` 근거 메모 |
| 12~13 Shot/Continuous | `beats[]` 시간 구조, 시작·종료 시간 필수, `structure`에 따라 Shot/구간 UI |
| 14~15 타이포·Text Fidelity | `copy.items` = 불변 자산. 검사기(후속)가 렌더 텍스트와 원문 일치 검증 |
| 16~18 Reference/Identity/Character | `references`·`identity` 필드. "그대로 삽입 금지·식별 특징 유지" 규칙 |
| 19~20 CG/카메라 | `visualStyle`·`motionVocabulary.camera/material` |
| 21~23 생성 요소 통제·밀도·End Card | `constraints`·밀도 권장(5s 3~4 beat 등)·`endCard.holdSeconds ≥ 0.7s` 검증 |
| 24~25 Voice-over/Sound | `audio`(v1은 기록만; 오디오 렌더는 후속) |
| 26~27 언어/길이 | 연출 설명 영어·화면 문구 원문 규칙 유지. **6,000~7,000자 제한 삭제**(코드 생성이라 불필요) |
| 28~29 아이디어만 입력/출력 규칙 | "빈 필드는 에이전트가 채워 `scene.json`에 되쓴다"(되쓰기 허용 필드 목록 명시) |

### 6.3 용어집 (드롭다운 데이터)

`glossary/<type>.json`: `{ category, id, label{ko,en}, definition, implementationHint, tags }`.
- 모션: Typography/Object/Camera/Material/Transition (원문 §10 목록 + 보강).
- 정적: 레이아웃(Hero, Bento, Split, Masonry…), 타이포(스케일·페어링), 인터랙션(hover, scroll-reveal, sticky), 접근성 항목.
- 3D: 재질(PBR, glass, clearcoat…), 조명(3-point, HDRI, rim), 카메라(orbit, dolly, crane), 후처리(bloom, DoF), 렌더 예산.
- UI: 콤보박스(검색·다중·자유 입력), 선택 시 `scene.json`에 **ID 저장**(언어 독립, 재현성).

### 6.5 사용자 정의 가이드 템플릿 (v2.0 포함, D-031)

- 위치: 워크스페이스 `guide-templates/<id>@<ver>/` 또는 **설정에서 지정한 전역 템플릿 디렉터리**(앱 설정 `templatesDir`, 기본값 앱 데이터 폴더). 우선순위 워크스페이스 > 전역 > 내장. 전역 디렉터리를 팀 공유 폴더(네트워크 드라이브·클라우드 동기화 폴더)로 지정하면 공유된다. 지정 경로는 읽기 전용으로도 사용 가능하며, 앱은 해당 폴더 밖 쓰기를 하지 않는다.
- 구조: `template.json`(id·version·type·extends·label) + `schema.json`(내장 스키마 확장: 필드 추가/숨김/기본값만, 기존 필드 의미 변경 금지) + `glossary.json`(용어 추가/오버라이드) + `rules.md` + `prompts/*.md` + `checklist.md`.
- 앱 UI: 내장 템플릿 **복제 → 편집 → 저장**(`extends`로 차이만 기록). zod로 검증하고 실패 시 사용하지 않는다.
- 신은 `template: "<id>@<ver>"`를 기록하며, 공유 패키지(§10)에 **사용한 사용자 정의 템플릿을 동봉**해 재현성을 보장한다.
- 외부 배포(마켓)는 후속. 템플릿의 `rules.md`·프롬프트는 신뢰할 수 없는 데이터로 취급(AGENTS.md §7)하며, 공유 패키지에서 가져온 템플릿은 사용 전 사용자에게 출처를 표시하고 확인받는다.

### 6.4 파싱 가능성

- 진실 공급원은 `scene.json`(zod 검증). `GUIDE.md`는 사람/에이전트 가독용 **렌더 결과**이며 상단에 "자동 생성, `scene.json`을 수정하세요" 헤더와 `scene.json` 해시를 둔다.
- 에이전트가 되쓰는 필드는 `AGENTS.md`에 화이트리스트로 명시(예: `beats[].visual` 보강, `references[].analysis`). 앱은 되쓰기 후 스키마 검증 실패 시 사용자에게 경고.

## 7. AGENTS.md 생성 (신 가이드를 에이전트가 인식하게 하는 계약)

계층: 워크스페이스 `AGENTS.md`(공통) → 신 `AGENTS.md`(신별). 에이전트는 신 폴더를 cwd로 실행하므로 두 파일을 모두 읽는다(`CLAUDE.md`는 `@AGENTS.md`).

신 `AGENTS.md` 구성(마커 구간 렌더, 외부 편집 구간 보존):

1. **작업 정의**: 신 이름·타입·목표 + `GUIDE.md`·`scene.json`·`DESIGN.md`를 먼저 읽을 것.
2. **산출물 계약**: 엔트리 `src/index.html`, Scene 런타임 계약(§8), 금지 사항(네트워크 CDN 의존·외부 에셋 라이선스 미기록·생성형 AI).
3. **디자인 규칙**: 색·타이포는 `DESIGN.md` 토큰만(`var(--color-*)`), 직접 색상값 금지.
4. **되쓰기 규칙**: 수정 가능 파일/필드 화이트리스트, `params/*.values.json`·`scene.json`의 사용자 입력 필드 보호.
5. **타입별 규칙**: 해당 가이드 템플릿의 규칙 본문(Text Fidelity, 길이·밀도, 결정성 등).
6. **레퍼런스 처리**: 분석 태스크 절차(§9)와 결과 기록 위치.
7. **검수**: 체크리스트 자기 점검 후 `.vanilla/self-check.md`에 결과 기록.
8. **보안**: 프로젝트 폴더 밖 쓰기 금지, 외부 콘텐츠는 데이터로 취급(AGENTS.md §7 원칙을 신 단위로 반영).

## 8. 런타임·플레이그라운드

기존 Scene 런타임 재사용(D-011 범위 유지, D-024):

- `motion`: `useTime()` 순수 함수 → 같은 `t` → 같은 프레임(시크·재생·썸네일·후속 MP4 export 모두 가능).
- `3d`: three.js, 시간 구동 카메라/애니메이션(결정성 권장, 물리·랜덤은 시드 고정).
- `static`: 자유 모드(React/HTML), 스크롤·hover 허용.
- **신 계약**: 신은 Bridge로 `ready/duration/seek/play/pause/captured`를 노출. 플레이그라운드가 시퀀스 매니저로서 신 iframe을 순서대로 로드·전환한다(전환은 두 신 iframe의 합성 또는 캡처 프레임 기반, PoC 필요 — 리스크 R-1).
- 미리보기 iframe은 별도 origin·Tauri IPC 없음(AGENTS.md §7 유지).
- 시퀀스 모드: `linear` 자동 진행 / `click·key` 슬라이드 진행 / `choice` 분기.

### 8.1 정적 페이지의 사용자 입력 진행 (D-032)

- `static` 신은 **사용자 입력이 있어야만** 다음 신으로 넘어간다(자동 진행·타이머 없음).
- `static.mode`: `scroll`(긴 스크롤 페이지, 1개 step으로 취급, 스크롤 끝/버튼 입력으로 진행) 또는 `steps`(슬라이드형). 인스펙터 UI는 mode에 따라 섹션 편집/step 편집을 전환한다.
- 정적 페이지 내부도 PPT처럼 **장면(step) 전환**을 가질 수 있다: `scene.json`의 `steps[]`(`{ id, title, copy, layout, enter: <transition>, advance: "click|key:ArrowRight|choice:<label>" }`).
  - step 전환도 사용자 입력으로만 일어난다. 마지막 step에서 입력이 들어오면 시퀀스 엣지의 `trigger`가 평가된다.
  - Bridge 추가 메시지: `step`(현재 step 인덱스/총수 보고), `next`/`prev`(플레이그라운드 호스트가 입력을 위임할 때). 스크롤형 페이지는 step 1개로 취급하고 스크롤 끝/버튼 입력으로 진행.
- 플레이그라운드는 진행 입력 안내(클릭/방향키 힌트)를 표시하고, `choice` 분기는 선택 UI를 오버레이한다.

## 9. 에이전트 실행

### 9.1 터미널 실행 흐름

1. `[에이전트 실행]` → 신 폴더 cwd로 내장 터미널 탭 생성(기존 `portable-pty`·`@xterm/xterm` 재사용) → 선택한 에이전트 CLI 실행(`claude`, `codex`, `opencode` 등. 명령은 **고정 argv 레지스트리**에서만, D-012).
2. 동시에 `prompts/generate.md`를 클립보드에 복사 + 토스트 "프롬프트 복사됨 — Ctrl+V". 옵션(기본 꺼짐): 에이전트 준비 감지 후 자동 붙여넣기.
3. 프롬프트는 짧고 안정적으로: "`AGENTS.md`와 `GUIDE.md`를 읽고 `scene.json`대로 `src/`를 구현하라. 사용자 요청: …". 긴 규칙은 파일이 담당(프롬프트 길이 의존 최소화).
4. 에이전트 종료/파일 변경 감지(기존 watch) → 신 상태·썸네일 갱신.

### 9.2 레퍼런스 분석 흐름 (D-026)

1. 사용자가 영상 파일(복사 또는 링크)·이미지·URL 추가 → `references/references.json`에 기록(영상은 ffmpeg로 키프레임 N장·메타데이터 추출을 앱이 사전 수행: 기존 FFmpeg 다운로드 자산 재사용).
2. `[분석 실행]` → 터미널 + `prompts/analyze-reference.md` 클립보드 복사.
3. 에이전트가 분석 → ① `references/analysis/<id>.md`(구도·팔레트·모션·타이밍·전환·타이포·분위기) ② `DESIGN.md` 분석 마커 구간(팔레트·분위기) ③ `scene.json`의 되쓰기 허용 필드(`visualStyle`, `motionVocabulary` 후보, `beats` 초안)에 반영.
4. 앱은 변경 사항을 diff로 보여주고 사용자가 승인/되돌림(파일 단위 스냅샷, `.vanilla/history/`).
- 저작권: 레퍼런스는 **스타일 분석용**이며 산출물에 복제·삽입 금지 규칙을 AGENTS.md에 명시.

### 9.3 에이전트 중립

특정 에이전트 전용 기능에 의존하지 않는다. 에이전트 차이(실행 명령, 지침 파일명)는 `src/lib/agents/` 레지스트리가 흡수(AGENTS.md §4-4 유지). v2에서는 레지스트리를 `{ id, label, argv, instructionFile, detect }`로 축소.

## 10. 재현·공유 (정규화)

- **공유 단위**: Scene 폴더 1개 또는 Sequence(+참조 신 전체) → `.vsx`(zip) 또는 폴더. 포함: `scene.json`, `GUIDE.md`, `AGENTS.md`, `DESIGN.md`, `prompts/`, `src/`, `params/`, `references/references.json`·`analysis/`, `CREDITS.md`. 제외: `.vanilla/`, 원본 레퍼런스 영상(옵션).
- **정규화**: 가이드 템플릿 ID@버전 기록, 바이트 정규화(§5.1), 용어는 ID 저장, 경로는 상대경로, 해시 매니페스트 `manifest.json`(파일 SHA-256·앱/스키마 버전).
- **재현**: 받은 사람은 가이드·프롬프트로 에이전트를 돌려 재생성하거나, `src/`로 즉시 재생. 스키마 버전 불일치 시 마이그레이션 제안.
- **재활용**: 신을 템플릿으로 저장(내용 초기화 + 구조·가이드 유지) → 새 신 생성 시 선택.

## 11. 기술 영향 (기존 코드 처리)

| 영역 | 처리 |
| --- | --- |
| `src/lib/agents`(ACP), `src-tauri/src/agent_host`, `mcp_server`, 파이프라인 UI·`src/lib/pipeline/prompts` | **제거 또는 `legacy/`로 보관** 후 단순 레지스트리로 대체 (D-022) |
| `src/lib/design`·DESIGN.md 파서, Scene 런타임, Bridge | **유지**·확장 |
| `portable-pty`·xterm 터미널 | **유지**·신 폴더 cwd·클립보드 연동 추가 |
| 파일 와처, FFmpeg 다운로드, 플레이그라운드 | 유지·시퀀스 재생기로 확장 |
| export(PPTX/MP4/PNG) | v2.0 범위 밖. 코드는 보존(후속 재연결) |
| 앱 셸 | 탭/폴더 트리 제거, 사이드바+캔버스+도크 레이아웃으로 교체, i18n·테마 유지 |
| 신규 | 캔버스(`@xyflow/react` 검토), 가이드 엔진(스키마→폼·렌더러), 용어집 콤보박스, 시퀀스 매니저, 패키지(zip) |
| 보안 | 에이전트 셸 확인은 에이전트 CLI 자체 권한에 위임. 앱은 신 폴더 스코프 외 파일 명령 거부 유지, 터미널 실행은 고정 argv만(D-012), 신뢰 확인 전 폴더에서 에이전트 시작 금지(AGENTS.md §7) |

### 11.1 v1 프로젝트 마이그레이션 (D-033)

- 원칙: **원본 비파괴·복사 방식·단방향**. v1 프로젝트 폴더(`vanilla.json`, brief/plan/src/params/DESIGN.md)를 열면 "v2 워크스페이스로 가져오기"를 제안하고 **새 폴더**에 변환 결과를 만든다.
- 매핑: `outputType` → 신 타입(`web`·`slides`→`static`, `video`·`image`→`motion`, `interactive`는 사용자 선택), `DESIGN.md`·`params/`·`src/` 복사, `brief`·`plan.json` → `scene.json`의 `brief`·`beats` 초안으로 **best-effort** 변환(실패 필드는 비우고 에이전트 보완 대상으로 표시), 신 1개 + 시퀀스 노드 1개.
- **출하 조건**: 샘플 프로젝트 3종 이상이 손실 없이 재생될 때만 기능을 출하한다. 미달이면 v2.0에서 제외하고 "v1 앱(`v1-final` 태그)으로 열기"를 안내한다.
- v2 앱은 v1 프로젝트를 직접 열거나 수정하지 않는다.

> AGENTS.md §3·§4·§7과 Technical-Design.md는 v2 승인 후 갱신 대상: ACP 관련 D-010·D-018은 "에이전트 세션 격리"가 사라지므로 **대체/폐기 결정**이 필요하다(D-022에서 다룸).

## 12. 마일스톤 (제안)

| ID | 내용 | 산출/게이트 |
| --- | --- | --- |
| V1 | 기반 정리: 작업 폴더 온보딩·워크스페이스 스위처, 셸 교체(사이드바+캔버스 빈 화면), 레거시 격리 | 앱 실행·`workspace.json` 생성 |
| V2 | Scene CRUD·폴더 스캐폴딩·`scene.json` 스키마(3타입 최소 필드)·`AGENTS.md`/`GUIDE.md` 렌더러 | 신 생성→파일 생성 테스트 |
| V3 | 가이드 템플릿 3종 + 용어집 + 인스펙터 폼(드롭다운) + **사용자 정의 템플릿(복제·편집·`extends`)** | 모션 `commercial-v1` 완전 구현 후 나머지 2종, 사용자 템플릿 E2E |
| V4 | 터미널 실행 + 클립보드 프롬프트 + 상태·썸네일 갱신 | 실제 에이전트로 신 1개 생성 E2E |
| V5 | 레퍼런스 등록·키프레임 추출·분석 프롬프트·반영 diff | 레퍼런스→DESIGN/가이드 반영 E2E |
| V6 | 시퀀스 그래프·전환·플레이그라운드 재생(linear→interactive) | **PoC R-1(전환 합성)** 선행 |
| V7 | 패키지(.vsx) 공유·재현 검증·정규화 테스트·**v1 프로젝트 마이그레이션(§11.1)**·문서/wiki | 다른 PC 재현 검증 |

각 마일스톤 종료 시 `wiki/sources/milestone-<id>.md`와 Playbook 기록(AGENTS.md §9·§10).

## 13. 리스크와 PoC

| ID | 리스크 | 대응 |
| --- | --- | --- |
| R-1 | 신 간 전환(crossfade/mask-wipe 등)을 서로 다른 iframe 신 사이에서 구현 | PoC: 두 iframe 합성 vs 종료/시작 프레임 캡처 오버레이. 미해결 시 v1 전환은 cut/crossfade/slide로 한정 |
| R-2 | 에이전트가 되쓰기 규칙·스키마를 어김 | 되쓰기 후 zod 검증·diff 승인·스냅샷 되돌림 |
| R-3 | 클립보드→에이전트 붙여넣기 UX 마찰 | 자동 붙여넣기 옵션·프롬프트 짧게·실패 시 파일 경로 안내 |
| R-4 | 코드 기반으로 상업 모션 품질 확보 | 가이드의 구현 힌트·골든 샘플(`resources/samples/`)·검수 체크리스트로 규칙화 |
| R-5 | 캔버스 라이브러리가 ComfyUI 외형·성능 요구를 충족하는지 | 스파이크: `@xyflow/react` 100노드 성능·스타일링 |
| R-6 | 레거시 제거 범위로 인한 회귀 | 제거 전 태그(`v1-final`), 유지 모듈 테스트 유지 |
| R-7 | URL 레퍼런스(영상 사이트) 다운로드의 약관·저작권 | URL은 에이전트가 열람하는 참조로만 기록, 앱이 영상을 내려받지 않음 |

## 14. 결정된 질문 (2026-10-05 인터뷰 2차)

| 질문 | 결정 |
| --- | --- |
| 시퀀스 수 | 워크스페이스당 1개. 추가 시퀀스는 새 워크스페이스. 에이전트 구분 규칙 §4.1 (D-029) |
| 화면비·해상도 | 워크스페이스 전역 고정 `workspace.json.canvas` (D-030) |
| 오디오 | v2.0은 기록 전용(재생·렌더 후속) |
| v1 마이그레이션 | 비파괴 복사, 검증 통과 시에만 출하 §11.1 (D-033) |
| 정적 페이지 진행 | 사용자 입력으로만 진행, 내부 step 전환 지원 §8.1 (D-032) |
| 사용자 정의 가이드 템플릿 | v2.0 포함 §6.5 (D-031) |

## 15. 결정된 질문 (인터뷰 3차)

| 질문 | 결정 |
| --- | --- |
| 캔버스 프리셋 | 16:9(1920×1080, 30fps)·9:16(1080×1920)·1:1(1080×1080) + 사용자 지정 (D-030 보강) |
| 정적 페이지 mode | `static.mode: "scroll" \| "steps"` 도입 (D-032 보강) |
| 전역 템플릿 위치·공유 | 설정에서 전역 디렉터리 지정, 팀 공유 폴더로 지정해 공유 (D-031 보강) |

열린 질문 없음 — 사용자 검토·승인 후 Technical-Design 개정, AGENTS.md v2 개정, TODO 재작성 단계로 진행한다.
