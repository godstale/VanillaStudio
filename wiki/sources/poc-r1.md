---
title: 'PoC R-1: 신 간 전환 합성'
type: source
tags: [poc, v2, transition, playground]
date: 2026-10-06
source_file: spikes/r1-transition/
sources: [implementation-plan, technical-design, refactor-spec-v2]
last_updated: 2026-10-06
---

## 목표

서로 다른 iframe(별도 origin)에 사는 두 신 사이에 crossfade·slide·mask-wipe·circular-reveal·zoom-through 전환을 어떻게 합성할지 정한다(리스크 R-1). 후보: ① 두 iframe 오버레이(호스트가 iframe 요소를 애니메이션) ② 종료/시작 프레임 캡처 오버레이.

## 방법

`spikes/r1-transition/`: 가짜 신(`scene.html`: 단색 배경 + CSS 회전 + canvas 루프, 로드되면 `ready`)을 `127.0.0.1` origin에서 서빙하고, 호스트 페이지(`localhost` origin, 앱과 같은 구성)에 iframe 두 개를 겹친다. 위 iframe 요소에 Web Animations API로 전환(opacity·transform·clip-path)을 600ms 건다. `bench.mjs`(puppeteer-core + 로컬 Chrome 154, headless, 1280×720)가 rAF 프레임 간격과 전환 중간·끝 스크린샷의 픽셀(빨강 신 A → 파랑 신 B)을 잰다. 방식 ②는 구현하지 않았다(아래 이유).

## 결과

| 전환 | 프레임 | 평균 ms | p95 ms | 최대 ms | 드롭 | 중간에 두 신 합성 | 끝은 다음 신 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cut | – | – | – | – | – | ✓ | ✓ |
| crossfade | 36 | 16.67 | 16.8 | 16.9 | 0 | ✓ | ✓ |
| slide-left | 36 | 16.67 | 16.8 | 16.8 | 0 | ✓ | ✓ |
| mask-wipe | 36 | 16.67 | 16.7 | 16.8 | 0 | ✓ | ✓ |
| circular-reveal | 36 | 16.67 | 16.8 | 16.8 | 0 | ✓ | ✓ |
| zoom-through | 36 | 16.67 | 16.8 | 16.8 | 0 | ✓ | ✓ |

- 두 신이 동시에 움직이는 상태(CSS 애니메이션 + canvas 60프레임 루프)에서도 60fps를 유지했다.
- 다음 신이 `ready`가 되기까지(가짜 신, 콜드 로드): 중앙값 9ms. 프리로드된 경우 전환 시점에는 이미 준비되어 있다(0ms). **실제 신(React·Three.js)은 로드가 훨씬 길 것이므로 프리로드가 필수**이고, 실제 값은 T6.7에서 샘플 시퀀스로 재측정한다.
- 한계: headless라 60Hz 상한이다. GPU가 약한 PC·무거운 3D 신 동시 렌더에서는 별도 확인이 필요하다.

## 결론

**방식 ① 두 iframe 오버레이를 채택한다.** 신은 서로의 DOM에 접근할 수 없어도(cross-origin) 합성은 호스트 요소 단위라서 신 코드가 전환을 몰라도 된다. 캡처 오버레이(②)는 필요하지 않다.

- v2.0 지원 전환: `cut`·`crossfade`·`slide-left/right/up/down`·`mask-wipe`·`circular-reveal`·`zoom-through`.
- **`match-cut`(요소 ID 지정)은 v2.0에서 제외한다.** 서로 다른 origin의 두 신에서 요소 위치를 맞추려면 Bridge에 요소 사각형 보고가 필요하고 합성도 요소 단위가 아니라서 방식 ①로는 불가능하다. 후속(Bridge 확장 + 캡처 오버레이).
- **`custom` 전환은 코드가 아니라 선언형으로 한다.** 에이전트가 쓴 `transitions/<name>.ts`를 호스트(권한 있는 앱 origin)에서 실행하면 AGENTS.md §7(외부 콘텐츠는 신뢰할 수 없는 데이터)에 어긋난다. 대신 `transitions/<name>.json`(WAAPI 키프레임·지속시간·이징)을 검증해 같은 오버레이 방식으로 재생한다.
- 전환은 프리로드된 다음 신 iframe이 있어야 시작한다(시퀀스 매니저가 보장).

## 설계 반영

`Refactor-Spec-v2.md` 전환 종류(§5.2)와 리스크 R-1, `Technical-Design.md`(Playground)에 위 결정을 반영한다(T6.9).

See: [[implementation-plan]], [[technical-design]], [[refactor-spec-v2]]
