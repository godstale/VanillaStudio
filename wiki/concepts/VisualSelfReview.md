---
title: 'VisualSelfReview'
type: concept
tags: [quality, agent-integration]
sources: [technical-design, feasibility-risks]
last_updated: 2026-09-28
---

에이전트가 자기 결과물을 이미지로 보고 스스로 개선하는 루프. 앱 내장 MCP 서버 `vanilla-tools`의 `snapshot_scene`·`check_scene`·`get_review`·`update_task_status` 도구를 ACP `session/new`의 `mcpServers`로 전달(D-014, Proposed). 심미 품질 리스크의 핵심 대응. 관련: [[AgentClientProtocol]]

## Discussed In

- [[technical-design]] — §1, §3.2
- [[feasibility-risks]] — §2.5
