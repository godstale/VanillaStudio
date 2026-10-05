---
title: 'Parallel Execution Guide v2.0 (병렬 실행 가이드)'
type: source
tags: [process, parallel, phase-p4, handoff]
date: 2026-09-29
source_file: Docs/Planning/Parallel-Execution.md
sources: [implementation-plan]
last_updated: 2026-10-05
---

## Summary

P4 구현을 여러 에이전트 세션에서 동시에 진행하기 위한 배치·실행 규칙이다.

- **진입점**: 웨이브 0(T1.1 → T1.3, 단독)
- **웨이브 1**: 레인 4개
  - A 앱 셸: T1.2·T1.4·T1.5·T1.17·T1.6
  - B Rust·Doctor: T1.8~T1.10
  - C 프로젝트 모델: T1.7·T1.12
  - D 런타임·디자인(M4a 선행분): T3.5·T4.1~T4.8
- **웨이브 2**: B′ Doctor UI·설치(T1.11·T1.15), C′ 스캐폴딩·마법사(T1.13·T1.14·T1.16)
- **브랜치·워크트리**: 통합 브랜치 `feat/m1-foundation`에 레인별 워크트리를 붙인다. 병합과 push는 조정 세션이 사용자 승인을 받아 한다.
- **공유 파일 규칙**: i18n 키 접두어, `lib.rs`는 한 줄 추가만, 마이그레이션은 레인 A 전담, TODO는 자기 체크박스만 수정, 설계 문서는 조정 세션만 수정
- 세션 시작 프롬프트(웨이브 0·레인·조정)와 완료 보고 형식을 포함한다.

## Connections

- [[implementation-plan]], [[phase-p3-implementation-plan]], [[DevelopmentPhases]]

## v2 개정 (2026-10-05)

V1~V7용 레인(A UI·B Rust·C 스키마/가이드·D 런타임/디자인·E 콘텐츠)과 웨이브 배치로 재작성. v1 가이드는 `Docs/Planning/legacy/Parallel-Execution-v1.md`.
