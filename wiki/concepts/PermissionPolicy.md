---
title: 'PermissionPolicy'
type: concept
tags: [security, agent-integration]
sources: [technical-design]
last_updated: 2026-09-28
---

에이전트 권한 요청 처리 정책(D-010). ACP `request_permission`의 toolCall.kind로 분류: 프로젝트 안 read/edit/delete/move → 자동 허용(로그), execute(셸) → 매번 확인(allow_once/reject_once만), fetch → 확인, 프로젝트 밖 → 자동 거부. 앱 소유 프로세스는 별도([[AppOwnedProcesses]]). 관련: [[AgentClientProtocol]]

## Discussed In

- [[technical-design]] — §3.2, §10
- [[decisions]] — D-010
