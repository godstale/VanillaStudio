---
version: alpha
name: LLM Day2 Midnight Amber
description: Deep-navy keynote deck with a single amber accent — bold Korean headlines, translucent slate cards, framed photos with source captions — for the Day 2 vibe-coding evolution lecture (same template as Day 1).
colors:
  canvas: "#151A27"
  canvas-deep: "#0F131D"
  glow-warm: "#5B4524"
  glow-cool: "#1D3560"
  surface: "#232A3B"
  surface-raised: "#2B3346"
  line: "#3A4358"
  ink: "#F4F5F8"
  ink-muted: "#A7AEBD"
  ink-faint: "#6F788C"
  primary: "#F6B93B"
  primary-soft: "#3B3324"
  on-primary: "#17130A"
  accent: "#63C7EA"
  success: "#5BD68F"
  danger: "#F27474"
  paper: "#F7F7F4"
  paper-ink: "#1B1F29"
typography:
  display:
    fontFamily: Pretendard Variable
    fontSize: 104px
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: -0.03em
  heading:
    fontFamily: Pretendard Variable
    fontSize: 44px
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: Pretendard Variable
    fontSize: 64px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.02em
  number:
    fontFamily: Pretendard Variable
    fontSize: 140px
    fontWeight: 800
    lineHeight: 1
    letterSpacing: -0.04em
  body-md:
    fontFamily: Pretendard Variable
    fontSize: 30px
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: Pretendard Variable
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.4
spacing:
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
  safe-x: 96px
  safe-y: 72px
rounded:
  md: 14px
  lg: 22px
  pill: 999px
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  chip:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  paper-frame:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.lg}"
---

# LLM Day2 Midnight Amber

## Overview

「LLM과 바이브 코딩」 2일차 강의 덱. 2022년 ChatGPT 쇼크부터 2026년 에이전트 군단까지 **바이브 코딩의 진화**를 따라간다. 1일차 덱과 같은 템플릿·토큰을 쓴다.
짙은 네이비 무대 위에 **앰버 한 가지**로 시선을 모으는 키노트 스타일(`references/template-design/` 분석).
강연자가 말로 풀고, 화면은 핵심어·연도·사진·도식만 크게 보여 준다.

## Colors

- **Canvas → Canvas-deep:** 배경 그라디언트. 우상단에 `glow-warm`, 좌하단에 `glow-cool`을 아주 넓고 흐리게 깐다(템플릿의 은은한 빛).
- **Surface / Surface-raised / Line:** 반투명 슬레이트 카드와 1px 테두리. 그림자는 `canvas-deep`을 섞은 한 겹만.
- **Ink / Ink-muted / Ink-faint:** 제목·핵심 / 보조 설명 / 출처·연도 눈금·과거 상태.
- **Primary(앰버):** 유일한 강조색. 제목 왼쪽 세로바, 챕터 칩, 강조 단어, 숫자, 불릿, 막대, 현재 연도 마커.
- **Accent(하늘색):** 두 번째 신호. 비교의 반대편, 데이터 흐름 화살표, 신경망 노드처럼 앰버와 짝을 이룰 때만 쓴다.
- **Success / Danger:** 정답·해결 / 실패·겨울·경고.
- **Paper / Paper-ink:** 흰 바탕 다이어그램 이미지(논문 그림·도식)를 담는 밝은 액자.

## Typography

- 모든 글자는 Pretendard Variable(OFL, `pretendard` 패키지로 로컬 번들). 숫자도 같은 서체의 800 굵기.
- 1920 폭 기준: 신 제목 44px, 표지·구분 화면 제목 64~104px, 히어로 숫자 140px 안팎, 본문 28~32px, 캡션 22px.

## Layout

- 16:9 1920×1080. 안전 영역은 좌우 `safe-x`, 상하 `safe-y`.
- 좌상단: 앰버 세로바 + 신 제목(+ 작은 부제). 우상단: 챕터 칩 `[번호] 챕터명`.
- 하단: 2021→2026 **연대기 바**(월 단위, 연도가 있는 화면만). 현재 화면의 시점을 앰버 점으로 표시한다. 우하단: 신 번호·스텝 점.
- 본문 기본형은 "그림(왼쪽) + 설명(오른쪽)" 2단, 카드 그리드, 좌우 비교, 연표, 큰 숫자, 한 문장 선언. 개념 도식(탭 코딩 에디터, 컨텍스트 스택, 루프, 피라미드)은 코드로 그린다.

## Components

- **Chip:** 앰버 바탕 작은 번호 + 회색 챕터명.
- **Card:** `surface` 바탕 + `line` 테두리, `rounded.lg`. 번호 카드는 앰버 번호(01, 02…)가 왼쪽 위에 붙는다.
- **Figure:** 둥근 모서리 사진 + 우하단 `출처 ·` 캡션. 흰 바탕 도식은 `paper` 액자에 넣는다.
- **Timeline list:** 연도(앰버) + 사건 제목 + 한 줄 설명. 클릭할 때마다 한 줄씩 드러난다.
- **Divider:** 큰 앰버 챕터 번호 + 세로바 + 두 줄 제목.

## Do's and Don'ts

- Do: 강조 단어는 문장 안에서 앰버로만 바꾼다(`**단어**`).
- Do: 연표·목록은 클릭할 때마다 한 줄씩, 나머지 화면은 한 번에 보여 준다. 움직임은 짧은 페이드·슬라이드만.
- Do: 사진에는 출처 캡션을 단다.
- Don't: 앰버 외의 강조색 남발, 그라디언트 글자, 반복 애니메이션.
- Don't: 신 코드에 hex·폰트·간격 하드코딩 — `var(--color-*)`만 쓴다. 문구는 `storyboard/data/content.json`에만 둔다.
