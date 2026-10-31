# 02. 설계서 (Design Flow)

> 기획서(01)를 바탕으로 발표의 흐름과 데이터 구조를 정합니다.

## 서사 구조

챕터 단위로 발표의 흐름을 적습니다. 챕터는 `storyboard/data/content.json`의 `chapters`와 1:1로 맞춥니다.

| 챕터 | 제목 | 이 챕터에서 전달할 것 |
| --- | --- | --- |
| ch01 | | |
| ch02 | | |

## 데이터

- `storyboard/data/content.json` — 덱 정보, 챕터, 신(Scene)별 화면(`screens`). **문구의 유일한 원본**입니다.
- `storyboard/data/items.json` — 도식에 쓰는 구조화 데이터(필요할 때만).
- 이미지는 `assets/img/`, 영상은 `assets/video/`에 두고 `figure.src`·`videos[].src`에 파일명만 적습니다.

## 조립 순서

1. `content.json`에 신과 화면을 적는다.
2. `node scripts/sync-deck.mjs && pnpm vanilla sync-guides`로 신 폴더·시퀀스를 만든다.
3. `pnpm play`로 확인한다.
