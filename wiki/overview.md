---
title: 'Overview'
type: overview
tags: [overview]
sources: []
last_updated: 2026-10-01
---

## 현재 상태 (2026-10-01)

- 개발 단계: **P4 구현 — 자동화 항목 전부 완료(`feat/m2-agents` → main 병합 d00981a, `fix/white-screen-csp` 병합)**. 잔여: 수동 항목 T7.2(깨끗한 Windows VM 체크리스트)·T7.5(코드 서명·자동 업데이트) + main push 승인 대기. 마일스톤 로그: [[milestone-m1]]·[[milestone-m2]]·[[milestone-m3]]·[[milestone-m4]]·[[milestone-m5]]·[[milestone-m6]], 병렬 배치: [[parallel-execution]] (`Docs/Planning/Parallel-Execution.md`)

- PoC S1~S7 완료(통과 5, 조건부 2), 계획: [[implementation-plan]] (`Docs/Planning/TODO.md`)
- 브랜치: main(2026-09-29 master에서 이름 변경). `Docs/images/`는 로컬 전용(.gitignore)
- 2026-09-29 기획 보강: [[DesignMd]] 표준 채택(D-015), [[ColorPalette]] 기능(D-016), HyperFrames 참고 자료 보관(D-017) → 기획서·설계서 v0.2, PoC S7 추가
- 결정 D-001~D-018 모두 Accepted (D-018 에이전트 세션 격리 2026-09-29 승인)
- 골든 샘플 초안: [[golden-samples]] — 사용자 확정 대기 D-011은 범위 수정: 시간 함수 계약은 영상·이미지(캡처) 유형만 ([[decisions]])
- 앱 저장소 원격: https://github.com/godstale/VanillaStudio (push는 매번 사용자 승인 후)

## 한 문단 요약

[[VanillaStudio]]는 코딩 에이전트([[ClaudeCode]], [[Codex]] 등)를 [[AgentClientProtocol]]로 구동해, 브리프 → 기획서 → 구현 계획서 → 코드 → 검수 → export의 [[ProductionPipeline]]으로 웹·슬라이드·이미지·영상·인터랙티브 결과물을 만드는 Tauri 데스크탑 앱이다. 모든 결과물은 React 기반 [[SceneRuntimeContract]] 위에서 만들어지고, 사용자는 [[UserParameters]]로 미세 조정하며, 영상은 [[HyperFrames]]로 결정적 렌더한다.

## 처음 읽는 순서

1. [[vanilla-studio-requirements]] — 무엇을 왜
2. [[product-spec]] — 무엇을 만들 것인가
3. [[technical-design]] — 어떻게 만들 것인가
4. [[feasibility-risks]] — 무엇이 불확실한가
5. [[decisions]] — 왜 그렇게 정했나
6. [[phase-p2-planning]] — 어떻게 여기까지 왔나
