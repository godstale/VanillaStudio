---
title: 'ClaudeCode'
type: entity
tags: [agent]
sources: [research-2026-09-28-agents-rendering]
last_updated: 2026-09-29
---

Anthropic의 코딩 에이전트 CLI. Vanilla Studio MVP **공식 지원** 에이전트. [[AgentClientProtocol]] 공식 어댑터(`@agentclientprotocol/claude-agent-acp`, S3에서 0.83.0 + CLI 2.1.283 검증)로 연동. 세션 옵션은 `session/new`의 `_meta.claudeCode.options`(settingSources·settings·allowedTools·maxBudgetUsd 등)로 준다. 격리 없이 쓰면 사용자 전역 설정이 유입된다([[poc-s3]]). 프로젝트 스킬은 `.claude/skills/`, 지침은 `CLAUDE.md`(→ `@AGENTS.md`)에서 읽는다.

## Appearances

- [[technical-design]] — 에이전트 레지스트리
- [[research-2026-09-28-agents-rendering]] — ACP 어댑터 조사
- [[poc-s3]] — 연동 검증
