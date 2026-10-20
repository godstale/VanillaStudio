---
title: 'Technical Design v1.0 (v2 기술 설계서)'
type: source
tags: [planning, architecture, phase-p2]
date: 2026-09-28
source_file: Docs/Planning/Technical-Design.md
sources: [product-spec]
last_updated: 2026-10-05
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
- v0.2(2026-09-29) §4.4 디자인 토큰 파이프라인: 런타임 Vite 플러그인이 [[DesignMd]]를 가상 모듈로 읽어 `--color-*` CSS 변수·`useDesign()` 제공, Bridge `setDesign`으로 [[ColorPalette]] 미리보기, 앱은 `colors`만 다시 씀(본문 보존). 전역 DB `palettes` 테이블, `src/lib/design/`

## Connections

- [[feasibility-risks]] — ⚠️ 항목의 PoC 계획
- [[decisions]] — D-001~D-017 모두 Accepted (2026-09-29)

## v2 개정 (2026-10-05)

v1.0으로 전면 개정: ACP 호스트·파이프라인 제거, 터미널 실행+클립보드, 가이드 엔진, `workspace.json`·`scene.json`·`sequence.json` 계약, Bridge v2(step·done·choice), `.vsx` 패키지, 보안 개정. 런타임·디자인 토큰·Bridge 본체는 보존. 기획: [[refactor-spec-v2]], 결정: [[decisions]].
