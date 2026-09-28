---
title: 'Feasibility & Risks v0.1 (구현 난점·리스크·PoC)'
type: source
tags: [planning, risk, poc, phase-p2]
date: 2026-09-28
source_file: Docs/Planning/Feasibility-Risks.md
sources: [vanilla-studio-requirements, research-2026-09-28-agents-rendering]
last_updated: 2026-09-28
---

## Summary

요구사항 RQ1~RQ14의 구현 가능성을 판정하고, 고위험 영역(에이전트 이질성, 결정적 렌더링, 심미 품질)과 중위험 영역(수동 조절, HTML→PPTX, 프리뷰 환경, 의존성 설치, 보안, 라이선스)에 대한 대응을 정리했다. PoC S1~S6을 P3 첫 작업으로 정의한다.

## Key Claims

- "심미적으로 뛰어난" 품질은 보장 불가한 품질 목표 → 템플릿 스킬 + [[VisualSelfReview]] + 골든 샘플 평가로 관리
- 임의 수동 조절은 비현실적 → 선언된 [[UserParameters]]로 한정
- 결정적 렌더링: 시간 순수 함수 + R3F demand + HyperFrames seek ([[DeterministicRendering]])
- 라이선스: [[HyperFrames]] Apache-2.0 채택, [[Remotion]] 유료 조건으로 미채택, [[GSAP]]는 앱 기능에서 비의존, FFmpeg는 번들하지 않고 동의 후 다운로드

## PoC 목록

| ID | 내용 |
| --- | --- |
| S1 | React+R3F 빌드 → HyperFrames MP4 렌더 결정성 |
| S2 | 스틸 캡처 + 이미지 PPTX |
| S3 | Rust ACP 클라이언트로 Claude Code·Codex 구동 |
| S4 | WebView2 iframe + Vite HMR + Bridge |
| S5 | dom-to-pptx 편집 PPTX 품질 |
| S6 | Windows Doctor |

## Connections

- [[technical-design]], [[decisions]], [[DevelopmentPhases]] (P3에서 수행)
