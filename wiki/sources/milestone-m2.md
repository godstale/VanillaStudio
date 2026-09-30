---
title: 'Milestone M2: 에이전트 (ACP 호스트·권한·MCP·PTY·프런트)'
type: source
tags: [milestone, phase-p4, m2]
date: 2026-09-29
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, parallel-execution, decisions, technical-design, poc-s3]
last_updated: 2026-09-29
---

## Summary

M2는 코딩 에이전트를 ACP로 구동하는 전 경로를 구현했다. 웨이브 3(레인 S·G·E·R·H: 레지스트리·ACP 호스트·권한·fs·MCP 골격·PTY·파이프라인 UI 선행분) → 웨이브 4(레인 F·E2·K·V·X: 세션 Context·패널·권한 다이얼로그·MCP 연결·재개·검수 스튜디오·Export 워커)를 `feat/m2-agents`에 `--no-ff`로 병합했다. T2.10 판정은 Rust `rmcp`+`axum`으로 확정. main 병합·push는 사용자 승인 대기.

## 한 일

| 레인 | 항목 | 결과 |
| --- | --- | --- |
| E 호스트 | T2.1~T2.6 | 에이전트 레지스트리, `claude-agent-acp` 고정 설치, ACP 세션 호스트(spawn·initialize·session/new·prompt·cancel), 권한 정책(D-010+S3), fs 스코프+세션 로그, Tauri 명령·Channel 이벤트 |
| G MCP·PTY | T2.10(골격), T2.11 | `vanilla-tools` MCP 골격(ping·401), PTY 폴백(portable-pty+xterm, AGY) |
| E2 후속 | T2.10(판정)·T2.13·T2.12 | `rmcp` 확정·공유 서버+세션 토큰 lease, 재개 3경로, Codex 매트릭스(미검증 명시), bypass 모드 방어 |
| F 프런트 | T2.7~T2.9 | SessionContext·리듀서, 패널·우측 도크·diff 뷰, 권한 다이얼로그(allow_always 미노출) |
| S·R·H | 이월·T4.9·T3.7·M3 UI 선행분 | 셸 이월 3건, 런타임 배포 경로, DESIGN.md lint 워커, 파이프라인 UI(T3.1~T3.4·T3.8·T3.9·T3.12) |
| K·V·X | T3.10·T3.15·T6.1, T4.10~T4.14·T4.21, T5.1·T5.3~T5.6·T5.8 | 체크포인트·그래프·스킬, 검수 스튜디오+E2E, Export 워커(통합 브랜치에서 M2와 함께 검증) |
| 조정 | 통합·문서 | i18n 충돌 해결(양쪽 유지), ParamsPanel NUL 수정, T2.10 판정·서버명·M5 의존성 문서 반영 |

## 검증(최종)

- `pnpm lint`·`typecheck` 통과, `pnpm test` 68파일 484테스트 전부 통과, `cargo test` 137개 통과·0 실패(4 ignored)
- E2E `run-review-preview.mjs` PASS(검수 탭→bridge ready→scrubber/params)
- 실측: 실제 `claude-agent-acp` 0.83.0으로 initialize·session/new 성공, `vanilla-tools` ping 호출(200·401), 1920×1080@2x 캡처 바이트 동일, PPTX 3장·PDF 규격 확인
- **수동 확인 필요**(자동화 불가): 실제 Claude Code·Codex·AGY 대화·취소·셸 권한 다이얼로그 흐름, PowerPoint에서 편집 PPTX(T5.7), 깨끗한 Windows VM 설치·실행

## 결정·문제·해결

- T2.10 확정: Rust `rmcp`+`axum` (Node 사이드카 기각) → [[decisions]] 반영은 불필요(구현 판정, D-014 범위 내), 계획서 §6 ⚠️ 제거·설계서 §3.2 반영 완료
- 서버명 `vanilla-tools` 확정, 권한 접두어 `mcp__vanilla-tools__*`
- 정책 검토 잔여(사용자 결정 필요): 레지스트리 편집 가능 + UI 제공 argv(D-012 문구와 다름), Rust가 프런트 trusted 플래그 신뢰, Codex `full-access` id 미검증
- Pitfalls
  - 병합 후 통합 워크트리에서 `pnpm install`을 잊으면 신규 의존성 TS2307이 난다. 병합 직후 설치·재검증이 순서다.
  - mock-agent `.mjs`에 `\n`을 실제 개행으로 쓰면 깨진다. `node --check`로 검출.
  - 파일에 raw NUL(`\x00`)이 들어가면 git이 바이너리로 판정한다. `\u0000` 이스케이프를 쓴다.
  - `lint.py`는 `PYTHONIOENCODING=utf-8`로 실행하고, 맨 위 추가분을 맨 아래로 옮긴다. PowerShell 파이프·`Add-Content`는 한글 바이트를 망가뜨리므로 wiki 파일은 Python(UTF-8)으로만 다룬다.
  - `git show`·`git diff`의 PowerShell 파이프 출력에서 한글이 `?`로 보여도 실제 바이트는 정상이다. 바이트 확인은 `cmd /c` 리다이렉트나 `subprocess`로 한다.
  - `pipeline.test.tsx` flaky 1회(재실행 통과, 레인 H 영역) — 통합 검증에서 재확인.

## 남은 일(M2 이후)

- T2.14 본 항목(데모 수행 기록): 위 검증으로 갈음, 수동 확인은 T7.2·사용자 확인으로 이월
- 웨이브 5: T3.6·T3.11·T3.13·T3.14·T4.15~T4.20·T5.2·T5.7·T5.9·T6.2 (별도 배치, [[parallel-execution]] §2d)

## Connections

[[implementation-plan]] · [[parallel-execution]] · [[decisions]] · [[technical-design]] · [[poc-s3]]
