<!-- vanilla:generated scene-hash=180b52017d1ce9575f9251a0966796c063499e637da6a2d79d6fce105cf58dba body-hash=4d32d5ca4426d0a22749cb02c09f37a1a95558fae57c0e70d94c72a261dd2dfc -->
# 08. 딥러닝의 시작, CNN — Guide

Generated from `scene.json` for workspace "LLM_and_Vibe_Coding_Day01_v2". Read-only: change the scene in the app or in `scene.json`, not here.

Template: opus-narrative-deck@1 · Type: static · Status: generated

## Brief

- **subject**: 딥러닝의 시작, CNN
- **goal**: 03 보고 기억하는 신경망 — 강의안 S08
- **audience**: 중학생 이상 일반인
- **message**: 합성곱 신경망(CNN)
- **language**: ko

## Page

- **mode**: steps
- **layout**: keynote-16x9

## Sections

- split
- cards

## Steps

- **s08-lecun** 딥러닝의 시작, CNN — advance: `key:ArrowRight`, enter: fade
  - copy: 얀 르쿤 · 미국 뉴저지 벨 연구소(트랜지스터가 태어난 곳)
합성곱 신경망(CNN)
미국 우체국이 모은 우편번호 손글씨를 인식하는 과제
제각각인 손글씨를 읽어 낼 수 있는 새로운 신경망을 고안
- **s08-how** CNN은 어떻게 보는가 — advance: `key:ArrowRight`, enter: fade
  - copy: 인간의 시각 피질을 모방
도장 찍듯 훑는 필터 이미지의 2차원 공간 정보를 유지한 채 필터(마스크)를 이동시키며 특징을 추출
부분에서 전체로 지역적인 패턴을 먼저 파악하고 점차 전체 조합을 찾는다 — 하위층은 짧은 선·모서리, 중간층은 동그라미·꺾인 모양
더 적은 연산 전부 다 연결하지 않으니 연산량과 필요한 학습 데이터가 줄어든다
- **s08-lenet5** 딥러닝의 시작, CNN — advance: `key:ArrowRight`, enter: fade
  - copy: LeNet-5 완성
1998
10여 년 연구 끝에 나온 완성형
이때 정리한 손글씨 숫자 데이터 = MNIST (딥러닝 입문자의 첫 예제)
실제 은행 수표 판독에 사용
하지만 큰 사진은 여전히 엄청난 연산량을 요구

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
