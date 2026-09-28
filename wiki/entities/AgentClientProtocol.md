---
title: 'AgentClientProtocol'
type: entity
tags: [protocol, agent-integration]
sources: [research-2026-09-28-agents-rendering, technical-design]
last_updated: 2026-09-29
---

ACP. 에디터(클라이언트)와 코딩 에이전트를 잇는 JSON-RPC 2.0 over stdio 표준(LSP의 에이전트 버전). Zed가 시작, Rust/TS SDK 제공, 40+ 에이전트 지원.

Vanilla Studio에서의 사용: Rust `agent-client-protocol` crate로 클라이언트 구현. `initialize → session/new(cwd, mcpServers) → session/prompt → session/update 스트림`, `session/request_permission`은 [[PermissionPolicy]]로 처리, `fs/*` 요청은 프로젝트 스코프 검사. `terminal` capability는 제공하지 않음. S3 검증: `agent-client-protocol` 2.2.0(`Client.builder().on_receive_request(...).connect_with(AcpAgent, ...)`), 취소는 `CancelNotification` → `stopReason: Cancelled`. MCP는 `session/new`의 `mcpServers`로 stdio·HTTP(헤더 토큰) 모두 전달 가능 → [[poc-s3]]

## Appearances

- [[decisions]] — D-001
- [[technical-design]] — §3 에이전트 호스트
- [[feasibility-risks]] — §2.1 에이전트 이질성
- [[poc-s3]] — Rust 클라이언트 실측
