---
title: 'Refactor Spec v2'
type: source
tags: [planning, refactor, v2]
sources: []
last_updated: 2026-10-05
---

v2 리팩토링 기획서 초안(Scene 워크스페이스: ComfyUI형 캔버스, scene.json 가이드, 터미널 에이전트 실행, 시퀀스 그래프, 공유 패키지). 원문: `Docs/Planning/Refactor-Spec-v2.md`, 결정 D-022~D-033(Proposed, [[decisions]]).

인터뷰 확정: 기존 코드는 새 방향으로 대체, 결과물은 코드 기반, 시퀀스는 노드 그래프, 가이드는 scene.json+GUIDE.md 생성, 터미널은 앱 내장, 레퍼런스 분석은 에이전트 태스크, 런타임은 기존 Scene 런타임 재사용, v2.0은 공유 패키지+재생만. 열린 질문은 기획서 §14. See: [[overview]]

2차 인터뷰(v0.2): 워크스페이스당 시퀀스 1개(D-029), 캔버스 전역 고정(D-030), 사용자 정의 템플릿 v2.0 포함(D-031), 정적 페이지 사용자 입력 진행·step(D-032), v1 마이그레이션 조건부(D-033), 오디오 기록 전용.
