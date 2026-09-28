---
title: 'DeterministicRendering'
type: concept
tags: [rendering, video]
sources: [feasibility-risks, research-2026-09-28-agents-rendering]
last_updated: 2026-09-28
---

같은 입력이면 같은 프레임이 나오는 렌더링. 영상·스틸 export의 전제. 방법: 애니메이션을 시간 순수 함수로 작성, 브라우저 시간 가상화 + 프레임 단위 seek 캡처, 폰트·텍스처 로딩 완료 대기, 시드 고정 난수. Vanilla Studio는 [[SceneRuntimeContract]] + [[HyperFrames]]로 달성하며 PoC S1에서 검증.

## Discussed In

- [[feasibility-risks]] — §2.2
- [[research-2026-09-28-agents-rendering]] — 캡처 기법
