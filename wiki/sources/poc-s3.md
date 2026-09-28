---
title: 'PoC S3: Rust ACP 클라이언트로 Claude Code 구동'
type: source
tags: [poc, phase-p3, agents, acp, security]
date: 2026-09-29
source_file: spikes/s3-acp-claude/README.md
sources: [feasibility-risks, technical-design]
last_updated: 2026-09-29
---

## Summary

**결론: Claude Code는 조건부 통과, Codex는 미검증(미설치).**

- 구성: Rust `agent-client-protocol` 2.2.0 클라이언트로 `@agentclientprotocol/claude-agent-acp` 0.83.0(Claude Code 2.1.283)을 구동했다.
- 확인한 동작: 세션 생성, 스트리밍, 권한 요청, 프로젝트 밖 차단, 앱 MCP 도구 호출(stdio·HTTP), 취소.
- **조건**: 기본 설정에서는 읽기 전용 셸 명령(`echo`)이 권한 요청 없이 실행되어 D-010을 어긴다. 세션 생성 시 `_meta.claudeCode.options`로 사용자 설정을 격리하고 셸 ask 규칙을 넣어야 정책이 지켜진다(→ D-018 제안).

## 결과 매트릭스 (Claude Code, 격리 설정 기준)

| 항목 | 결과 | 비고 |
| --- | --- | --- |
| initialize / session/new | ✅ 약 1.2초 | `mcpCapabilities: {http, sse}`, `loadSession`, 세션 모드(default·acceptEdits·plan 등) 제공 |
| 스트리밍 | ✅ | `agent_message_chunk`, `tool_call`, `tool_call_update`(diff 포함), `usage_update`(비용·컨텍스트·rate limit) |
| 프로젝트 안 읽기 | ✅ 권한 요청 없음 | Claude 자체 Read 도구가 직접 읽음 |
| 프로젝트 안 쓰기 | ✅ `kind=edit` 권한 요청 → 자동 허용 | `locations`에 절대 경로가 들어 있어 스코프 검사 가능 |
| 셸(읽기 전용·쓰기 모두) | ✅ `kind=execute` 권한 요청 → 거부 시 우회하지 않음 | 선택지는 AllowOnce/RejectOnce뿐(AllowAlways 없음) |
| 프로젝트 밖 읽기 | ✅ `kind=read` 권한 요청 → 앱이 거부 | 선택지에 AllowAlways 포함 → UI에서 숨김 |
| 앱 MCP 도구(stdio) | ✅ `mcp__vanilla__vanilla_ping` | 권한 요청 `kind`가 비어 있음(other) → 이름 접두사로 분류 |
| 앱 MCP 도구(HTTP) | ✅ 127.0.0.1 + Bearer 토큰 | 토큰 없는 요청은 401 |
| 취소 | ✅ `session/cancel` 후 즉시 `stopReason: Cancelled` | |
| fs capability(`fs/read_text_file`·`write_text_file`) | ⚠️ 호출되지 않음 | Claude Code는 자체 도구로 파일을 다룸. 앱의 fs 핸들러는 강제 지점이 아님 |

비용: 격리 설정에서 6개 시나리오 합계 약 $0.07. 기본 설정은 시나리오당 약 $0.12~0.19였다. 모델은 사용자 기본값(claude-opus-5-5)을 따랐다.

## 발견한 문제와 해결 (Pitfalls)

1. **읽기 전용 셸의 자동 실행**
   - 증상: 기본 설정에서 "`echo acp-shell-test` 실행"은 권한 요청 없이 PowerShell로 실행됐다. 파일을 만드는 셸은 권한을 요청했다.
   - 원인: Claude Code가 읽기 전용 명령을 자체 판단으로 자동 허용한다.
   - 해결: `session/new`의 `_meta.claudeCode.options.settings.permissions.ask = ["Bash", "PowerShell"]`. 어댑터 소스 주석에 따르면 명시적 ask 규칙은 bypass 모드에서도 무시되지 않는다. 적용 후 두 종류 모두 권한 요청이 왔다.
2. **사용자 전역 설정의 유입**
   - 증상: 기본 설정에서는 `~/.claude`의 스킬·커넥터·설정이 세션에 로드됐다. 컨텍스트가 28.5k로 늘었고, 답변에 Gmail·Calendar 커넥터 안내가 섞였다. 사용자 허용 목록(`permissions.allow`)도 적용된다.
   - 해결: `settingSources: ["project"]`로 격리했다. 컨텍스트 21.5k, 비용 약 1/3, 답변 섞임이 없어졌다.
3. **fs capability 미사용**
   - 앱이 `fs.readTextFile/writeTextFile`을 제공한다고 알려도 Claude 어댑터는 쓰지 않았다.
   - 따라서 프로젝트 스코프 강제는 **권한 요청의 `locations` 검사**와 **Claude Code 자체 권한 체계(격리 설정)**로 한다.
   - 설계서의 "fs 요청은 Rust가 스코프 검사"는 fs를 쓰는 에이전트(다른 어댑터)용 방어선으로 유지한다.
4. **MCP 도구 권한 요청의 kind 없음**
   - 앱 자신의 MCP 도구는 `kind`가 비어 온다. `mcp__vanilla__` 접두사로 식별해 자동 허용한다. 다른 MCP 도구는 사용자 확인을 받는다.
5. **`AcpAgentConfig`에 cwd 설정 없음**
   - 어댑터 프로세스의 작업 폴더는 부모 프로세스를 따른다(세션 cwd는 `session/new`로 전달).
   - 앱에서는 프로세스를 직접 spawn해 cwd를 프로젝트로 두는 편이 안전하다(`AcpAgent`의 spawn 대신 자체 spawn 후 stdio 연결).

## 기타 관찰

- 어댑터는 `npx` 대신 로컬 설치본을 `node <adapter>/dist/index.js`로 실행했다. 앱은 버전을 고정해 앱 데이터에 1회 설치(동의)하고 실행한다(D-012 앱 소유 프로세스).
- 어댑터 옵션(`OPTION_REBUILDS_SESSION`)으로 `allowedTools`, `disallowedTools`, `tools`, `systemPrompt`, `skills`, `maxBudgetUsd`, `maxTurns`, `settingSources`, `settings`, `strictMcpConfig`를 줄 수 있다. 태스크별 예산 제한·도구 제한에 활용할 수 있다.
- `usage_update._meta._claude/rateLimit`에 5시간·7일 사용률이 온다. 앱에서 사용량 경고를 표시할 수 있다.
- Codex(`codex-acp`)는 CLI 미설치로 검증하지 못했다. 설치 후 같은 `acp-probe`로 재검증한다(시나리오는 에이전트 중립).

## 설계 반영

- 기술 설계서 §3.1: Claude Code 실행 명령을 확정했다(버전 고정 로컬 설치, 격리 옵션).
- 기술 설계서 §3.2: 권한 정책 구현 규칙을 추가했다(locations 검사, MCP 접두사, AllowAlways 숨김, ask 규칙). fs capability 관련 ⚠️를 해소했다.
- 결정: D-018(에이전트 세션 격리) 제안.
- 리스크 문서 §2.1·§3 진행 현황을 갱신했다.

## Connections

- [[AgentClientProtocol]], [[ClaudeCode]], [[PermissionPolicy]], [[VisualSelfReview]], [[technical-design]], [[feasibility-risks]]
