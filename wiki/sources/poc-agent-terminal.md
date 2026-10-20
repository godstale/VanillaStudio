---
title: 'PoC: 에이전트 터미널 실행·지원 매트릭스'
type: source
tags: [poc, agent, terminal, v2]
date: 2026-10-06
source_file: Docs/Planning/TODO.md
sources: [milestone-v4, technical-design]
last_updated: 2026-10-06
---

T4.11. 앱이 에이전트를 PTY로 띄우고 프롬프트를 클립보드로 전달한 뒤 결과를 판정하는 경로를 **목 에이전트**로 자동 검증했다. 실제 Claude Code·Codex 데모는 사람이 GUI에서 해야 한다. 결정: D-022(에이전트 중립, 앱은 조종하지 않음). 계획: [[implementation-plan]].

## 방법

- `tests/e2e/mock-agent.mjs`: 신 폴더(cwd)에서 `scene.json`을 읽고 허용 필드만 채운 뒤 `copy.items`를 그대로 담은 `src/`를 쓰는 스크립트. 모드 `good`·`rogue`(허용 밖 필드 변경)·`broken`(스키마 위반)·`late-clock`(금지 API).
- `src/lib/agents/mockAgentRun.test.ts`(vitest, Tauri 파일 명령을 실제 디스크로 대체): 완료 판정 → 화이트리스트 경고·되돌림 → 계약 검사 → 재생성(revise) 변경 필드 → 신 폴더 밖 쓰기 없음.
- `pnpm test:e2e:agent`: 목 에이전트가 쓴 신을 프리뷰 서버(vite-runner)로 서빙해 실제 Chrome에서 Bridge `ready`와 `copy` 원문 렌더를 확인.

## 결과

| 항목 | 결과 |
| --- | --- |
| 정상 실행 → 변경 필드 `beats`·`endCard`만, 엔트리 존재, `generated` | 통과 |
| 허용 밖 필드(`name`) 변경 → 경고, 부분 되돌림 시 허용된 작업 유지 | 통과 |
| 스키마 위반 `scene.json` → `invalid` 판정 | 통과 |
| `Date.now()` → `check:scene` 실패(앱·CLI 동일) | 통과 |
| 승인 후 `userPrompt` 수정 → revise 프롬프트에 `userPrompt` 전달 | 통과 |
| 목 에이전트 산출물이 Chrome에서 `ready`, `copy` 원문 DOM 출력 | 통과 |

## 지원 매트릭스

| 에이전트 | 이 PC에서 확인 | 비고 |
| --- | --- | --- |
| 목 에이전트 | ✅ 자동 | 위 표 |
| Claude Code | ⏳ 사람 확인 필요 | CLI는 설치되어 있으나(`claude`) 앱 터미널에서 신 1개 생성·재생 데모는 GUI 실행(`pnpm tauri dev`)이 필요해 하지 못했다 |
| Codex | ⏳ 사람 확인 필요 | 이 PC에 설치되어 있지 않다 |

## 한계

- 목 에이전트는 "에이전트가 파일을 쓴다"까지만 본다. 프롬프트를 실제로 따르는 품질(R-4)은 실제 에이전트로만 확인된다.
- 자동 붙여넣기(auto-paste)의 준비 감지(R-3)는 실제 CLI의 프롬프트 표시에 의존해 목으로 검증할 수 없다.

See: [[milestone-v4]], [[implementation-plan]]
