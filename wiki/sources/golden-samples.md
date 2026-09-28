---
title: 'Golden Samples v0.1 (골든 샘플 브리프 초안)'
type: source
tags: [verification, golden-samples, phase-p3, phase-p5]
date: 2026-09-29
source_file: Docs/Verification/Golden-Samples.md
sources: [implementation-plan]
last_updated: 2026-09-29
---

## Summary

P5 품질 기준이 될 샘플 브리프 5종의 초안이다. 사용자 요청으로 에이전트가 작성했고, 사용자 확정을 기다린다.

- 구성: 결과물 유형별 1종 — G1 web(가상 로스터리 랜딩), G2 interactive(가상 이어버드 3D 쇼케이스), G3 slides(바이브 코딩 강의 도입부 8장), G4 image(가상 서점 북페어 3규격), G5 video(가상 스타트업 15초 로고 리빌)
- 브랜드는 모두 가상이고, 절차적 생성만으로 만들 수 있다(D-006).
- 평가: 자동 검사 A1~A7(파이프라인 완주, 런타임 계약, 토큰·대비, 팔레트 교체, 결정성, 성능) + 루브릭 6개 축(1~5점)
- 합격선 초안: 자동 검사 전부 통과 + 루브릭 평균 3.5 이상

## Connections

- [[implementation-plan]], [[phase-p3-implementation-plan]], [[DevelopmentPhases]], [[ColorPalette]], [[DeterministicRendering]]
