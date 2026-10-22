---
title: '워크스페이스 히스토리 기록 누락·zip 압축/불러오기 (D-045)'
type: source
tags: [workspace, history, archive, bugfix]
sources: [src/lib/context/WorkspaceContext.tsx, src-tauri/src/commands/workspace_archive.rs]
last_updated: 2026-10-22
---

# 워크스페이스 히스토리 기록 누락·zip 압축/불러오기 (D-045)

## 증상과 원인
A→B 순서로 워크스페이스를 열어도 히스토리가 비어 있었다. `touchWorkspace`(SQLite `workspaces` 기록)가 `Onboarding`에만 있었고, 워크스페이스 화면 카드·"폴더 열기"·전환 팝업은 `openWorkspace` + `setWorkspaceRoot`만 호출했다.

## 수정
- 기록을 `WorkspaceContext`의 `workspaceRoot` 동기화 효과로 옮겼다(어떤 경로로 열든, 시작 복원 포함).
- 현재 워크스페이스 카드/항목에 "현재" 배지. 카드를 누르면 해당 워크스페이스로 전환(기존 동작).
- `workspace_archive.rs`: 폴더째 zip 압축/복원. 제외 규칙은 [[issue-korean-path-ascii-launcher]]의 `pack-workspace.mjs`와 같다.

## 교훈 / Pitfalls
- 같은 `workspaceId`를 가진 복사본을 다른 경로에 풀면 히스토리 행이 새 경로로 옮겨진다(`workspace_id`가 키). id 재발급은 하지 않았다.
- 폴더 선택 대화상자(`pick_project_folder`)는 파일 명령의 활성 스코프를 바꾼다. 복원이 실패하면 원래 워크스페이스로 되돌려야 한다.
- 같은 맥락의 플레이어 정리: `tests/LLM_and_Vibe_Coding_Day01_v2/play/`는 템플릿보다 오래돼 음량 조절이 없었다. 템플릿 `play/`(host·navigator·play.css·Player)로 맞췄다(기존 워크스페이스의 `play/`는 앱이 갱신하지 않는다).
