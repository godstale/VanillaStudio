---
title: '일시정지 후 화살표 진행 무시'
type: source
tags: [playback, sequence, keyboard, bugfix]
sources: [src/lib/sequence/manager.ts, resources/workspace-template/play/navigator.ts]
last_updated: 2026-10-22
---

# 일시정지 후 화살표 진행 무시 (2026-10-22 수정)

`tests/LLM_and_Vibe_Coding_Day02_v2` 24신 시퀀스(S00 인트로 `key:ArrowRight` 전환):
영상 재생이 끝난 뒤 → 키를 눌러도 다음 신으로 넘어가지 않았다.
스튜디오 Play 화면과 `pnpm play`/`preview` 모두 동일했다.

## 원인 2가지

1. **일시정지 중 입력 폐기**: 시퀀스 매니저(`src/lib/sequence/manager.ts`)와
   스탠드얼론 내비게이터(`resources/workspace-template/play/navigator.ts`)의
   `input()`이 `paused` 상태에서 모든 입력을 버렸다.
   영상 신은 클릭 분기가 없을 때 화면 클릭이 재생/일시정지 토글이므로,
   사용자가 화면을 한 번 클릭했다(→ 일시정지) 하면 이후의 → 키가 전부 무시됐다.
   영상 종료 후 클릭→일시정지→→키 순서에서 재현된다.
   수정: `paused`에서도 입력을 받는다. 영상 신은 엣지를 평가해 따라가고,
   정적 신은 타입 입력을 신에 위임한다.
2. **슬라이더 포커스가 화살표 가로챔**: 플레이어 키 핸들러가 모든 `INPUT` 포커스를
   건너뛰었다. 시크·음량 슬라이더(`input[type=range]`)를 만진 뒤에는 → 키가
   슬라이더 조절로만 소비되고 신 이동이 안 됐다.
   수정: 글자 입력란(`text`·`search` 등, `select`·`textarea`·contentEditable)만
   건너뛰고, range 슬라이더 위의 화살표/스페이스는 `preventDefault` 후 신 이동으로 쓴다.

## 수정 범위

- `src/lib/sequence/manager.ts` (`input` 일시정지 허용) + `manager.test.ts` 회귀 테스트
- `src/components/playground/SequencePlayer.tsx` (키 가드 `isTextInput`) + 회귀 테스트 2건(일시정지 후 →, 슬라이더 포커스 →)
- `resources/workspace-template/play/navigator.ts`·`Player.tsx` (스탠드얼론 동일 수정)
- 기존 워크스페이스는 템플릿 복사본이므로 수정 후 `pnpm build`로 `dist/`를 다시 뽑아야
  `pnpm preview`에 반영된다(`pnpm play` dev 서버는 파일 수정 즉시 반영).

## 검증

- `pnpm test -- src/lib/sequence/manager.test.ts src/components/playground/SequencePlayer.test.ts`: 40 통과
- `pnpm typecheck`, `pnpm lint`: 통과

See: [[standalone-play]]
