---
title: 'PermissionPolicy'
type: concept
tags: [security, agent-integration]
sources: [technical-design]
last_updated: 2026-09-29
---

에이전트 권한 요청 처리 정책(D-010). ACP `request_permission`의 toolCall.kind로 분류: 프로젝트 안 read/edit/delete/move → 자동 허용(로그), execute(셸) → 매번 확인(allow_once/reject_once만), fetch → 확인, 프로젝트 밖 → 자동 거부. 앱 소유 프로세스는 별도([[AppOwnedProcesses]]). 관련: [[AgentClientProtocol]]

## 구현 규칙 (PoC S3, [[poc-s3]])

- 판단 근거는 요청의 `toolCall.kind`와 `locations`(절대 경로)다. 경로는 canonicalize 후 프로젝트 루트 아래인지 확인한다(쓰기 대상은 부모 폴더로 확인).
- 앱 자신의 MCP 도구는 `kind`가 비어 오므로 `mcp__vanilla__` 접두사로 식별한다.
- `allow_always` 선택지는 받더라도 UI에 노출하지 않는다.

## Pitfalls

- Claude Code 기본 설정은 읽기 전용 셸을 권한 요청 없이 실행한다. 세션 격리(`settingSources: ["project"]` + `permissions.ask: ["Bash","PowerShell"]`, D-018 제안)가 필요하다.
- Claude 어댑터는 ACP `fs/*`를 쓰지 않는다. fs 핸들러만으로는 스코프를 강제할 수 없다.

## Discussed In

- [[technical-design]] — §3.2, §10
- [[decisions]] — D-010, D-018
- [[poc-s3]] — 실측
