# Vanilla Studio Wiki — Index

> 이 프로젝트의 지식베이스. 기획·설계·구현·검증·배포 전 과정의 지식을 구조적으로 분류한다.
> 운영 규칙: `AGENTS.md` §9 (Wiki 규칙). 시작점: [[overview]]. 변경 이력: `wiki/log.md`.
> 모든 ingest·페이지 추가 시 이 파일을 갱신한다.

## Project / Overview

- [[overview]] — 프로젝트 현황 요약과 읽는 순서
- [[VanillaStudio]] — 제품 정의

## Project / Requirements (P1)

- [[vanilla-studio-requirements]] — 요구사항 원본 요약 (원본: `wiki/originals/`)

## Planning / Specs (P2)

- [[product-spec]] — 상세 기획서 v0.3
- [[technical-design]] — 기술 설계서 v0.3
- [[feasibility-risks]] — 구현 난점·리스크·PoC 계획
- [[implementation-plan]] — 구현 계획서 v1.0 + TODO (P3)
- [[golden-samples]] — 골든 샘플 브리프 5종 초안(P5 품질 기준)
- [[parallel-execution]] — 병렬 실행 가이드: 웨이브·레인·워크트리·세션 프롬프트 (P4 진입점)

## Planning / Decisions

- [[decisions]] — 결정 기록 색인 (D-001~D-018, 모두 Accepted)

## Research

- [[research-2026-09-28-agents-rendering]] — 에이전트 연동·HTML 렌더·PPT·라이선스 조사
- [[research-2026-09-29-design-md-hyperframes]] — DESIGN.md 형식, HyperFrames FRAME.MD 프리셋 12종·카탈로그(템플릿 참고 자료)

## Domain / Product Concepts

- [[ProductionPipeline]] — 앱 내 제작 6단계 (Brief→Plan→Prompts→Build→Review→Export)
- [[ProjectFolderLayout]] — 사용자 프로젝트 폴더 구조
- [[UserParameters]] — 수동 조절 = 선언된 파라미터
- [[DesignTemplateSkill]] — 디자인 템플릿 = Agent Skill
- [[ColorPalette]] — 컬러 팔레트 = DESIGN.md 색 역할 토큰 교체
- [[DesignMd]] — DESIGN.md: 에이전트용 디자인 시스템 표준 파일
- [[Playground]] — 결과물 보관·재생

## Tech / Runtime & Rendering

- [[SceneRuntimeContract]] — `@vanilla/runtime` 계약
- [[VanillaBridge]] — 호스트↔미리보기 postMessage 프로토콜
- [[DeterministicRendering]] — 결정적 렌더링
- [[ExportPipeline]] — 유형별 export
- [[HyperFrames]] · [[Remotion]] · [[GSAP]] · [[DomToPptx]]

## Tech / Agent Integration & Security

- [[AgentClientProtocol]] — ACP
- [[PermissionPolicy]] — 에이전트 권한 정책
- [[AppOwnedProcesses]] — 앱 소유 프로세스 vs run_shell
- [[VisualSelfReview]] — 에이전트 시각 자기 검수(MCP)
- Agents: [[ClaudeCode]] · [[Codex]] · [[OpenCode]] · [[HermesAgent]] · [[AntigravityCLI]]

## Process / Phases & Logs

- [[DevelopmentPhases]] — 개발 단계 P0~P7 (플레이북: `Docs/Playbook/`)
- [[phase-p0-setup]] — P0 준비 로그
- [[phase-p2-planning]] — P2 상세 기획 로그
- [[phase-p3-implementation-plan]] — P3 구현 계획(+PoC·TODO) 로그
- PoC 로그 (P3):
  - [[poc-s1]] — HyperFrames로 React+R3F MP4 렌더 ✅ 통과
  - [[poc-s3]] — Rust ACP 클라이언트로 Claude Code 구동 ◐ (Claude 통과, Codex 미검증)
  - [[poc-s4]] — WebView2 iframe 미리보기 + Bridge ✅ 통과
  - [[poc-s7]] — DESIGN.md 토큰 파이프라인 + 팔레트 교체 ✅ 통과
  - [[poc-s2]] — 스틸 캡처 @2x + 이미지 PPTX/PDF ✅ 통과
  - [[poc-s6]] — Windows Doctor + FFmpeg 다운로드 ✅ 통과
  - [[poc-s5]] — dom-to-pptx 편집 가능 PPTX ◐ 조건부 통과(Beta 유지)
- 마일스톤 로그 (P4): `milestone-M0` ~ — 예정

## Syntheses

- (아직 없음) — `/wiki-synthesize`로 저장한 질의 답변
