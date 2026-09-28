---
title: 'ProductionPipeline'
type: concept
tags: [pipeline, ux]
sources: [product-spec]
last_updated: 2026-09-29
---

Vanilla Studio 안에서 결과물을 만드는 6단계: **Brief → Plan(기획서) → Prompts(구현 계획서) → Build → Review ⇄ 수정 요청 → Export**. Plan과 Prompts는 사용자 승인 게이트가 있다. 각 단계 산출물은 프로젝트 폴더 파일([[ProjectFolderLayout]])이며 단계 완료·수정 반영 시 git 체크포인트(D-013, Accepted 2026-09-29). 요구사항 문서의 7단계 동작 구조를 매핑한 것. 개발 단계인 [[DevelopmentPhases]]와 혼동하지 말 것. 관련: [[UserParameters]], [[ExportPipeline]]

## Discussed In

- [[product-spec]] — §3 사용자 여정
- [[vanilla-studio-requirements]] — 원래 7단계
