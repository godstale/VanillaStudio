---
title: '리서치: 에이전트 연동·HTML 렌더·PPT 변환·라이선스 (2026-09-28)'
type: source
tags: [research, phase-p2]
date: 2026-09-28
source_file: ''
sources: []
last_updated: 2026-09-28
---

## Summary

P2 기획 중 수행한 외부 리서치 기록. 에이전트 연동 표준([[AgentClientProtocol]]), HTML→영상 결정적 렌더([[HyperFrames]], [[Remotion]]), HTML→PPTX([[DomToPptx]]), 애니메이션 라이브러리 라이선스([[GSAP]])를 조사했다. 정보는 2026-09 기준이며 PoC에서 재확인한다.

## Key Claims

- ACP는 JSON-RPC 2.0 over stdio, 에디터↔에이전트 표준. Claude Code·Codex는 `agentclientprotocol` 조직의 공식 어댑터, OpenCode·Hermes(`hermes acp`)는 네이티브, Rust/TS SDK 존재.
- [[AntigravityCLI]](`agy`)는 네이티브 ACP 없음(기능 요청 이슈 #31), 커뮤니티 어댑터 다수, `-p` 헤드리스 + `--output-format json/stream-json` 지원, 헤드리스에서 셸은 기본 soft-deny.
- [[HyperFrames]](HeyGen, Apache-2.0): HTML + data 속성, `window.__timelines`에 paused 타임라인 등록, GSAP·CSS/WAAPI·Lottie·three.js·Anime.js 어댑터, three.js는 `hf-seek` 이벤트로 프레임 렌더, Node 22+·FFmpeg·헤드리스 Chrome, CLI `init/preview/render/lint/snapshot/doctor`, 에이전트 스킬 제공.
- 결정적 캡처 원리: 브라우저 시간 가상화 + BeginFrame 캡처 (WebVideoCreator, Replit 블로그).
- [[Remotion]]: 개인·3인 이하 조직 무료, 그 외 유료(좌석당/렌더당).
- [[GSAP]]: 2025-04부터 전체 무료, 단 Webflow와 경쟁하는 노코드 비주얼 애니메이션 빌더에서 사용 금지. AI 생성 코드는 허용.
- [[DomToPptx]]: 클라이언트 사이드, PptxGenJS 기반, 편집 가능 PPTX, 스피커 노트 지원.

## Sources

- https://agentclientprotocol.com/get-started/agents
- https://github.com/agentclientprotocol/rust-sdk
- https://hermes-agent.nousresearch.com/docs/user-guide/features/acp
- https://antigravity.google/docs/cli/headless/
- https://github.com/google-antigravity/antigravity-cli/issues/31
- https://github.com/heygen-com/hyperframes
- https://hyperframes.heygen.com/concepts/frame-adapters
- https://blog.replit.com/browsers-dont-want-to-be-cameras
- https://www.remotion.dev/docs/license/faq
- https://gsap.com/community/standard-license/
- https://github.com/atharva9167j/dom-to-pptx

## Connections

- [[feasibility-risks]] — 이 리서치를 근거로 리스크 판정
- [[decisions]] — D-001, D-003, D-004, D-007
