---
title: 'Overview'
type: overview
tags: [overview]
sources: []
last_updated: 2026-09-28
---

## 현재 상태 (2026-09-28)

- 개발 단계: **P2 상세 기획 완료 → P3 구현 계획(+PoC) 대기** ([[DevelopmentPhases]])
- 브랜치: `docs/planning` (master는 템플릿 원본 기준 커밋)
- 사용자 확인 대기: Proposed 결정 D-011~D-014 ([[decisions]])

## 한 문단 요약

[[VanillaStudio]]는 코딩 에이전트([[ClaudeCode]], [[Codex]] 등)를 [[AgentClientProtocol]]로 구동해, 브리프 → 기획서 → 구현 계획서 → 코드 → 검수 → export의 [[ProductionPipeline]]으로 웹·슬라이드·이미지·영상·인터랙티브 결과물을 만드는 Tauri 데스크탑 앱이다. 모든 결과물은 React 기반 [[SceneRuntimeContract]] 위에서 만들어지고, 사용자는 [[UserParameters]]로 미세 조정하며, 영상은 [[HyperFrames]]로 결정적 렌더한다.

## 처음 읽는 순서

1. [[vanilla-studio-requirements]] — 무엇을 왜
2. [[product-spec]] — 무엇을 만들 것인가
3. [[technical-design]] — 어떻게 만들 것인가
4. [[feasibility-risks]] — 무엇이 불확실한가
5. [[decisions]] — 왜 그렇게 정했나
6. [[phase-p2-planning]] — 어떻게 여기까지 왔나
