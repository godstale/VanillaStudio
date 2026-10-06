---
title: 'Milestone V6: 시퀀스·플레이그라운드'
type: source
tags: [milestone, v2, sequence, playground, transitions]
date: 2026-10-06
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, milestone-v5, technical-design, poc-r1]
last_updated: 2026-10-06
---

브랜치 `feat/v2-sequence`. TODO T6.0~T6.8 완료(GUI 확인 대기). 이전: [[milestone-v5]]. 계획: [[implementation-plan]]. PoC: [[poc-r1]].

## 한 일

- **PoC R-1(T6.0)**: 두 iframe 오버레이 채택(5종 전환 60fps), `match-cut` 제외, `custom`은 선언형. → [[poc-r1]]
- **시퀀스 검증(T6.1)**: `sequence/validate.ts` — workspaceId·없는 신·static 자동 trigger(D-032)·모호한 분기·입력 없는 순환·linear 규칙·시작 신 도달성·알 수 없는 전환.
- **캔버스 엣지 편집(T6.2)**: 핸들 드래그 연결·삭제·재연결, 기본 trigger(static=click, 그 밖=end, 두 번째부터 `choice:<이름>`), 엣지 인스펙터(trigger·전환·파라미터), 시작 신 지정·시작 배지, 모드 선택, 검증 패널. 저장할 수 없는 값은 파일에 쓰지 않고 이유를 보여 준다.
- **전환 라이브러리(T6.3)**: `playground/transitions/` — 9종의 순수 계획 함수 + WAAPI 실행기, 용어집 대응표(slide-right/up/down 용어 추가).
- **custom 전환(T6.4)**: 선언형 `transitions/<name>.json`(속성·값 화이트리스트, 코드 실행 없음). 워크스페이스 AGENTS.md에 작성 규칙.
- **시퀀스 매니저(T6.5)**: `sequence/manager.ts` 상태 머신(end·timeout·click·key·choice, static step 위임, 이웃 프리로드, 로드 실패는 현재 신 유지+오류, retry·jump·choose·back·pause/resume).
- **Playground(T6.6)**: `IframeScene`/`IframeSceneHost`(Bridge v2, origin 고정·창 검증), 브라우저 전환 러너, `SequencePlayer`(재생·일시정지·시크·신 점프·입력 힌트·choice 오버레이·오류 배너), Playground 페이지.
- **서빙·지연(T6.7)**: 별도 정적 서버 없이 프리뷰 서버(vite-runner)를 재사용(v2.0).
- **샘플(T6.8)**: `resources/samples/sequence-demo/` — motion → static(steps) → 3d + choice 분기(Finish·Again). JSON은 코드로 생성·드리프트 검사.

## 검증

`pnpm lint`·`typecheck`·`test`(137 파일 1025 테스트)·`cargo test`(V5 이후 Rust 변경 없음). **`pnpm test:e2e:sequence`**: 실제 신·프리뷰 서버·Chrome에서 샘플 전 구간(자동 진행 → static 클릭 단계 → 3d 렌더 → choice 분기 → 끝, Again 순환) 통과.

지연 수치(헤드리스 Chrome 154, 1280×720, 소프트웨어 GL): 시작 신 콜드 로드 1.23s, 비이웃 신 점프 0.13s, 전환 관측값은 설정값 + 10~120ms(crossfade 600→612, slide-left 500→550, circular-reveal 700→708, zoom-through 600→718).

## 결정·문제·교훈

- **숨긴 프리로드 신은 `visibility:hidden`으로 감추면 안 된다.** Chrome이 보이지 않는 cross-origin iframe의 렌더링을 멈춰 신이 `ready`(두 프레임 그리기)에 도달하지 못한다. E2E에서 `ready` 타임아웃으로 발견했고, 맨 아래 투명 층(opacity 0)으로 바꿨다.
- **런타임 결함 수정**: `useSteps`가 Bridge를 인자로 요구하는데 신 컴포넌트가 Bridge를 얻을 방법이 없어 static 신이 `step`·`done`·`choice`를 호스트에 보고할 수 없었다. 마운트가 호스트 Bridge를 등록(`hostedBridge`)하고 `useSteps`가 그것을 기본으로 쓰게 했다(`resources/runtime` 재빌드).
- **`end` 트리거 판단은 호스트가 한다**: 런타임은 끝 시각에서 시계를 멈출 뿐 `done`을 보내지 않으므로 `IframeScene`이 `time`과 `ready.duration`을 비교해 `done`을 만든다(static은 페이지의 `done`만 신뢰).
- `custom` 전환을 코드가 아니라 데이터로 한 것은 AGENTS.md §7(외부 콘텐츠는 신뢰할 수 없는 데이터) 때문이다. 에이전트가 쓴 코드를 앱 origin에서 실행하지 않는다.
- 설계서 §4.2.1(시퀀스 재생)을 추가했고, 기획서 §5.2 전환 목록·R-1을 정정했다.
- 테스트 교훈: 매니저 상태 `begin()`이 Promise를 돌려주면 `act(() => begin())`이 비동기 act가 되어 뒤 테스트가 깨진다(`void`로 감쌈, V5와 동일 교훈).

## 알려진 한계

- Playground는 재생 중 신 안의 버튼을 누를 수 없다(입력 레이어가 덮음). 신 UI의 `choice`는 호스트 선택지로 대신한다.
- timeout 트리거는 신 재생 시작 기준이며, 전환 중 입력은 무시한다.
- 헤드리스 소프트웨어 GL 수치라 실제 GPU·무거운 3D 신에서는 재측정이 필요하다. GUI(`pnpm tauri dev`)에서 Playground 화면은 실행해 보지 않았다.
- `match-cut`은 미지원, 공유 패키지(.vsx) 재생은 V7.

See: [[milestone-v5]], [[poc-r1]], [[implementation-plan]]
