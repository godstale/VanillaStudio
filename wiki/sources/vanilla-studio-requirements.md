---
title: 'Vanilla Studio 요구사항 (원본)'
type: source
tags: [requirements, phase-p1]
date: 2026-09-28
source_file: wiki/originals/vanilla-studio-requirements.txt
sources: []
last_updated: 2026-09-28
---

## Summary

사용자가 직접 작성한 P1 산출물. [[VanillaStudio]]를 "에이전트가 브라우저 기술만으로 웹·PPT·이미지·2D/3D 영상·인터랙티브 페이지를 만드는 디자인 스튜디오"로 정의한다. 생성형 이미지/영상 AI를 배제하고 코딩으로 구성요소를 쌓아 올리는 철학("바닐라")이 핵심이다.

## Key Claims

- 사용 에이전트: Claude Code, Codex, AGY, Hermes, OpenCode ([[ClaudeCode]], [[Codex]], [[AntigravityCLI]], [[HermesAgent]], [[OpenCode]])
- 동작 7단계: 결과물 지정 → 자료 제공 → 기획서 → 구현 계획서(프롬프트) → 화면 작성 → 검수(수동 조절·수정 요청 반복) → export ([[ProductionPipeline]])
- 기획서는 화면·asset 배치·움직임·타임라인·최적 구현 방법·**사용자 customize 가능 범위**를 포함 ([[UserParameters]])
- 구현 계획서는 asset → 화면 순서의 개별 프롬프트 집합
- 결과물 패키지는 React + three.js 앱에서 사용 가능한 형태 지향, 더 범용적 대안 허용 ([[ExportPipeline]])
- 디자인 템플릿 = 구현 계획서(프롬프트) 패키지 ([[DesignTemplateSkill]])
- 플레이그라운드: 결과물 보관·재생, 추후 서버 연동 ([[Playground]])

## Key Quotes

> "결과물을 보여줄 수 있는 출력 플랫폼인 브라우저와 HTML/JS/CSS 등과 같은 최소한의 제약만을 설정하고, 에이전트가 자율적으로 창의적인 작업들을 수행하는 것을 지향합니다."

## Connections

- [[product-spec]] — 이 요구사항을 구현 가능한 형태로 구체화
- [[feasibility-risks]] — 요구사항별 구현 가능성 검토(RQ1~RQ14)

## Contradictions

- "사용자가 수동으로 조절" → 임의 조절은 구현 비현실적, 선언된 파라미터 조절로 한정 ([[decisions]] D-007)
