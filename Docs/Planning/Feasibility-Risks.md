# 구현 난점 · 리스크 · PoC 계획 (Feasibility & Risks)

- 문서 버전: v0.2 (2026-09-29) — v0.2: 추가 요구사항 RQ15·RQ16(팔레트·DESIGN.md), §2.10, PoC S7
- 목적: 요구사항(`Docs/Vanilla-Studio-Requirements.txt`) 중 **실제 구현이 어려운 부분**을 식별하고, 구현 가능한 형태로 조정한 내역과 사전 검증(PoC) 계획을 기록한다.
- 리서치 출처는 문서 끝 §5에 모았다.

---

## 1. 요구사항별 구현 가능성 검토

| # | 요구사항(원문 요지) | 난이도 | 판단 | 기획 조정 |
| --- | --- | --- | --- | --- |
| RQ1 | Claude Code·Codex·AGY·Hermes·OpenCode를 도구로 사용 | 상 | 가능(조건부) | ACP 표준으로 통일, AGY는 터미널 폴백. MVP 공식 지원은 2종 (D-001) |
| RQ2 | 사용자가 결과물 형태 지정 | 하 | 가능 | 새 프로젝트 마법사 + `vanilla.json` |
| RQ3 | 배경지식·자료 제공 | 하 | 가능 | Brief 편집기 + `brief/materials/` |
| RQ4 | 에이전트가 기획서(화면·asset 배치·움직임·타임라인·구현 방법·커스터마이즈 범위) 작성 | 중 | 가능 | 사람용 `plan.md` + 기계용 `plan.json`(스키마 검증·자동 재요청) |
| RQ5 | 구현 계획서(프롬프트): 개별 asset/animation 단위 + 전체 구현 순서 | 중 | 가능 | `prompts/` 트리 + `tasks.json` 의존성 그래프 |
| RQ6 | 구현 계획서로 화면 작성 | 중 | 가능 | 태스크 순차 실행기 + 계약 검사 + 체크포인트 |
| RQ7 | 검수: 화면·애셋·애니메이션 **수동 조절** | 상 | 부분 가능 | "임의 조절"은 불가 → **에이전트가 선언한 파라미터만** 조절 + 타임라인 스크럽 (D-007) |
| RQ8 | 수정 요청: 결과물 + 구현 계획서 수정해 재요청 | 중 | 가능 | `reviews/R-NNN.md` + 계획서 Revision 섹션 + 전/후 비교 |
| RQ9 | 최종 결과물 export (웹·PPT·이미지·2D/3D 영상·인터랙티브) | 상 | 가능(유형별 품질 차) | Scene 런타임 하나 + export 방식별 파이프라인. 시간 함수 계약은 영상·이미지 계열만 (D-011) |
| RQ10 | React + three.js 앱에서 쓸 수 있는 패키지, 더 범용적인 대안이 있으면 채택 | 중 | 가능 | **Web Component를 범용 인터페이스**, React 래퍼는 얇게 |
| RQ11 | 디자인 템플릿 = 구현 계획서 패키지 | 중 | 가능 | Agent Skill 형식 (D-008) |
| RQ12 | 플레이그라운드(보관·재생), 추후 서버 | 하(로컬) / 상(서버) | 로컬만 MVP | `item.json`에 서버 연동 필드 예약 |
| RQ13 | 생성형 AI 배제, 코딩으로 구성요소를 쌓아 올림 | 중 | 가능 | 절차적 생성 + 사용자 자료 + 오픈 라이선스(출처 기록) (D-006) |
| RQ14 | "심미적으로 뛰어난" 결과물 | **최상** | 보장 불가(품질 목표) | 템플릿 스킬, `vanilla-core` 심미 체크리스트, 에이전트 **시각적 자기 검수**(스냅샷 MCP 도구), 사용자 검수 루프 |
| RQ15 | 컬러 팔레트 기능(같은 형태도 팔레트로 느낌이 달라짐) — 2026-09-29 추가 | 중 | 가능(조건부) | 팔레트 = `DESIGN.md` 색 역할 토큰. 코드가 토큰만 쓰도록 강제해야 교체가 먹힘 (D-016) |
| RQ16 | 디자인 가이드를 표준 `DESIGN.md`로 에이전트에 전달 — 2026-09-29 추가 | 중 | 가능 | Google DESIGN.md 형식 채택, 런타임이 토큰으로 바인딩, 영상은 `frame.md` 보조 (D-015) |

---

## 2. 핵심 난점과 대응

### 2.1 에이전트 이질성 (RQ1) — 위험도: 높음

- **문제**: CLI마다 헤드리스 출력 포맷·권한 모델·세션 재개 방식이 다르다. AGY는 네이티브 ACP 미지원(2026-09 기준, 기능 요청 이슈만 존재).
- **대응**: ACP로 추상화(Claude Code·Codex는 공식 어댑터, OpenCode·Hermes는 네이티브). 어댑터가 없거나 불안정하면 PTY 터미널로 CLI를 그대로 실행하고 파이프라인은 반자동(사용자가 완료 표시).
- **잔여 리스크**: 어댑터의 권한 요청 세분화 수준, `fs` capability 사용 여부가 에이전트마다 다를 수 있음 → S3에서 실측, 에이전트별 "지원 매트릭스" 문서화.

### 2.2 결정적 렌더링 (RQ9 동영상·이미지) — 위험도: 높음

- **문제**: 브라우저 애니메이션은 기본적으로 실시간(벽시계) 기반이라 프레임 캡처 시 끊김·불일치가 생긴다. React 상태 갱신, R3F `useFrame`의 delta, 물리 엔진, 폰트/텍스처 로딩 타이밍이 모두 비결정 요인.
- **대응**:
  1. 런타임 계약: 모든 애니메이션은 `t`의 순수 함수. 금지 API 정적 검사(`check_scene`).
  2. R3F `frameloop="demand"` + 호스트가 시간 주입.
  3. HyperFrames의 가상 시간 + seek 어댑터(three.js는 `hf-seek` 이벤트) 활용.
  4. 로딩 완료 신호(`document.fonts.ready`, 텍스처 프리로드) 후 캡처 시작.
- **잔여 리스크**: ~~Vite 빌드 산출물을 composition으로 인식시키는 방식~~ → S1 통과(2026-09-29): 빌드된 `index.html` 루트에 composition 속성을 두고 `hf-seek`로 시각 주입, 두 렌더가 바이트 동일. 남은 리스크는 에셋 로딩 대기 누락과 GPU/소프트웨어 렌더러 간 픽셀 차이(골든 테스트는 렌더러 고정).

### 2.3 수동 조절의 한계 (RQ7) — 위험도: 중

- **문제**: 에이전트가 자유롭게 쓴 코드를 GUI로 임의 편집하려면 코드↔UI 양방향 동기화가 필요하며 현실적으로 매우 어렵다.
- **대응**: 기획서 단계에서 "조절 가능 범위"를 **파라미터로 선언**하게 하고(요구사항 3번의 "customize 가능한 범위를 미리 제시"와 일치), 값은 코드와 분리된 JSON에 저장. 에이전트는 값 파일을 덮어쓰지 않는다(P5).
- **잔여 리스크**: 파라미터가 부족하면 조절 여지가 작다 → `vanilla-core` 스킬에 "Scene당 최소 파라미터 가이드"(색·텍스트·속도·강도·위치) 포함, 검수 화면에서 "이 요소에 파라미터 추가 요청" 버튼 제공.

### 2.4 HTML → PPTX (RQ9 PPT) — 위험도: 중

- **문제**: PowerPoint의 도형 모델과 HTML/CSS는 1:1 대응하지 않는다. 셰이더·WebGL·복잡한 CSS 효과는 편집 가능한 도형으로 변환 불가.
- **대응**: 기본은 이미지 기반 PPTX/PDF(충실도 100%), 편집 가능 PPTX는 Beta(`dom-to-pptx`)로 "텍스트·도형·이미지 레이어만 편집 가능, WebGL은 이미지로 대체". 슬라이드 템플릿은 텍스트를 DOM 텍스트로 유지하도록 권장.

### 2.5 심미적 품질 (RQ14) — 위험도: 높음(제품 가치 핵심)

- **문제**: 에이전트는 기본적으로 "무난한" 디자인을 만든다. 생성형 이미지 없이 코드만으로 고품질 비주얼을 만들려면 강한 가이드와 시각 피드백이 필요.
- **대응**:
  - 템플릿 스킬에 구체적 디자인 시스템(그리드·타이포 스케일·컬러·모션 원칙)과 **예제 코드**를 포함.
  - 에이전트가 `snapshot_scene`으로 결과를 이미지로 보고 자기 수정(D-014).
  - 기획 단계에서 "무드 레퍼런스"를 텍스트로 구체화하도록 기획 프롬프트 설계.
  - 품질 기준은 강의·데모용 샘플 브리프 5종으로 정기 평가(골든 샘플).

### 2.6 프리뷰 환경 (RQ7 검수) — 위험도: 중

- **문제**: 에이전트가 쓴 코드를 즉시 보려면 번들러가 필요. WebView2(Edge)와 export용 Chrome의 렌더 차이, 여러 WebGL 컨텍스트 메모리.
- **대응**: 프로젝트별 Vite dev server(HMR) + iframe. 동시 WebGL 미리보기 2개 제한. 최종 확인은 export용 렌더 스냅샷으로.

### 2.7 런타임 의존성 설치 부담 — 위험도: 중

- **문제**: Node 22+, pnpm, 에이전트 CLI와 로그인, FFmpeg, Chrome이 필요해 비개발자에게 장벽.
- **대응**: Doctor 화면(D-005)에서 단계별 점검·설치 안내, FFmpeg는 앱이 다운로드. 프로젝트 `node_modules`는 pnpm 전역 스토어 공유로 디스크 절약.

### 2.8 보안 — 위험도: 중

- 에이전트는 사용자 PC에서 코드를 실행한다. 템플릿 기본값 `assetProtocol.scope: ["**"]`는 과도하게 넓다. → 기술 설계서 §10 대책, 셸 매번 확인(D-010), 앱 소유 프로세스 고정 argv(D-012).

### 2.9 라이선스 — 위험도: 중

| 대상 | 라이선스 | 판단 |
| --- | --- | --- |
| HyperFrames | Apache-2.0 | 사용 가능, NOTICE 포함 |
| Remotion | 4인 이상 조직 유료 | 미채택 |
| GSAP | 무료(표준 "No Charge" 라이선스) — 단 **Webflow와 경쟁하는 노코드 비주얼 애니메이션 빌더에서의 사용 금지** | 앱 기능은 GSAP 비의존. 에이전트가 생성한 코드 안에서의 사용은 FAQ상 허용(AI 생성 코드). 배포 전 법률 검토 권장 |
| three.js / R3F / drei / motion / animejs / pptxgenjs | MIT | 사용 가능 |
| dom-to-pptx | MIT(확인 필요) | Beta 기능, 번들 전 확인 |
| FFmpeg | LGPL/GPL(빌드별) | 앱에 번들하지 않고 **사용자 동의 후 다운로드**해 별도 프로세스로 실행. HyperFrames의 MP4 인코딩은 libx264가 필요해 **GPL 빌드**를 받는다(S1). LGPL 빌드는 WebM만 가능. 배포 전 법률 검토 |
| 폰트·CC0 에셋 | OFL/CC0 | `CREDITS.md` 기록 |
| DESIGN.md 명세·CLI(`@google/design.md`) | Apache-2.0 (alpha) | 사용 가능, 버전 고정 |
| HyperFrames FRAME.MD 형식·프리셋 | Apache-2.0(소개 자료 기준) ⚠️ | 참고용. 프리셋 폰트는 개별 라이선스 확인(대부분 Google Fonts OFL로 보임) |
| HyperFrames 카탈로그 항목 | 저장소 Apache-2.0, 항목별 `license` 필드는 선택 ⚠️ | 참고용(D-017). GSAP 기반이므로 복사하지 않고 런타임으로 재구현, 차용 시 항목별 확인 + `CREDITS.md` |
| `yaml` / `culori` | ISC / MIT | 사용 가능 |
| 내장 팔레트 | 자체 제작(CC0로 배포) | 외부 팔레트 사이트의 색 조합을 그대로 가져오지 않음 |

### 2.10 디자인 시스템 표준화·팔레트 (RQ15·RQ16) — 위험도: 중

- **문제 1 — 형식 변동**: DESIGN.md는 2026-04 공개된 `alpha` 형식이라 스키마·CLI가 바뀔 수 있다.
  - 대응: 앱은 자체 zod 스키마로 필요한 부분(front matter 토큰)만 관대하게 읽는다. 공식 CLI는 버전 고정, 선택적 검사로만 사용. 모르는 키는 보존.
- **문제 2 — 팔레트가 먹히지 않는 코드**: 에이전트가 색을 코드에 하드코딩하면 팔레트를 바꿔도 결과물이 안 바뀐다.
  - 대응: `vanilla-core` 규칙(토큰만), `check_scene` 하드코딩 경고, 검수 화면 "토큰 미사용 n건" 표시와 "토큰으로 바꿔 달라" 수정 요청 버튼, 템플릿 예제 코드의 모범 사용.
- **문제 3 — CSS 밖의 색**: three.js 재질·셰이더 uniform·Canvas 2D는 CSS 변수를 직접 못 쓴다.
  - 대응: `useDesign()`으로 JS 값을 제공하고, 교체 시 R3F `invalidate()`. 셰이더는 uniform으로 받게 스킬에서 안내.
- **문제 4 — 교체 후 품질**: 팔레트를 바꾸면 대비가 깨지거나 역할이 어울리지 않을 수 있다.
  - 대응: 역할 쌍 WCAG 대비 경고, 라이트/다크 `scheme` 태그로 템플릿과 맞지 않는 팔레트 표시, 팔레트 비교 스냅샷(F-PAL-07).
- **문제 5 — 본문과 토큰 불일치**: 팔레트 교체는 front matter만 바꾸므로, 본문에 hex를 적어 두면 설명과 값이 어긋난다.
  - 대응: 본문은 역할 이름으로만 색을 설명하도록 스킬에서 안내하고, 검증에서 본문의 hex 리터럴을 경고.

---

## 3. PoC(사전 검증) 계획 — 구현 계획서 작성 단계의 첫 작업

| ID | 검증 내용 | 성공 기준 | 실패 시 대안 |
| --- | --- | --- | --- |
| S1 | React + R3F Scene(Vite 빌드)을 HyperFrames로 MP4 렌더 | 15초·30fps·1080p 렌더, 두 번 렌더 결과 프레임 동일, 소요 시간 기록 | 자체 CDP 가상 시간 캡처 + FFmpeg |
| S2 | 동일 빌드에서 특정 `t` 스틸 캡처(PNG @2x) + 이미지 PPTX 생성 | 폰트·텍스처 로딩 누락 없음 | puppeteer-core + 시스템 Edge |
| S3 | Rust ACP 클라이언트로 Claude Code·Codex 어댑터 구동 + `vanilla-tools` MCP 서버 연결(D-014) | 세션 생성·프롬프트·스트리밍·권한 요청·fs 요청·취소 동작, 에이전트가 MCP 도구 호출 성공, 에이전트별 매트릭스 작성 | TS SDK(Node 사이드카)로 클라이언트 구현 |
| S4 | Tauri WebView2 안 iframe으로 Vite dev server 표시 + Bridge(seek·setParams) | HMR 동작, 파라미터 반영 < 100ms, IPC 격리 확인 | 별도 WebviewWindow 사용 |
| S5 | `dom-to-pptx`로 샘플 슬라이드 3종 편집 PPTX 변환 | PowerPoint에서 텍스트 편집 가능, 레이아웃 오차 허용 범위 | Beta 기능 제외 |
| S6 | Windows Doctor: Node/pnpm/git/CLI/FFmpeg/Chrome 탐지와 FFmpeg 다운로드 | 깨끗한 Windows에서 안내대로 준비 완료 | 수동 설치 문서 |
| S7 | `DESIGN.md` 토큰 파이프라인 + 팔레트 교체: HyperFrames 프리셋 수준의 샘플 DESIGN.md를 Vite 플러그인으로 읽어 CSS 변수·`useDesign()` 제공, Bridge `setDesign`으로 교체, `colors`만 다시 쓰기, 공식 CLI `lint` | 교체 반영 < 100ms(DOM·R3F 모두), 본문 바이트 보존 왕복, 파일 수정 시 HMR, 두 팔레트 렌더 결과가 색만 다름, 표준 색 역할로 프리셋 12종 표현 가능 | 앱이 `tokens.css`·`tokens.ts` 생성 파일을 쓰는 방식 / 공식 CLI 대신 자체 검사만 |

PoC 코드는 `spikes/<id>-<topic>/`에 두고, 결과는 `wiki/sources/poc-<id>.md`로 기록한 뒤 기술 설계서의 ⚠️ 항목을 갱신한다.

**진행 현황**

| ID | 상태 | 결과 |
| --- | --- | --- |
| S1 | ✅ 통과 (2026-09-29) | MP4 2회 렌더 바이트 동일, 15초 1080p 약 18초. FFmpeg는 GPL 빌드 필요 — `wiki/sources/poc-s1.md` |
| S2~S7 | 대기 | |

---

## 4. 가정 (Assumptions)

- 사용자는 최소 1개의 코딩 에이전트 구독과 로그인된 CLI를 가지고 있다.
- 앱은 LLM API를 직접 호출하지 않으며 비용은 사용자의 에이전트 구독에서 발생한다.
- 인터넷은 에이전트 사용과 최초 의존성 설치에만 필요하다.

---

## 5. 리서치 출처 (2026-09-28 조사)

- ACP 에이전트 목록: https://agentclientprotocol.com/get-started/agents
- ACP Rust SDK: https://github.com/agentclientprotocol/rust-sdk , TypeScript: https://agentclientprotocol.com/libraries/typescript
- Hermes Agent ACP: https://hermes-agent.nousresearch.com/docs/user-guide/features/acp
- Antigravity CLI 헤드리스 모드: https://antigravity.google/docs/cli/headless/ , ACP 기능 요청: https://github.com/google-antigravity/antigravity-cli/issues/31
- HyperFrames: https://github.com/heygen-com/hyperframes , 프레임 어댑터: https://hyperframes.heygen.com/concepts/frame-adapters
- 결정적 HTML→영상 기법: https://blog.replit.com/browsers-dont-want-to-be-cameras , https://dsplce.co/lab/claude-animation-to-video
- Remotion 라이선스: https://www.remotion.dev/docs/license/faq
- GSAP 표준 라이선스: https://gsap.com/community/standard-license/
- dom-to-pptx: https://github.com/atharva9167j/dom-to-pptx , PptxGenJS 기반

추가 조사 (2026-09-29)

- DESIGN.md 명세·CLI: https://github.com/google-labs-code/design.md
- DESIGN.md 오픈소스 공개 소식: https://the-decoder.com/googles-open-source-design-md-gives-ai-agents-a-prompt-ready-blueprint-for-brand-consistent-design/
- HyperFrames FRAME.MD 프리셋·변환기: https://www.hyperframes.dev/design , 설명: https://www.therundown.ai/tools/frame-md
- HyperFrames 카탈로그: https://hyperframes.heygen.com/catalog , 항목 구조: https://hyperframes.heygen.com/contributing/catalog.md , 검색: https://hyperframes.heygen.com/developers/catalog-search.md
- HyperFrames에서 DESIGN.md 토큰 바인딩: https://github.com/heygen-com/hyperframes/blob/main/docs/guides/open-design-hyperframes.md
