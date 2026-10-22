---
title: 'Standalone Play'
type: source
tags: [playback, workspace-template, bridge, presentation]
sources: [Docs/Planning/Decisions.md, Docs/Planning/Technical-Design.md]
last_updated: 2026-10-22
---

# Standalone Play (D-040) — 앱 없이 자체 빌드·발표

생성된 워크스페이스는 Vanilla Studio 없이도 발표용으로 재생할 수 있다.
`source_file`: `Docs/Planning/Decisions.md` (D-040), `Docs/Planning/Technical-Design.md` (§2.2·§4.2.2·§9, v1.2).

## 배경

기존에는 신별 URL(`scenes/<slug>/src/index.html`)을 브라우저에 직접 지정해야 했고,
루트 `index.html`은 스텁이었다. 시퀀스 전체를 연속 재생하려면 스튜디오 플레이그라운드가 필수였다.

## 구현 (`resources/workspace-template`, [[decisions]] D-040)

- `play.html` + `play/` (`manifest.ts`·`host.ts`·`navigator.ts`·`Player.tsx`·`main.tsx`·`play.css`): 새 의존성 없음.
- `index.html` → `play.html` 리다이렉트: `pnpm dev` 출력 URL이 바로 재생 화면.
- `package.json`: `play` (`vite --open play.html`)·`preview` (`vite preview --open play.html`).
- `vite.config.ts`: 멀티 엔트리(`index`·`play`·`scenes/*/src/index`) + `base: './'` → `dist/`가 어떤 정적 서버에서든 동작.
- `tsconfig.json`: `play` 포함 + `resolveJsonModule` + `vite/client` 타입.
- 문서: `VANILLA_GUIDE.md` §7, 템플릿 `AGENTS.md` (play/preview + Standalone Play 절).

## 동작 원리

- `manifest.ts`: `workspace.json`·`sequence.json`·`scenes/*/scene.json`을 빌드 시점에 번들(fetch 없음).
- `host.ts` (`SameOriginScene`): Bridge v2 호스트 최소 구현. `ready`에 `init`(canvas 주입) 응답,
  `time`·`step`·`done`·`choice`·`error` 수신, `play`·`pause`·`seek`·`input`·`next`·`prev` 송신.
  origin·source 검증, HMR 재-`ready`마다 `init` 재전송.
- `navigator.ts`: `src/lib/sequence/manager.ts` 의미 이식(DOM 없음, 타이머 주입 가능).
  `end`·`timeout:Ns`(일시정지 보존)·`click`·`key:K`·`choice:` 처리. 전환은 컷/페이드로 단순화
  (스튜디오의 두 iframe 오버레이 + WAAPI 합성 미포함).
- `Player.tsx`: 입력 오버레이(iframe은 `pointer-events: none`), 신 목록·진행률·선택지·전체화면,
  `#/play/<sceneId>` 딥링크, 도움말. 명시적 단계 버튼은 레거시 `next`/`prev`라 구 런타임에서도 동작.

## 검증 (2026-10-22, `tests/LLM_and_Vibe_Coding_Day02_v2`, 23신)

- `tsc --noEmit` 5종 워크스페이스 전부 통과.
- `vite build`: `dist/play.html` + 23개 신 엔트리 + 에셋(상대 경로) 확인.
- `vite preview`/`vite dev` 서빙 후 curl 200 (`/`·`/play.html`·신 엔트리).
- 컴파일된 `navigator.js`·`host.js` 실행 테스트 10건 통과(시작·입력 위임·종료 추적·timeout·choice·점프·일시정지·빈 시퀀스·호스트 검증).
- `pnpm check:scene` 23신 전부 PASS. 루트 eslint(새 템플릿 파일) `--max-warnings=0` 통과.
- 기존 5종 `tests/LLM_and_Vibe_Coding*`에 백필(로컬 전용·gitignore, 커밋 제외).

## Pitfalls

- `dist/`는 반드시 http(s)로 서빙 (`pnpm preview`). `file://`에서는 모듈·`postMessage` Bridge가 동작하지 않는다
  (호스트 타임아웃 메시지에 안내 포함).
- 구 런타임(v2.1 `input` 이전) 신: 클릭·키 위임 무시 → `‹` `›` 단계 버튼 사용 (도움말 명시).
- 스튜디오 전환 연출(crossfade 외 7종·match-cut 제외)과 동일하지 않음 — 발표용 단순 재생으로 문서화.
- **시간 신의 `end` 트리거가 발동하지 않음(2026-10-22 수정)**: 신의 `ready`(duration 포함)는 `load()` 대기 중에 도착하는데
  내비게이터는 `load()`가 끝난 뒤에야 `subscribe`해 duration이 항상 `null` → `end` 판정·시크바가 빠졌다(정적 신만 있던 덱에선 드러나지 않음).
  `SameOriginScene`이 마지막 `ready`를 보관해 늦은 구독자에게 재생한다(`play/host.ts`). 발견: Day02 v2 인트로 모션 신(S00) 추가 시.
- **일시정지 후 → 진행 무시(2026-10-22 수정)**: 영상 신에서 화면 클릭(일시정지 토글) 뒤나
  시크·음량 슬라이더 포커스 상태에서는 → 키가 무시됐다. 매니저·내비게이터 `input()`이
  일시정지 중에도 입력을 받도록 하고, 키 가드는 글자 입력란만 건너뛴다. 상세: [[issue-paused-arrow-advance]]
- 배경음 있는 신: 브라우저 자동재생 정책상 첫 클릭·키 입력 전에는 오디오가 `suspended`. 같은 출처 iframe이라 플레이어(부모)에서의 첫 클릭으로 풀린다.
