---
title: 'PoC R-5: 캔버스 라이브러리(@xyflow/react) 스파이크'
type: source
tags: [poc, v2, canvas]
date: 2026-10-05
source_file: spikes/r5-canvas/
sources: [implementation-plan, technical-design]
last_updated: 2026-10-05
---

## 목표

v2 캔버스(ComfyUI형 Scene 노드 그래프)에 `@xyflow/react`(v12.12.0, MIT)를 채택할 수 있는지 판단한다. 기준(계획서 R-5): 100노드 팬/줌 60fps 근접, 커스텀 노드 스타일, 연결 편집.

## 방법

- `spikes/r5-canvas/`(독립 Vite 앱): Scene 노드 커스텀 컴포넌트(타입 배지·썸네일 자리·상태·실행/재생 버튼 자리·입출력 핸들), 엣지 체인(일부 animated), 미니맵·컨트롤·점 격자 배경, `colorMode="dark"`, `onlyRenderVisibleElements`.
- `bench.mjs`: puppeteer-core + 로컬 Chrome(headless)로 4초간 `setViewport`를 프레임마다 바꿔(팬+줌 사인 변동) rAF 프레임 간격을 측정.
- Claude in Chrome 확장은 연결되지 않아 puppeteer로 대체했다.

## 결과 (1600×900, headless Chrome, dev 서버)

| 노드 수 | 프레임 | 평균 ms | p95 ms | 최대 ms | fps |
| --- | --- | --- | --- | --- | --- |
| 100 | 240 | 16.67 | 16.8 | 16.8 | 60 |
| 300 | 239 | 16.74 | 16.8 | 33.4 | 59.7 |

- 로드 후 첫 노드 표시: 100노드 1.8초, 300노드 1.3초(dev 빌드, 최적화 전).
- 커스텀 노드·미니맵·컨트롤·다크 스타일 정상 렌더(스크린샷 확인).
- 한계: 측정은 headless라 60Hz 상한이다. 노드 내용이 이후 썸네일 이미지·버튼 상태로 무거워지면 재측정한다. 연결 편집(`onConnect`)은 코드로 연결했으나 자동화 입력으로는 검증하지 않았다(라이브러리 기본 기능, T2.3·T6.x에서 UI 테스트).

## 결론

**채택.** 기준 충족(100노드 60fps, 300노드도 유지). 자체 캔버스 구현은 불필요하다.

## 설계 반영

- `Technical-Design.md` §2 캔버스 행의 ⚠️ 제거, `AGENTS.md` §2 ⚠️ 해제.
- 라이선스: MIT. 화면 우하단 "React Flow" 표기는 유지한다(귀속 표기, 제거하려면 Pro 약관 확인 필요).
- 노드 컴포넌트는 `React.memo`로 감싸고 `onlyRenderVisibleElements`를 기본 켠다(T1.13·T2.4).

See: [[implementation-plan]], [[technical-design]]
