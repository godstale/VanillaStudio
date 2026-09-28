---
title: 'DeterministicRendering'
type: concept
tags: [rendering, video]
sources: [feasibility-risks, research-2026-09-28-agents-rendering]
last_updated: 2026-09-29
---

같은 입력이면 같은 프레임이 나오는 렌더링. 영상·스틸 export의 전제. 방법: 애니메이션을 시간 순수 함수로 작성, 브라우저 시간 가상화 + 프레임 단위 seek 캡처, 폰트·텍스처 로딩 완료 대기, 시드 고정 난수. Vanilla Studio는 [[SceneRuntimeContract]] + [[HyperFrames]]로 달성하며 PoC S1에서 검증.

## Discussed In

- [[feasibility-risks]] — §2.2
- [[research-2026-09-28-agents-rendering]] — 캡처 기법

## Pitfalls

- 워커 첫 프레임 경쟁 조건: 장면(Canvas·폰트·에셋) 준비 전에 시각을 적용하면 병렬 캡처 워커의 첫 프레임이 달라지고, H.264에서는 이후 프레임으로 번진다. `waitUntil(sceneReady.then(setTime))` → [[poc-s1]]
- GPU 렌더와 소프트웨어(SwiftShader) 렌더는 픽셀이 다르다. 결정성 비교는 같은 렌더러끼리만 한다.
- 웹 폰트는 늦게 요청되므로 `document.fonts.ready`만으로는 부족하다. 사용하는 폰트를 `document.fonts.load()`로 명시적으로 불러온다 → [[poc-s2]]
