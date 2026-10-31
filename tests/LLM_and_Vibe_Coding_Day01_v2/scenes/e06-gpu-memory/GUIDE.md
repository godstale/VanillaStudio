<!-- vanilla:generated scene-hash=96683f1efcff15222f08f44c36f250b7d8d0bcd09d0404e8ae3e83b2c544ee4b body-hash=6c759d35382486b7a79655243bde9054b791f42cae3ad44c4c9663389d138b9a -->
# E6. 생각의 원리: GPU와 메모리 — Guide

Generated from `scene.json` for workspace "LLM_and_Vibe_Coding_Day01_v2". Read-only: change the scene in the app or in `scene.json`, not here.

Template: opus-narrative-deck@1 · Type: static · Status: generated

## Brief

- **subject**: GPU와 메모리
- **goal**: + 생각의 원리 — 강의안 E06
- **audience**: 중학생 이상 일반인
- **message**: 이제 이해가 되시나요?
- **language**: ko

## Page

- **mode**: steps
- **layout**: keynote-16x9

## Sections

- cards
- statement

## Steps

- **e06-bottleneck** 인공지능의 병목 — advance: `key:ArrowRight`, enter: fade
  - copy: 어려운 고등 미적분이 아니라, 수십억 번의 곱셈과 덧셈의 무한 반복
GPU 벡터 곱셈과 덧셈(행렬 곱, GEMM) — 게임 화면의 수많은 점을 동시에 계산하도록 진화한 프로세서
메모리 진짜 병목. 거대한 모델 + 입력에 따라 불어나는 KV 캐시 + 몰려든 사용자들의 데이터
데이터 이동 HBM ↔ DRAM으로 나뉜 작업 공간을 오가며 연산 — 이 이동 시간이 가장 큰 병목
인프라 데이터센터가 몇 배로 → 전력·냉각수·전선·발전기
- **e06-why** GPU와 메모리 — advance: `key:ArrowRight`, enter: fade
  - copy: 이제 이해가 되시나요?
NVIDIA가 세계 최대 시가총액 회사가 된 이유
삼성전자와 SK하이닉스 주가가 그렇게 오른 이유
전력과 데이터센터 관련 주식이 활황인 이유

## Breakpoints

- 1920x1080

## Accessibility

- wcag-aa-contrast
- keyboard-nav

## References

_(empty)_

## User prompt

_(empty)_

## Fields you may fill

`mode`, `steps`, `sections`, `layout`, `breakpoints`, `accessibility`, `status`
