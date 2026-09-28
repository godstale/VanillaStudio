---
title: 'Product Spec v0.1 (상세 기획서)'
type: source
tags: [planning, spec, phase-p2]
date: 2026-09-28
source_file: Docs/Planning/Product-Spec.md
sources: [vanilla-studio-requirements]
last_updated: 2026-09-28
---

## Summary

P2 핵심 산출물. [[VanillaStudio]]의 제품 원칙 7개, 결과물 유형 5종(web·interactive·slides·image·video), 6단계 [[ProductionPipeline]], IA(액티비티바·탭·에이전트 도크), 기능 명세(F-PRJ/AGT/PIP/REV/EXP/TPL/PLY/ENV, M/S/L 우선순위), [[ProjectFolderLayout]], `plan.json`·`tasks.json` 계약, 비기능 요구사항, 로드맵 M0~M7을 정의한다.

## Key Claims

- 모든 결과물 유형은 "Scene 집합 + 포맷 규격"이며 차이는 export 방식뿐 ([[SceneRuntimeContract]], [[ExportPipeline]])
- 임베드 패키지는 Web Component를 범용 인터페이스로, React 래퍼는 얇게
- 검수 스튜디오 = 미리보기 iframe + 타임라인 스크러버 + 파라미터 패널 + 수정 요청 ([[UserParameters]])
- 사용자 조절값(`params/*.values.json`)과 에이전트 코드는 분리 저장 (원칙 P5)
- 템플릿 = Agent Skill ([[DesignTemplateSkill]]), 플레이그라운드는 로컬 MVP ([[Playground]])

## Connections

- [[technical-design]] — 구현 방식
- [[decisions]] — 근거가 된 결정
- [[DevelopmentPhases]] — P2 산출물
