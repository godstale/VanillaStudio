---
title: 'Phase P2 상세 기획 로그'
type: source
tags: [phase-log, phase-p2]
date: 2026-09-28
source_file: Docs/Playbook/prompts/P2-planning.md
sources: [vanilla-studio-requirements, research-2026-09-28-agents-rendering]
last_updated: 2026-09-29
---

## Summary

요구사항 문서를 구현 가능한 기획으로 바꾼 단계. 템플릿 구조 파악 → 외부 리서치 → 3라운드 인터뷰(12문항) → 기획 문서 4종 작성 → 플레이북 → wiki → AGENTS.md 갱신 순으로 진행했다. 한 세션에서 완료.

## Inputs

- `Docs/Vanilla-Studio-Requirements.txt` ([[vanilla-studio-requirements]])
- 템플릿 문서: `Docs/Architecture.md`, `Docs/Project-Structure.md`, `Docs/Extension-Guide.md`, `AGENTS.md`

## Activities

1. 템플릿 코드·문서 구조 파악(앱 셸, 폴더 기반 동작, SQLite 분리, run_shell 확인 원칙)
2. 리서치: ACP, 각 에이전트 CLI, HyperFrames/Remotion, HTML→PPTX, GSAP 라이선스 ([[research-2026-09-28-agents-rendering]])
3. 인터뷰 3라운드 → D-001~D-010 Accepted ([[decisions]])
4. 기획 문서 작성: [[product-spec]], [[technical-design]], [[feasibility-risks]], [[decisions]]
5. [[DevelopmentPhases]] 정의 및 `Docs/Playbook/` 작성(프롬프트 원문·템플릿·사용자 체크리스트)
6. wiki 구축, AGENTS.md를 Vanilla Studio용으로 갱신, CLAUDE.md·.gitattributes·README 점검

## Deliverables

| 산출물 | 경로 | 상태 |
| --- | --- | --- |
| 상세 기획서 | `Docs/Planning/Product-Spec.md` | v0.1 초안 |
| 기술 설계서 | `Docs/Planning/Technical-Design.md` | v0.1 (⚠️ PoC 대기) |
| 난점·리스크·PoC | `Docs/Planning/Feasibility-Risks.md` | v0.1 |
| 결정 기록 | `Docs/Planning/Decisions.md` | D-001~014 |
| 플레이북 | `Docs/Playbook/**` | P0~P7 정의, P2 원문 기록 |
| 지침 | `AGENTS.md`, `CLAUDE.md` | 갱신 |
| wiki | `wiki/**` | 초기 구축 |

## Decisions

- Accepted: D-001~D-010 (인터뷰). Proposed: D-011 공통 Scene 런타임, D-012 앱 소유 프로세스 분리, D-013 git 체크포인트, D-014 MCP 도구 → 사용자 확인 대기.

## Problems & Fixes

- 요구사항의 "수동 조절"이 구현 수준으로 모호 → 파라미터 선언 방식으로 구체화하고 사용자 확인.
- 사용자가 인터뷰에서 동영상 범위를 자유 응답으로 재정의("React 코딩 애니메이션 → 영상 저장") → 모든 유형을 하나의 React Scene 런타임으로 통합하는 설계(D-011)로 이어짐.
- GSAP 라이선스의 "비주얼 빌더 금지" 조항 발견 → 앱 기능을 GSAP 비의존으로 설계.

## Lessons

- 인터뷰 질문은 "선택지 + 권장안 + 트레이드오프", 라운드당 4문항 이하.
- 외부 리서치 → 인터뷰 순서가 좋다: 리서치 결과가 선택지의 근거가 된다.
- 기획 문서는 제품(무엇)·기술(어떻게)·리스크(불확실)·결정(왜)으로 **네 개로 분리**하면 이후 단계에서 갱신 범위가 명확하다.
- 불확실한 기술 가정에 ⚠️를 달고 PoC ID와 연결하면 P3 입력이 자동으로 정리된다.

## Metrics

- 인터뷰 3라운드 / 12문항, 결정 14건(Accepted 10, Proposed 4), PoC 6건 정의, 기능 명세 약 40건

## Addendum — 기획 보강 (2026-09-29)

- 입력: 사용자 추가 요청 4건 — ① 컬러 팔레트 기능 ② DESIGN.md 표준 활용 ③ HyperFrames 디자인 프리셋 링크 보관 ④ HyperFrames 카탈로그 링크 보관
- 활동: 외부 조사([[research-2026-09-29-design-md-hyperframes]]) → 기획서·설계서·리스크 v0.2 → D-015·D-016 Accepted, D-017 Proposed → PoC S7 추가 → AGENTS.md §4 규칙 6(디자인 토큰 계약)
- 설계 요지: 디자인을 형태(템플릿)·디자인 시스템([[DesignMd]])·팔레트([[ColorPalette]]) 세 층으로 분리. 팔레트 교체는 `colors` 토큰만 바꾸고 에이전트를 부르지 않음
- 교훈: 구현 전에 **업계 표준 파일 형식**(AGENTS.md, DESIGN.md처럼 에이전트가 이미 아는 파일)이 있는지 확인하면, 자체 형식을 만드는 것보다 에이전트 호환성이 좋아진다. 외부 예제 모음을 참고 자료로 받으면 라이선스와 기술 의존성(예: GSAP)부터 확인해 "참고만/차용 가능"을 결정 기록으로 남긴다.

## Connections

- [[phase-p0-setup]], [[DevelopmentPhases]], [[VanillaStudio]]
