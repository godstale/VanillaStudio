---
title: 'Decision Log (의사결정 기록)'
type: source
tags: [decisions, phase-p2]
date: 2026-09-28
source_file: Docs/Planning/Decisions.md
sources: []
last_updated: 2026-10-18
---

## Summary

되돌리기 비싼 결정의 목록. 원문은 `Docs/Planning/Decisions.md`가 진실 공급원이며, 이 페이지는 색인이다. 새 결정이 생기면 원문 추가 → 이 표 갱신 → `wiki/log.md` 한 줄.

| ID | 결정 | 상태 | 관련 페이지 |
| --- | --- | --- | --- |
| D-001 | ACP 우선 + 터미널 폴백 | Accepted | [[AgentClientProtocol]] |
| D-002 | MVP: 웹/인터랙티브·슬라이드·이미지·동영상(React 코딩 애니메이션 → 영상) | Accepted | [[ExportPipeline]] |
| D-003 | PPT: 이미지 기반 + 편집 가능(Beta) | Accepted | [[DomToPptx]] |
| D-004 | 영상 렌더: HyperFrames | Accepted | [[HyperFrames]] |
| D-005 | Windows 우선 + Doctor | Accepted | [[VanillaStudio]] |
| D-006 | 에셋: 코드+사용자 자료+오픈 라이선스(CREDITS 기록) | Accepted | [[ProjectFolderLayout]] |
| D-007 | 수동 조절: 파라미터 패널 + 스크러버 | Accepted | [[UserParameters]] |
| D-008 | 템플릿 = Agent Skill | Accepted | [[DesignTemplateSkill]] |
| D-009 | 폴더 1 = 프로젝트 1 = 결과물 1 | Accepted | [[ProjectFolderLayout]] |
| D-010 | 파일 쓰기 자동, 셸 매번 확인 | Superseded by D-022 (2026-10-05) | [[PermissionPolicy]] |
| D-011 | 공통 Scene 런타임, 시간 함수 계약은 영상·이미지(캡처) 유형만 — 웹/인터랙티브는 자유 모드 | Accepted (2026-09-29, 범위 수정) | [[SceneRuntimeContract]] |
| D-012 | 앱 소유 프로세스 ≠ run_shell | Accepted (2026-09-29) | [[AppOwnedProcesses]] |
| D-013 | git 자동 체크포인트(사용자 결과물 프로젝트) | Accepted (2026-09-29) | [[ProductionPipeline]] |
| D-014 | 에이전트용 MCP 도구, MVP 필수로 격상 | Accepted (2026-09-29) | [[VisualSelfReview]] |
| D-015 | 디자인 시스템 전달 표준: 프로젝트 `DESIGN.md` | Accepted (2026-09-29) | [[DesignMd]] |
| D-016 | 컬러 팔레트 = DESIGN.md 색 역할 토큰, 교체는 에이전트 없이 | Accepted (2026-09-29) | [[ColorPalette]] |
| D-017 | HyperFrames 프리셋·카탈로그는 참고 자료로만 | Accepted (2026-09-29) | [[research-2026-09-29-design-md-hyperframes]] |
| D-018 | 에이전트 세션 격리(전역 설정 제외 + 셸 ask 규칙) | Superseded by D-022 (2026-10-05) | [[PermissionPolicy]], [[poc-s3]] |
| D-019 | FFmpeg 다운로드 메이저 8 고정 | Proposed (2026-09-29) | [[milestone-m1]] |
| D-020 | `vanilla.json` 필드 계약(M1 구현분) | Proposed (2026-09-29) | [[milestone-m1]] |
| D-021 | assetProtocol 스코프·Bridge 스키마 보완 | Proposed (2026-09-29) | [[milestone-m1]] |
| D-022 | v2: ACP 호스트 → 터미널 실행+클립보드 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-023 | 작업 폴더·`scene.json` 진실 공급원 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-024 | Scene 타입 3종(static·motion·3d)과 런타임 재사용 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-025 | 시퀀스 = 노드 그래프 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-026 | 레퍼런스 분석은 에이전트 태스크 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-027 | v2.0 공유=.vsx+재생, export 후속 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-028 | 모션 가이드를 코드 구현용으로 개편 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-029 | 워크스페이스당 시퀀스 1개 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-030 | 캔버스 규격 워크스페이스 전역 고정 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-031 | 사용자 정의 가이드 템플릿 v2.0 포함 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-032 | 정적 페이지 사용자 입력 진행·steps | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-033 | v1 마이그레이션 조건부 출하 | Accepted (2026-10-05) | [[refactor-spec-v2]] |
| D-034 | 에이전트 중심 UI(시퀀스·신·템플릿·갤러리·코멘트 계약) | Accepted (2026-10-17) | [[ui-agent-centric]] |
| D-035 | Opus 5.5 아카이브 분해·템플릿화 및 4대 매체 의도 추천·미리보기 링크 | Accepted (2026-10-18) | [[research-2026-10-18-awesome-opus55-videos]] |
| D-036 | 워크스페이스 비파괴 초기화 및 AI 에이전트 브리지(`pnpm vanilla`·`WORK_ORDER.md`·`VANILLA_GUIDE.md`) | Accepted (2026-10-18) | [[ui-agent-centric]], [[refactor-spec-v2]] |

## Connections

- [[phase-p2-planning]] — 결정이 내려진 과정(인터뷰)

