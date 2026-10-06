---
title: 'Phase P4(v2) 구현 로그 — V1~V7'
type: source
tags: [phase-log, phase-p4, v2]
date: 2026-10-06
source_file: Docs/Planning/TODO.md
sources: [milestone-v1, milestone-v2, milestone-v3, milestone-v4, milestone-v5, milestone-v6, milestone-v7, issue-v1-migration, poc-r1, poc-r5, poc-agent-terminal]
last_updated: 2026-10-06
---

## Summary

v2 구현(Scene 워크스페이스 앱)을 V1~V7 일곱 마일스톤으로 끝냈다. 캔버스에서 신을 만들고 이어 붙이고, 에이전트를 터미널에서 실행해 코드로 결과를 만들고, 플레이그라운드로 시퀀스를 재생하고, `.vsx`로 공유하며, v1 프로젝트를 가져온다. V1~V4 일부는 한 세션에서, 사용 한도로 멈춘 뒤 이어받은 세션에서 V4 후반~V7을 끝냈다. **사람이 해야 하는 검증(GUI·클린 VM·실제 에이전트·서명)은 남아 있다.**

## Inputs

- `Docs/Planning/Refactor-Spec-v2.md`·`Technical-Design.md` v1.0·`Implementation-Plan.md` v2.0·`TODO.md`, 결정 D-022~D-033
- 사용 한도로 중단된 작업의 마지막 보고(완료·남은 것·알려진 빈틈·검증 상태)

## Activities

1. V1 기반 정리 → V2 Scene CRUD·지침 생성 → V3 가이드·인스펙터 → V4 터미널 실행·재생(한도로 중단)
2. **재개**: V4 후반(썸네일·계약 검사·재생성·목 에이전트 통합) → V5 레퍼런스 분석 → V6 시퀀스·플레이그라운드(PoC R-1 선행) → V7 패키지·마이그레이션·샘플·문서·릴리스 점검
3. 항목마다 테스트 → 커밋 → TODO 체크. 마일스톤마다 로그·설계서 갱신·로컬 fast-forward 병합(push 없음)

## Deliverables

| 산출물 | 경로 | 상태 |
| --- | --- | --- |
| 앱 코드(V1~V7) | `src/`·`src-tauri/`·`packages/runtime` | 완료 |
| 마일스톤 로그 | [[milestone-v1]]~[[milestone-v7]] | 완료 |
| PoC | [[poc-r5]](캔버스), [[poc-r1]](전환 합성), [[poc-agent-terminal]](에이전트 지원 매트릭스) | 완료 |
| 출하 판정 | [[issue-v1-migration]] | 통과 |
| 샘플 4종·E2E 5종 | `resources/samples/`·`tests/e2e/` | 완료 |
| 사용자 문서 v2 | `Docs/User-Guide/01~07` | 완료 |
| 검증 문서 | `Docs/Verification/{Reproducibility,Clean-Install-Checklist-v2,Golden-Samples}.md` | 갱신 |
| 인스톨러(미서명) | `src-tauri/target/release/bundle/` | 빌드 성공, 사람 검증 대기 |

## Decisions

- 새 결정 번호는 없다. 구현 중 정한 세부는 마일스톤 로그에 있다: 분석 마커는 저장소 공통 `vanilla:begin:analysis` 형식(기획서 정정), `match-cut` v2.0 제외·`custom` 전환은 선언형 JSON, 별도 정적 서버 없이 프리뷰 서버 재사용, 패키지는 허용 목록 방식.

## Problems & Fixes

- 목 에이전트 E2E에서 보이지 않던 것들이 **실제 브라우저 E2E**에서 드러났다: 숨긴 cross-origin iframe은 Chrome이 렌더를 멈춰 `ready`가 오지 않는다(프리로드 층을 투명 층으로), static 신이 Bridge를 얻을 방법이 없었다(`hostedBridge`), 신별 params가 읽히지 않았다(`paramsForPath`).
- `applyMarkers`가 CRLF를 LF로 바꿔 사용자 파일의 마커 밖 바이트가 변했다 → 사용자 소유 파일용 `applyMarkersKeepEol`.
- 의존성 표 일치 테스트가 `NOTICE.md` 누락 2건을 찾았다.
- 이 PC의 PATH FFmpeg는 2013년 빌드 → 실제 FFmpeg 테스트가 조용히 건너뛰어졌다. 환경 변수로 최신 빌드를 지정해 실제 왕복을 확인했다.
- 도구 환경: Windows 셸 도구의 백슬래시 해석 때문에 정규식·`\n`이 들어간 파이썬/heredoc이 반복해서 깨졌다.

## Lessons (재사용 가능한 교훈)

- **목(mock)이 못 보는 결함은 실제 환경 E2E가 찾는다.** 목 에이전트·가짜 Bridge 테스트는 로직을 빠르게 고정하지만, 브라우저 렌더 정책·런타임 가정·환경(FFmpeg 버전)은 실제 환경에서만 드러난다 → 각 마일스톤에 "실제 Chrome E2E 1개"를 넣는다. (Playbook P4/P5에 반영)
- **새 기능은 기존 기능의 숨은 가정을 드러낸다.** 마이그레이션이 params 결함을, 시퀀스가 Bridge 결함을 찾았다. 통합 시나리오 테스트를 일찍 둔다.
- **"문서와 코드가 같다"는 주장은 테스트로 고정한다**(의존성 표, 사용자 문서 링크, 샘플 JSON 드리프트, Rust↔TS 골든 계약).
- **외부에서 온 파일은 허용 목록 + 열기 전 검사 + 사람 확인**(패키지·v1 폴더). 사용자가 승인하기 전에는 어떤 파일도 쓰지 않는다.
- **긴 작업은 항목 단위로 커밋하고 TODO를 체크한다.** 사용 한도로 멈춰도 마지막 보고(완료·남은 것·알려진 빈틈·검증 상태)만 붙이면 그대로 이어진다.
- **사람만 할 수 있는 검증을 숨기지 않는다**: 보고에 "하지 못한 것"을 따로 적는다(GUI·실제 에이전트·VM·서명).

## Metrics

- 재개 이후 커밋 33개(전체 V1~V7은 마일스톤 로그 참고), 변경 265파일 +15,754/−239줄(재개 이후)
- 테스트: 149 파일 1133 단위·컴포넌트 테스트, Rust 127, E2E 5종
- 마일스톤 로그 7개, PoC 3건, 사용자 문서 7종, wiki 소스 페이지 38개

## Connections

- [[milestone-v7]], [[milestone-v6]], [[milestone-v5]], [[milestone-v4]], [[implementation-plan]]
