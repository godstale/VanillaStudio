# VANILLA_GUIDE.md — Vanilla Studio 동작 가이드 · 구조/파라미터 레퍼런스 · 템플릿 카탈로그

- Workspace: **{{workspaceName}}** (`{{workspaceId}}`)

이 문서는 AI 에이전트가 Vanilla Studio의 동작 원리, 시퀀스(`sequence.json`) 및 신(`scene.json`) 데이터 구조, 런타임 파라미터(`@vanilla/runtime`), 참조 가능한 템플릿·기법·컬러 팔레트(미리보기 이미지 및 라이브 데모 링크 포함), 그리고 스튜디오와의 연동 방법을 이해할 수 있도록 초기화 시 자동 생성된 통합 가이드입니다.

---

## 1. Vanilla Studio 동작 원리와 에이전트 협업 모델

1. **작업 폴더 1개 = 워크스페이스 1개 = 시퀀스 1개 (`sequence.json`)**
   - 워크스페이스 내 모든 신(`scenes/<slug>/`)은 동일한 캔버스 규격(`workspace.json.canvas`: `aspect`, `width`, `height`, `fps`)과 기본 디자인 시스템(`DESIGN.md`)을 공유합니다.
2. **역할 분담**
   - **AI Agent (생성 및 수정 주체)**: 사용자의 요청을 인터뷰로 구체화하여 어울리는 템플릿·관점·기법·파라미터를 선정하고, 러프 초안(Draft)부터 최종 코드(`scenes/<slug>/src/`)까지 작성합니다.
   - **Vanilla Studio (확인 및 세부 조율 도구)**: 사용자가 에이전트가 만든 시퀀스와 신을 실시간 재생·검수하고, 인스펙터에서 가이드/파라미터/팔레트를 조정하거나 코멘트를 남깁니다.
3. **변경사항 및 코멘트 동기화 (`WORK_ORDER.md`)**
   - 사용자가 Vanilla Studio에서 변경한 시퀀스/신/파라미터/디자인 내역과 코멘트는 루트 `WORK_ORDER.md` (`.vanilla/work-order.json`) 및 `scenes/<slug>/comments.json`에 즉시 기록됩니다.

---

## 2. 시퀀스(`sequence.json`) 구조와 세부 파라미터

파일 위치: `<workspace>/sequence.json`

```json
{
  "version": 1,
  "workspaceId": "{{workspaceId}}",
  "id": "seq_main",
  "mode": "linear",
  "nodes": [
    { "sceneId": "scn_01...", "pos": { "x": 80, "y": 120 } },
    { "sceneId": "scn_02...", "pos": { "x": 420, "y": 120 } }
  ],
  "edges": [
    {
      "from": "scn_01...",
      "to": "scn_02...",
      "trigger": "end",
      "transition": {
        "type": "crossfade",
        "durationMs": 600,
        "easing": "ease-in-out",
        "params": {}
      }
    }
  ],
  "start": "scn_01..."
}
```

| 필드 | 역할 및 제약 규칙 |
| --- | --- |
| `mode` | `"linear"` (순차 재생: 영상·슬라이드) 또는 `"interactive"` (다중 분기 허용). `linear`일 때는 신당 나가는 엣지가 최대 1개이며 `choice:*` 트리거를 사용할 수 없습니다. |
| `nodes[]` | 시퀀스 캔버스 위 신 노드 목록 (`sceneId`는 `scenes/*/scene.json`의 `id`와 일치해야 함, `pos`는 캔버스 좌표 `{x, y}`). |
| `edges[].trigger` | 다음 신으로 넘어가는 조건:<br>- `"end"`: `motion`·`3d` 신의 재생이 끝났을 때 (`static` 신에서는 사용 금지)<br>- `"timeout:<N>s"`: 지정 초 경과 시 (`static` 신에서는 사용 금지)<br>- `"click"`: 화면 클릭 시 (`static` steps 신은 마지막 step 이후 발동)<br>- `"key:<Key>"`: 키 입력 시 (예: `"key:ArrowRight"`, `"key:Space"`)<br>- `"choice:<label>"`: 인터랙티브 분기 선택 시 (`mode: "interactive"` 전용) |
| `edges[].transition` | 신 전환 효과:<br>- `type`: `"cut"` \| `"crossfade"` \| `"slide-left"` \| `"slide-right"` \| `"slide-up"` \| `"slide-down"` \| `"mask-wipe"` \| `"circular-reveal"` \| `"zoom-through"` \| `"custom:<name>"`<br>- `durationMs`: 전환 시간(ms, `cut`은 0)<br>- `easing`: `"linear"` \| `"ease"` \| `"ease-in"` \| `"ease-out"` \| `"ease-in-out"` \| `"cubic-bezier(...)"` |
| `start` | 시퀀스 시작 신의 `sceneId` (노드가 없을 때는 `null`). |

---

## 3. 신(`scenes/<slug>/scene.json`) 구조와 타입별 세부 파라미터

신 타입(`type`)은 **`"static"`**(정적 웹/슬라이드), **`"motion"`**(2D/타이포/UI 모션 그래픽), **`"3d"`**(Three.js / R3F 3D 애니메이션) 3가지입니다.

### 3.1 공통 필드

| 필드 | 타입 | 정의 및 역할 |
| --- | --- | --- |
| `version` | `1` | 스키마 버전 (고정 `1`). |
| `id` | `string` | 불변 신 ID (`scn_` + 영숫자, 폴더명이 바뀌어도 유지). |
| `name` | `string` | 사용자 표시용 신 이름. |
| `type` | `"static" \| "motion" \| "3d"` | 신 런타임 타입 (`motion`·`3d`는 시간 순수 함수 계약, `static`은 사용자 입력 진행). |
| `template` | `string` | 적용된 가이드 템플릿 ID (`<id>@<ver>`, 예: `"opus-keynote-launch@1"`). |
| `brief` | `object` | `{ mediaIntent?: "web"\|"image"\|"slide"\|"motion", subject, goal, audience, message, language: "ko"\|"en" }` — 기획 의도와 핵심 메시지. |
| `references` | `array` | 참조 레퍼런스 목록 (`{ id, kind: "video"\|"image"\|"url", path, url, note, analysis }`). |
| `userPrompt` | `string` | 사용자의 추가 자유 지시문. |
| `runtime` | `object` | `{ contract: "scene-runtime@1", entry: "src/index.html" }`. |
| `status` | `string` | `"draft"` (러프 초안) \| `"prompt-ready"` (가이드 작성 완료) \| `"generated"` (구현 완료) \| `"needs-revision"` (수정 필요). |

### 3.2 `motion` 및 `3d` 전용 필드 (시간 구동 애니메이션)

| 필드 | 정의 및 역할 |
| --- | --- |
| `duration` | `{ "seconds": 10 }` — 신 총 재생 시간(초). 모든 `beats[]` 구간의 합과 일치해야 합니다. |
| `creativeMode` | 연출 모드 배열 (예: `["premium-product-motion", "kinetic-typography", "ui-ux-showcase", "brand-film-manifesto"]`). |
| `structure` | `"multi-shot"` (비트별 컷 전환) \| `"continuous"` (원테이크 연속 변형) \| `"hybrid"`. |
| `adStructure` | 서사 구조 (예: `"problem-to-breakthrough"`, `"typography-led"`, `"ui-transformation"`, `"product-hero-reveal"`, `"feature-cascade"`). |
| `brandVoice` | 브랜드 톤 배열 (예: `["confident", "minimal", "technical", "bold", "warm", "futuristic"]`). |
| `visualStyle` | `{ medium, lighting, typography, density, cameraFeeling, mood }` — 시각 연출 톤. |
| `motionVocabulary` | `{ typography: [], object: [], camera: [], material: [], transition: [] }` — 사용할 모션 기법 ID 목록. |
| `beats[]` | 시간 구간 배열 (`0`초부터 빈틈없이 연속되어 마지막 `end === duration.seconds`):<br>`{ id, start, end, role, copy, visual, motion: [], camera, transitionOut, notes }` |
| `copy` | `{ textFidelity: "exact" \| "paraphrase", items: [] }` — 화면에 토씨 하나 틀리지 않고 그대로 렌더링해야 할 원문 카피 목록. |
| `identity` | `{ product, character, mustKeep: [] }` — 유지해야 할 제품/브랜드 고유 특징. |
| `endCard` | `{ holdSeconds: 0.85, elements: [] }` — 마지막 엔드카드 유지 시간(`>= 0.7`초 필수) 및 표시 요소. |
| `constraints` | `{ avoid: [], noUnspecifiedElements: true }` — 금지 연출 및 미지정 요소 배제 규칙. |

### 3.3 `3d` 추가 전용 필드

| 필드 | 정의 및 역할 |
| --- | --- |
| `composition` | 3D 씬 공간 구도 (예: `"hero-turntable"`, `"isometric-diorama"`, `"floating-cluster"`, `"tunnel-flythrough"`). |
| `materials[]` | 재질 ID 목록 (예: `["pbr-metallic", "transmission-glass", "emissive-neon", "custom-glsl-shader"]`). |
| `lighting` | 조명 세팅 (예: `"three-point-studio"`, `"hdri-environment"`, `"dramatic-rim"`). |
| `cameraPath` | 카메라 궤적 (예: `"slow-orbit"`, `"dolly-in-hero"`, `"crane-reveal"`, `"keyframed-spline"`). |
| `performanceBudget` | 렌더링 예산 (예: `"60fps-desktop-100k-tris-max-2-lights"`). |

### 3.4 `static` 전용 필드 (웹 페이지 · 슬라이드 · 인터랙티브 덱)

| 필드 | 정의 및 역할 |
| --- | --- |
| `mode` | `"scroll"` (단일 페이지 스크롤) 또는 `"steps"` (PPT/덱처럼 클릭·키 입력으로 내부 단계 이동). |
| `layout` | 레이아웃 구조 (예: `"editorial-hero"`, `"bento-grid"`, `"split-narrative"`, `"interactive-canvas"`). |
| `sections[]` | 구성 섹션 ID 배열 (예: `["hero", "metrics-strip", "architecture-diagram", "cta-footer"]`). |
| `steps[]` | `mode: "steps"`일 때 단계 정의: `{ id, title, advance: "click"\|"key:ArrowRight"\|"choice:<label>", enter, copy }`. |
| `breakpoints[]` | 반응형 브레이크포인트 (예: `["1920x1080", "1280x720"]`). |
| `accessibility[]` | 접근성 체크 항목 (예: `["wcag-aa-contrast", "keyboard-nav"]`). |

---

## 4. `@vanilla/runtime` 및 세부 조절 파라미터(`param.*`) 정의

에이전트가 `scenes/<slug>/src/`에서 신을 구현할 때 사용자가 Vanilla Studio UI에서 실시간으로 미세 조절할 수 있도록 `defineScene`의 `params`에 파라미터를 선언합니다. 사용자가 조정한 값은 `scenes/<slug>/params/<sceneId>.values.json`에 저장됩니다.

```tsx
import { defineScene, param, token, useTime, useParams, useDesign, useFrame, ease, clamp01 } from '@vanilla/runtime';

const params = {
  headline: param.text('Launch Faster', { label: '헤드라인 문구' }),
  speed: param.number(1.0, { min: 0.2, max: 3.0, step: 0.1, label: '재생 속도 배율' }),
  accentColor: param.color(token('accent'), { label: '강조 색상' }),
  showGrid: param.boolean(true, { label: '배경 그리드 표시' }),
  layoutStyle: param.select('centered', ['centered', 'split', 'editorial'] as const, { label: '배치 스타일' }),
};

function HeroScene() {
  const t = useTime(); // motion·3d: 현재 시간(초). 같은 t는 항상 같은 화면을 그려야 함!
  const { width, height, fps } = useFrame(); // workspace.json의 전역 캔버스 규격
  const { headline, speed, accentColor, showGrid, layoutStyle } = useParams<typeof params>();
  const design = useDesign(); // DESIGN.md 토큰 ({ colors, typography, spacing, rounded })
  const progress = ease.expoOut(clamp01((t * speed) / 1.5));

  return (
    <div style={{ width, height, background: 'var(--color-canvas)', color: 'var(--color-ink)' }}>
      {/* 구현 */}
    </div>
  );
}

export default defineScene({
  id: 'scn_hero',
  duration: 6,
  params,
  Component: HeroScene,
});
```

---

## 5. 참조 템플릿 · Opus 분해 프리셋 · 컬러 팔레트 및 미리보기/데모 링크

> 터미널에서 `pnpm vanilla templates` 또는 `pnpm vanilla inspect-template <id>`를 실행하면 각 템플릿의 상세 규칙(`rules.md`), 기본값, 구현 힌트를 즉시 가져올 수 있습니다. 원본 데이터는 `.vanilla/resources/`에 저장되어 있습니다.

### 5.1 내장 가이드 템플릿 (15종)

| 템플릿 ID (`template`) | 신 타입 | 매체 의도 (`mediaIntent`) | 특징 및 용도 | 미리보기 이미지 (`previewUrl`) | 동작 확인 (`actionUrl`) |
| --- | --- | --- | --- | --- | --- |
| `commercial@1` | `motion` | `motion` | 상업용 모션 그래픽 기본 템플릿 (멀티샷 비트·타이포·제품 연출) | `https://media.skillry.dev/opus55-videos/thumbs/commercial-v1.jpg` | `https://skillry.dev/opus55` |
| `web-page@1` | `static` | `web`, `slide` | 정적 웹/슬라이드 기본 템플릿 (`scroll` / `steps` 모드) | `https://media.skillry.dev/opus55-videos/thumbs/web-page-v1.jpg` | `https://skillry.dev/opus55` |
| `three-scene@1` | `3d` | `motion`, `web` | Three.js / R3F 결정적 3D 씬 기본 템플릿 | `https://media.skillry.dev/opus55-videos/thumbs/three-scene-v1.jpg` | `https://skillry.dev/opus55` |
| `opus-ui-morph-loop@1` | `motion` | `motion`, `web` | SaaS/AI 제품 UI 카드 연속 모핑 및 커서 인터랙션 쇼케이스 | `https://media.skillry.dev/opus55-videos/thumbs/ui-morph-loop.jpg` | `https://skillry.dev/opus55/ui-morph-loop` |
| `opus-keynote-launch@1` | `motion` | `motion`, `slide` | 애플/테크 키노트 스타일 대형 타이포 + 벤토 그리드 제품 발표 | `https://media.skillry.dev/opus55-videos/thumbs/keynote-launch.jpg` | `https://skillry.dev/opus55/keynote-launch` |
| `opus-kinetic-manifesto@1` | `motion` | `motion` | 고대비 스위스 그리드 & 탄성 스플릿 플랩 키네틱 타이포 매니페스토 | `https://media.skillry.dev/opus55-videos/thumbs/kinetic-manifesto.jpg` | `https://skillry.dev/opus55/kinetic-manifesto` |
| `opus-science-explainer@1` | `motion` | `motion`, `slide` | 수식·아키텍처 다이어그램·신호 흐름 과학/기술 해설 애니메이션 | `https://media.skillry.dev/opus55-videos/thumbs/science-explainer.jpg` | `https://skillry.dev/opus55/science-explainer` |
| `opus-kinetic-poster@1` | `motion` | `image`, `motion` | 전시·브랜드용 고밀도 루프형 키네틱 포스터 & 엠블럼 | `https://media.skillry.dev/opus55-videos/thumbs/kinetic-poster.jpg` | `https://skillry.dev/opus55/kinetic-poster` |
| `opus-pixel-illustration@1` | `motion` | `image`, `motion` | 절차적 SVG/Canvas 코지 일러스트레이션 & 레트로 픽셀 아트 씬 | `https://media.skillry.dev/opus55-videos/thumbs/pixel-illustration.jpg` | `https://skillry.dev/opus55/pixel-illustration` |
| `opus-interactive-hero@1` | `static` | `web` | 마그네틱 인터랙션·벤토 쇼케이스를 갖춘 에디토리얼 웹 히어로 | `https://media.skillry.dev/opus55-videos/thumbs/interactive-hero.jpg` | `https://skillry.dev/opus55/interactive-hero` |
| `opus-simulator-canvas@1` | `static` | `web` | 실시간 파라미터 조작 패널이 결합된 인터랙티브 시뮬레이터 캔버스 | `https://media.skillry.dev/opus55-videos/thumbs/simulator-canvas.jpg` | `https://skillry.dev/opus55/simulator-canvas` |
| `opus-narrative-deck@1` | `static` | `slide` | 단계별(`steps`) 키보드/클릭 진행형 키노트 내러티브 프레젠테이션 덱 | `https://media.skillry.dev/opus55-videos/thumbs/narrative-deck.jpg` | `https://skillry.dev/opus55/narrative-deck` |
| `opus-data-explainer-deck@1` | `static` | `slide`, `web` | KPI 카운터·비교 차트·아키텍처 레이어를 단계별로 보여주는 데이터 덱 | `https://media.skillry.dev/opus55-videos/thumbs/data-explainer-deck.jpg` | `https://skillry.dev/opus55/data-explainer-deck` |
| `opus-3d-explorer@1` | `3d` | `motion`, `web` | PBR 글래스/메탈 지오메트리와 궤도 카메라를 활용한 3D 공간 탐색 | `https://media.skillry.dev/opus55-videos/thumbs/3d-explorer.jpg` | `https://skillry.dev/opus55/3d-explorer` |
| `opus-shader-cinematic@1` | `3d` | `motion`, `image` | 커스텀 GLSL 셰이더 필드와 볼류메트릭 라이팅 시네마틱 3D 아트 | `https://media.skillry.dev/opus55-videos/thumbs/shader-cinematic.jpg` | `https://skillry.dev/opus55/shader-cinematic` |

### 5.2 세부 항목별 분해 프리셋 (`opus-catalog.json` — `pnpm vanilla templates`로 상세 조회)

- **신/비트 구조 (`scene-beats`)**: `beats-5s-punchy-launch` (5초 4비트 임팩트 런치), `beats-10s-ui-walkthrough` (10초 5비트 UI 워크스루), `beats-12s-cinematic-story` (12초 시네마틱 서사), `steps-5-slide-narrative` (5단계 프레젠테이션 스텝 구조)
- **타이포그래피·비주얼 스타일 (`typography-style`)**: `typo-swiss-brutalist-grid`, `typo-apple-keynote-display`, `typo-warm-editorial-serif`
- **모션 어휘·효과 키트 (`motion-effects`)**: `fx-spring-ui-choreography`, `fx-kinetic-text-slam`, `fx-diagram-vector-draw`
- **3D 구도·재질·카메라 (`3d-stage`)**: `stage-3d-glass-turntable`, `stage-3d-shader-monolith`

### 5.3 내장 컬러 팔레트 (`DESIGN.md` 적용용 — 14종)

- 기본 팔레트: `vanilla-default`, `editorial-warm`, `midnight-neon`, `paper-ink`, `forest-sand`, `cobalt-cream`
- Opus 특화 팔레트: `opus-keynote-lime`, `opus-cobalt-cyan`, `opus-spotify-editorial`, `opus-botanical-parchment`, `opus-cyber-magenta`, `opus-orbital-coral`, `opus-studio-mint`, `opus-magnetic-monument`

---

## 6. 바닐라 스튜디오 ↔ 에이전트 연동 프로토콜

1. **초기 기획 & 인터뷰**:
   - `pnpm vanilla templates --intent <web|image|slide|motion> --query "<키워드>"`를 실행해 후보 템플릿·프리셋·팔레트를 확인하고 사용자에게 제안합니다.
2. **신 스캐폴딩 (Draft 생성)**:
   - `pnpm vanilla scaffold-scene <slug> --name "<이름>" --type <static|motion|3d> --template <id@ver>` 명령을 실행하면 `scenes/<slug>/` 폴더, `scene.json`, `GUIDE.md`, `AGENTS.md`, `comments.json`, 러프 `src/` 코드가 생성되고 `sequence.json`에 노드가 자동 추가됩니다.
3. **가이드 동기화**:
   - 에이전트가 `scenes/<slug>/scene.json`의 필드(`beats`, `steps`, `visualStyle`, `motionVocabulary` 등)를 직접 수정한 뒤에는 반드시 `pnpm vanilla sync-guides <slug>`를 실행해 `GUIDE.md`(해시 헤더 포함)와 신 `AGENTS.md`를 최신 상태로 맞춥니다.
4. **작업 지시서(`WORK_ORDER.md`) 확인 및 완료 처리**:
   - 사용자가 Vanilla Studio에서 변경한 내역이나 코멘트는 `pnpm vanilla work-order` (또는 `WORK_ORDER.md` 열람)로 확인합니다.
   - 반영을 마친 항목은 `pnpm vanilla resolve <id>` (예: `pnpm vanilla resolve cmt_...` 또는 `pnpm vanilla resolve chg_...`)로 완료(`done`) 처리합니다.

---

## 7. 앱 없이 재생·발표하기 (Standalone Play)

워크스페이스는 Vanilla Studio 없이도 자체 빌드·재생할 수 있습니다. 발표용 재생 화면(`play.html`)은 스튜디오 플레이그라운드와 같은 Bridge 프로토콜(v2: 타입 입력 위임·`step`/`done`)로 신과 대화합니다.

| 명령 | 동작 |
| --- | --- |
| `pnpm dev` | Vite 개발 서버를 띄웁니다. 루트(`/`)가 `play.html`로 리다이렉트되므로 출력된 URL이 바로 재생 화면입니다. |
| `pnpm play` | 브라우저에 `play.html`을 바로 엽니다 (개발 서버 + 자동 열기). |
| `pnpm build` | `play.html`과 모든 신 엔트리(`scenes/<slug>/src/index.html`)를 `dist/`에 묶습니다. |
| `pnpm preview` | 빌드 결과(`dist/play.html`)를 정적 서빙으로 최종 확인합니다. |

- 화면 구성: 상단 신 목록·진행률(`3 / 23`), 하단 처음부터·이전/다음 신·(정적 신) 이전/다음 단계·(시간 신) 재생/일시정지·시크바·전체화면, 분기 신은 화면 아래 선택지, 주소 `#/play/<sceneId>`로 특정 신 딥링크.
- 입력 라우팅: 클릭·키 입력은 신의 진행 규칙(`advance`)에 맞는 타입 입력으로 위임됩니다. 마지막 단계 입력이 다음 신으로 넘깁니다 (`static`의 `done` → 시퀀스 엣지 `trigger` 평가).
- 차이점: 신 전환 연출은 컷/페이드로 단순화됩니다 (스튜디오의 전환 합성과 다름). 구 런타임(v2.1 `input` 이전) 신에서는 클릭·키 위임이 무시되므로 `‹` `›` 단계 버튼을 쓰세요.
- `dist/`는 반드시 http(s) 정적 서버로 여세요 (`pnpm preview`). 파일 직접 열기(`file://`)에서는 모듈·`postMessage` Bridge가 동작하지 않습니다.

### 기존 워크스페이스에 적용하기 (이 템플릿 이전에 만든 폴더)

워크스페이스를 Vanilla Studio에서 다시 열면 `play.html`·`play/`가 자동 복사되고 `VANILLA_GUIDE.md`가 갱신됩니다.
아래 4종은 사용자 소유 파일이라 자동 교체되지 않으니 직접 합치세요 (신규 워크스페이스는 불필요):

1. `package.json` scripts에 `"play": "vite --open play.html"`, `"preview": "vite preview --open play.html"` 추가.
2. `vite.config.ts`를 템플릿 최신본으로 교체 (멀티 엔트리 + `base: './'`).
3. `index.html`을 템플릿 최신본으로 교체 (`play.html` 리다이렉트, `{{workspaceName}}`은 실제 이름으로).
4. `tsconfig.json`: `include`에 `"play"` 추가, `compilerOptions`에 `"resolveJsonModule": true`, `"types": ["vite/client"]` 추가.

---

## 8. 수업 배포용 zip 만들기 (`pnpm pack`)

다른 PC에 워크스페이스를 전달할 때는 폴더를 그대로 압축하지 마세요
(`node_modules/`·`dist/`가 들어가면 용량이 크고 PC마다 꼬입니다).
워크스페이스 루트에서 `pnpm pack`을 실행하면 옆 폴더에 `<workspace>.zip`이 만들어집니다
(출력 변경: `node scripts/pack-workspace.mjs --out <file.zip>`, Win/Mac/Linux 공용, 의존성 없음).

- 포함: `pnpm-lock.yaml`(재현 설치용) + `pnpm-workspace.yaml`(`minimumReleaseAge: 0`).
  pnpm v11+ 기본 24시간 게이트를 끄므로 받는 쪽은 추가 옵션 없이 `pnpm install`만 하면 됩니다
  (갓 발행된 전이 패키지 `caniuse-lite`가 있어도 통과).
- 제외: `node_modules/`·`dist/`·`.vanilla/`·`.git/`·로그·`.env*`·심링크.
- 받는 쪽 순서: 압축 풀기 → `pnpm install` → `pnpm dev`.
- 기존 폴더는 Studio에서 다시 열면 `pack` 스크립트·`pnpm-workspace.yaml`이 자동 보충됩니다.
  `package.json` scripts에 `"pack": "node scripts/pack-workspace.mjs"` 한 줄만 직접 추가하세요.
