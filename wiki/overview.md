---
title: 'Overview'
type: overview
tags: [overview]
sources: []
last_updated: 2026-10-22
---

## 현재 상태 (2026-11-01)

- **2026-11-01 템플릿·스타일 분리**: 프로젝트 템플릿 8종·스타일 사전 200종 추가, D-046 Accepted. 근거 [[research-2026-11-01-style-tags]]
- **2026-10-22 문서 정비**: `README.md`·`Docs/Architecture.md`(Part A v2)·`Docs/Project-Structure.md`(Part A v2)를 v2 기준으로 개정. 최신 결정 D-045까지 Accepted
- **2026-10-05 v2 리팩토링(Scene 워크스페이스)**: 기획 [[refactor-spec-v2]] v0.3·설계 [[technical-design]] v1.0·계획 [[implementation-plan]] v2.0(V1~V7)·`AGENTS.md` v2 개정 완료, D-022~D-033 Accepted(D-010·D-018 Superseded). **다음: V1 기반 정리(TODO T1.0)**. 브랜치 `docs/v2-refactor-spec`(main 병합·push는 사용자 승인 대기). 아래 P4(v1) 상태는 이력
- 레거시 제거 계획(T1.2): [[issue-v2-legacy-removal]]
- PoC R-5(캔버스) 통과: [[poc-r5]]
- PoC R-1(신 간 전환 합성) 완료: [[poc-r1]]
- V1 기반 정리 완료(GUI 데모 확인 대기): [[milestone-v1]]
- V2 Scene CRUD·지침 생성 완료(GUI 확인 대기): [[milestone-v2]]
- V3 가이드·인스펙터 완료(GUI 확인 대기): [[milestone-v3]]
- **v2 구현 V1~V7 완료**(GUI·클린 VM·실제 에이전트·서명은 사람 확인 대기): [[milestone-v7]], [[phase-p4-v2]]
- v1 마이그레이션 출하 게이트 통과: [[issue-v1-migration]]
- V6 시퀀스·플레이그라운드 완료(GUI 확인 대기): [[milestone-v6]]
- V5 레퍼런스 분석 완료(GUI·실제 에이전트 데모 확인 대기): [[milestone-v5]]
- V4 터미널 실행·재생 완료(GUI·실제 에이전트 데모 확인 대기): [[milestone-v4]], [[poc-agent-terminal]]
- 에이전트 실사용 검증 5건 수정(스캐폴드 초안·템플릿 번들·static copy 문서·플레이어 키·종료 멈춤, 브랜치 `fix/scaffold-playground-5-issues`): [[issue-playground-scaffold-fixes]]

- 개발 단계: **P4 구현 — 자동화 항목 전부 완료 + T7.2 개발-PC 검증 완료(아래)**. 잔여: clean VM 재실행(T7.2 §4)·T7.5(인증서)·main push 승인 대기. 마일스톤 로그: [[milestone-m1]]·[[milestone-m2]]·[[milestone-m3]]·[[milestone-m4]]·[[milestone-m5]]·[[milestone-m6]], 병렬 배치: [[parallel-execution]] (`Docs/Planning/Parallel-Execution.md`)
- T7.2 개발-PC 실행(2026-10-02, `Docs/Verification/Clean-Install-Checklist.md`): 인스톨러 빌드(MSI+NSIS, 미서명) ✓, 5종 export(출하 번들) ✓ — 실행 중 결함 4건 수정(번들 optional-peer throw·번들 CDP 소켓→pipe 전환·편집PPTX notes 병합) + PowerPoint 실편집 검증 ✓. video MP4(h264·3.0초) ✓

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
