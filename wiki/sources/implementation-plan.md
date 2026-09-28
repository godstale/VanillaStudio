---
title: 'Implementation Plan v1.0 + TODO (구현 계획서)'
type: source
tags: [planning, implementation-plan, todo, phase-p3]
date: 2026-09-29
source_file: Docs/Planning/Implementation-Plan.md
sources: [poc-s1, poc-s2, poc-s3, poc-s4, poc-s5, poc-s6, poc-s7]
last_updated: 2026-09-29
---

## Summary

P3 최종 산출물이다. PoC 7건의 결론을 요약하고 다음을 정의한다.

- 마일스톤 M1~M7(목표·완료 기준 데모·브랜치·기능 ID)
- 작업 의존성(M4a 런타임 패키지는 M2·M3와 병렬 가능)
- 테스트 계획, 구현 단계 위험, 구현 중 확정할 항목(D-018, 워크스페이스, MCP 구현 등), 완료 정의

작업 목록은 `Docs/Planning/TODO.md`에 있다. 1~2시간 단위, 98개 항목이며 각 항목에 대상 파일·완료 판정·선행 항목·기능 ID를 적었다. M/S 기능 ID는 모두 TODO에 연결되어 있다.

## Key Claims

- M1 기반 → M2 에이전트 → M3 파이프라인 → M4 검수·런타임 → M5 Export → M6 템플릿·플레이그라운드 → M7 릴리스 준비
- PoC 코드는 참고용이다. 앱으로 옮길 때 테스트와 함께 다시 작성한다: S3 → `agent_host`, S6 → `doctor_commands`, S7 → `src/lib/design`·`packages/runtime`, S4 → E2E 도구
- 골든 샘플 브리프 5종은 사용자가 정한다(P5 입력)

## Connections

- [[phase-p3-implementation-plan]], [[DevelopmentPhases]], [[product-spec]], [[technical-design]], [[feasibility-risks]]
