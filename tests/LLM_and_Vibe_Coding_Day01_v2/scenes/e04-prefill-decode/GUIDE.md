<!-- vanilla:generated scene-hash=58d45c3b0756b97dee69c323c3c0def38b14f0c467c230a3cbd18bc72e439533 body-hash=e180f2ace5c680d1a09ce194a094db1c656437540bf061585d494c72add7d00d -->
# E4. 생각의 원리: 프리필과 디코딩 — Guide

Generated from `scene.json` for workspace "LLM_and_Vibe_Coding_Day01_v2". Read-only: change the scene in the app or in `scene.json`, not here.

Template: opus-narrative-deck@1 · Type: static · Status: generated

## Brief

- **subject**: 프리필과 디코딩
- **goal**: + 생각의 원리 — 강의안 E04
- **audience**: 중학생 이상 일반인
- **message**: 프리필과 디코딩
- **language**: ko

## Page

- **mode**: steps
- **layout**: keynote-16x9

## Sections

- split

## Steps

- **e04-prefill** 프리필(Prefill) — advance: `key:ArrowRight`, enter: fade
  - copy: 사용자가 미리 입력한 문장(프롬프트)을 변환하는 과정
입력이 이미 정해져 있으니 병렬로 빠르게 계산
각 단어는 Attention 계산용 상태를 기록해 둔다 = KV 캐시
각 단어는 자기보다 앞에 나온 단어와의 관계만 계산 — 자기 위치까지의 문맥을 담는다
- **e04-decode** 디코딩(Decoding) — advance: `key:ArrowRight`, enter: fade
  - copy: 답변이 끝날 때까지 토큰 단위로 하나씩 반복(Loop)
마지막 단어 벡터(히든 스테이트) = 지금까지 문맥을 모두 압축한 벡터
다음에 올 단어의 확률을 계산 → 가장 그럴듯한 단어를 덧붙인다
새 단어와 기존 단어의 관계를 다시 계산 → 또 새로운 히든 스테이트
하나씩 생성하므로 프리필처럼 병렬로 계산할 수 없다

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
