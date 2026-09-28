---
title: 'Technical Design v0.1 (기술 설계서)'
type: source
tags: [planning, architecture, phase-p2]
date: 2026-09-28
source_file: Docs/Planning/Technical-Design.md
sources: [product-spec]
last_updated: 2026-09-28
---

## Summary

Tauri 앱(React UI + Rust Core)과 외부 프로세스(에이전트 CLI, 프로젝트별 Vite 프리뷰 서버, Node export 워커)로 구성된 시스템 설계. 보안 경계를 Rust에 두고, 앱 소유 프로세스와 임의 셸을 분리하며, 하나의 Scene 런타임으로 모든 export를 처리한다. ⚠️ 표시는 PoC로 확정할 가정.

## Key Claims

- ACP 클라이언트는 Rust `agent-client-protocol` crate, `fs` capability 제공·`terminal` 미제공 → 셸은 `request_permission` 경유 ([[AgentClientProtocol]], [[PermissionPolicy]])
- 에이전트 레지스트리: Claude Code·Codex(공식, ACP 어댑터), OpenCode·Hermes(실험적, 네이티브 ACP), AGY(실험적, 터미널)
- `@vanilla/runtime`: `defineScene`·`useTime`·`useParams`·`useInput`, 모드 preview/render/live ([[SceneRuntimeContract]], [[DeterministicRendering]])
- 호스트↔iframe은 [[VanillaBridge]] postMessage 프로토콜
- 프리뷰 서버·export 워커·pnpm install은 고정 argv 전용 명령 ([[AppOwnedProcesses]])
- 동영상은 [[HyperFrames]], PPTX는 pptxgenjs + [[DomToPptx]](Beta)
- 에이전트용 MCP 도구 `vanilla-tools` ([[VisualSelfReview]])
- 템플릿 기본 `assetProtocol.scope: ["**"]`는 M1에서 축소 필요

## Connections

- [[feasibility-risks]] — ⚠️ 항목의 PoC 계획
- [[decisions]] — D-011~D-014 Proposed
