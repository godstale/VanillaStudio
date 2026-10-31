<!-- vanilla:generated scene-hash=766ec7c284cee09e7de3cb2891c1074d5925c3d44e641be9b073fae8218bd758 body-hash=90ace990e12e772f271d102d34ded8261097c4b4656672950ff84d96f0d4d35a -->
# 표지와 메시지 — Guide

Generated from `scene.json` for workspace "slide-template". Read-only: change the scene in the app or in `scene.json`, not here.

Template: opus-narrative-deck@1 · Type: static · Status: generated

## Brief

- **subject**: 표지와 메시지
- **goal**: 01 시작하기 — S01
- **audience**: 일반 청중
- **message**: 슬라이드 템플릿
- **language**: ko

## Page

- **mode**: steps
- **layout**: keynote-16x9

## Sections

- cover
- statement
- cards
- compare

## Steps

- **s01-cover** 표지와 메시지 — advance: `key:ArrowRight`, enter: fade
  - copy: 발표 부제 · 날짜
슬라이드
템플릿
content.json 의 문구만 바꾸면 슬라이드가 바뀝니다
- **s01-statement** 표지와 메시지 — advance: `key:ArrowRight`, enter: fade
  - copy: 한 장에 한 가지 메시지
강조할 단어는 별표 두 개로 감싸세요
화면 하단의 보조 문구입니다
줄바꿈은 \n 으로 넣습니다
불릿은 bullets 배열에 한 줄씩 적습니다
- **s01-cards** 카드 레이아웃 — advance: `key:ArrowRight`, enter: fade
  - copy: cols 로 열 개수를 정합니다
문구는 data 에 화면 문구는 모두 storyboard/data/content.json 에 둡니다
코드는 shared 에 레이아웃 코드는 shared/deck 에 있고 모든 슬라이드가 공유합니다
에이전트에게 Claude Code 같은 에이전트에게 "이 주제로 슬라이드를 만들어 줘"라고 요청하세요
- **s01-compare** 비교 레이아웃 — advance: `key:ArrowRight`, enter: fade
  - copy: 왼쪽과 오른쪽을 나란히 놓습니다

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
