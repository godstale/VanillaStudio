---
title: 'Phase P3 구현 계획(+PoC·TODO) 로그'
type: source
tags: [phase-log, phase-p3]
date: 2026-09-29
source_file: Docs/Playbook/prompts/P3-implementation-plan.md
sources: [poc-s1, poc-s2, poc-s3, poc-s4, poc-s5, poc-s6, poc-s7, implementation-plan]
last_updated: 2026-09-29
---

## Summary

P2 문서를 master에 병합하고 원격(GitHub)에 올린 뒤 시작했다. 순서는 다음과 같았다.

1. 제안 결정 5건 확인
2. PoC 7건(S1·S3·S4·S7·S2·S6·S5)
3. 구현 계획서·TODO 작성

한 세션에서 끝냈다. PoC마다 `spike/` 브랜치를 만들고, 코드 커밋과 기록 커밋을 나눴다.

## Inputs

- 기획 문서 v0.2~v0.3, 결정 D-001~D-017, 사용자 지시(PoC 순서, Claude Code만 검증, 사용량 동의)

## Activities

1. 결정 확인: D-011(범위 축소), D-012·D-013·D-017(승인), D-014(MVP 필수로 격상)
2. 원격 연결·병합·push(사용자 승인)
3. PoC: [[poc-s1]] → [[poc-s3]] → [[poc-s4]] → [[poc-s7]] → [[poc-s2]] → [[poc-s6]] → [[poc-s5]]
4. PoC마다 설계서 ⚠️ 해소·수정, 결정 D-018 제안
5. [[implementation-plan]] 작성(계획서 + TODO)

## Deliverables

| 산출물 | 경로 | 상태 |
| --- | --- | --- |
| PoC 코드 7건 | `spikes/s1`~`s7` | 참고용 |
| PoC 기록 7건 | `wiki/sources/poc-s*.md` | 완료 |
| 기술 설계서 | `Docs/Planning/Technical-Design.md` | v0.3 + PoC 반영(남은 ⚠️ 5건은 구현 중 확정) |
| 구현 계획서 | `Docs/Planning/Implementation-Plan.md` | v1.0 |
| TODO | `Docs/Planning/TODO.md` | v1.0, 98개 항목 |

## Decisions

- Accepted: D-011(수정), D-012, D-013, D-014, D-017
- Proposed: D-018 에이전트 세션 격리(M2 시작 전 확인)

## Problems & Fixes

- S1: 45초 타임라인 대기가 워커 첫 프레임 경쟁 조건을 가리고 있었다 → `data-no-timeline` + `waitUntil(sceneReady)`.
- S3: 기본 설정의 Claude Code가 읽기 전용 셸을 확인 없이 실행했다 → 세션 격리 옵션.
- S4: 두 dev server의 Vite 캐시 충돌로 iframe 메시지가 0건이었다 → CDP로 iframe 콘솔을 보고 원인을 찾았다.
- S7: HyperFrames 팔레트의 역할 의미가 scheme에 따라 뒤집힌다 → 밝기 기반 매핑. 고정 비율 파생 → 대비 보장 파생.
- S7: 사이트에서 추출한 데이터를 커밋했다 → push 전에 커밋을 되돌려 git에서 제외했다(D-017).
- S3: npm으로 의존성을 설치했다(pnpm 규칙 위반) → pnpm으로 재설치.
- wiki lint 출력을 `Select-Object -First`로 자르자 `log.md`가 비었다(추정) → 출력을 자르지 않는다.

## Lessons (재사용 가능)

- 성공 기준은 숫자로, 대조 실험을 함께. "기다리지 않으면 무엇이 틀리는가"를 보여 줘야 설계 장치의 필요가 증명된다.
- 원인은 층별로 분리한다(MP4 → PNG, iframe → CDP 콘솔).
- 실제 소비자 앱으로 검증한다(PowerPoint COM, WebView2 CDP). 브라우저에서 본 결과와 다른 문제(폰트·줄바꿈)가 드러났다.
- 외부 도구의 숨은 동작(텔레메트리, Gemini 자동 분석, stdin 대기, puppeteer 전체 의존성)은 소스와 `--help`로 먼저 확인한다.
- 대기 시간을 줄이는 최적화를 한 뒤에는 결정성·정확성 검증을 다시 돌린다.

## Metrics

- PoC 7건: 통과 5, 조건부 통과 2(S3 Codex 미검증, S5 Beta). 실제 에이전트 사용량 약 $0.3.
- 새 결정 1건(D-018), 설계 수정 약 15곳, TODO 98개 항목

## Connections

- [[phase-p2-planning]], [[DevelopmentPhases]], [[implementation-plan]]
