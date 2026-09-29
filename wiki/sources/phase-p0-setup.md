---
title: 'Phase P0 준비 로그'
type: source
tags: [phase-log, phase-p0]
date: 2026-09-28
source_file: ''
sources: []
last_updated: 2026-09-28
---

## Summary

Tauri 2 + React 19 워크스페이스 스타터 템플릿에서 시작했다. 스킬(caveman, grill-me, llm-wiki, ponytail, vercel-react-best-practices)이 `.claude/skills`와 `.agents/skills`에 설치된 상태였고, git 저장소는 아니었다. P2 시작 시 git을 초기화하고 템플릿 원본을 master 기준 커밋으로 남겼다.

## Deliverables

| 산출물 | 경로 | 상태 |
| --- | --- | --- |
| 템플릿 기준 커밋 | `master` 65272b8 | 완료 |
| 에이전트 스킬 | `.claude/skills/`, `.agents/skills/` | 템플릿 제공 |
| wiki 골격 | `wiki/` | P2에서 생성 |

## Baseline Verification (2026-09-28)

- 환경: Windows 11, Node v22.13.0, pnpm 10.32.1, rustc 1.97.1
- `pnpm install --frozen-lockfile` 성공 / `pnpm lint` 통과 / `pnpm typecheck` 통과 / `pnpm test` 3 files·10 tests 통과
- `pnpm tauri dev`(데스크탑 실행): 2026-09-29 M1 웨이브 0(T1.1)에서 확인. 콜드 Rust 빌드 약 1분 5초(452 crate), `app.exe` 창이 뜸(창 제목은 아직 템플릿 값 "WorkspaceTemplate" — T1.2에서 교체). 오류 없음.

## Problems & Fixes

- git 미초기화 → P2 시작 시 `git init -b master` + 기준 커밋, 이후 작업은 `docs/planning` 브랜치.
- llm-wiki 스킬의 `__pycache__`가 추적될 뻔함 → `.gitignore`에 추가.
- Windows CRLF 경고 → `.gitattributes` 추가.

## Lessons

- 스타터 템플릿을 받으면 **첫 커밋을 "템플릿 원본"으로** 남겨 두면, 이후 모든 변경이 diff로 설명 가능해진다(강의 자료로 유용).

## Connections

- [[DevelopmentPhases]], [[phase-p2-planning]]
