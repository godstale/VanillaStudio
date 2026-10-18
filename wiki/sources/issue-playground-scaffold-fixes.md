---
title: '실사용 검증 5건 수정 (스캐폴드·템플릿·static copy·플레이어 키·종료 멈춤)'
type: source
tags: [issue, scaffold, playground, bridge, static, templates]
date: 2026-10-18
source_file: src/lib/sequence/manager.ts
sources: [technical-design, decisions, milestone-v6]
last_updated: 2026-10-18
---

에이전트 실사용 검증 리포트 5건을 수정했다. 브랜치 `fix/scaffold-playground-5-issues`. 설계: [[technical-design]], 결정: [[decisions]].

## 1. 스캐폴드 초안 실행 불가

`resources/workspace-template/scripts/vanilla-agent.mjs` `renderDraftSourceFiles`가 `src/composition.tsx`에 신(Scene)을 그대로 내보내고, static 초안에서 `useSteps(숫자)`를 호출했다. 마운트는 Composition을 기대하므로(`packages/runtime/src/app.tsx`, `packages/runtime/src/mount.tsx`) 그대로는 TypeError로 앱이 뜨지 않았다.

- `composition.tsx` → `defineComposition({ scenes: [scene] })` 패턴으로 교체 (샘플 `resources/samples/sequence-demo/scenes/page/src/composition.tsx`와 동일).
- static 초안 → `STEPS: StepSpec[]` 상수(scene.json steps에서 매핑, 없으면 단일 `click` 스텝) + `useState` + `useSteps(STEPS, null, setIndex)`, `onClick={next}` 제거.
- `resources/guides/static/opus-narrative-deck@1/rules.md`·`checklist.md`의 존재하지 않는 API(`window.sceneRuntime?.reportStep`)를 `useSteps` 패턴으로 교체.
- `check-scene-core.mjs`에 `require-define-composition`(전 타입)·`static-use-steps`(숫자 인자 거부) 검사 추가. 기존에는 static이 검사 대상이 아니라 깨진 초안이 통과했다.

## 2. 템플릿 조용한 교체 + templates/taxonomy 0건

원인 2층: (a) `src-tauri/tauri.conf.json` 번들 리소스에 `guides`·`opus`가 빠져 설치본에서는 `install_agent_catalog_resources`가 조용히 건너뛰어 `.vanilla/resources/guides`가 생기지 않았다. (b) `vanilla-agent.mjs`의 `RESOURCES_DIR` 폴백(`ROOT/..`)이 실제 워크스페이스에서는 부모 폴더를 가리켰다.

- 번들에 `../resources/guides`·`../resources/opus` 추가.
- 리소스 탐색을 `설치본(.vanilla/resources) → 저장소 체크아웃` 순서로 변경하고, 없으면 명확한 경고를 낸다.
- `scaffold-scene`이 요청 템플릿을 못 찾아 기본값으로 바꿀 때 `Warning`을 낸다(조용한 교체 제거).
- `open_workspace`가 앱 소유 `vanilla/runtime` 복사본도 갱신하게 했다(아래 Bridge 확장과의 정합성).

## 3. static 신 문구 필드 충돌

루트 `AGENTS.md` Stage 2가 전부 `copy.items`에 옮기라 했으나 static 스키마(`src/lib/scene/schema.ts`, strict)에는 최상위 `copy`가 없다. 문구를 `AGENTS.md` 문장만 타입별로 수정: timed(`motion`/`3d`)는 `copy.items`(+`beats[].copy`), static은 `steps[].copy`. 스키마·폼·GUIDE 렌더·검사기는 원래 static=단계별 문구로 일치했으므로 문서만 고쳤다.

## 4. 플레이그라운드 모든 키가 다음으로 처리

`SequencePlayer`가 모든 키를 `manager.input`에 넣고, 매니저가 static 신에 무조건 `next()`(advance 무시)를 보냈다. 직접 열기는 신의 `controller.input()`이 advance를 검사하므로 정상이었다.

- Bridge에 `input` 메시지 추가(v2.1, `click` | `key:<Key>`, zod 검증): `packages/runtime/src/bridge.ts` + 앱 `src/lib/review/bridgeProtocol.ts`.
- 마운트 `input` 타깃은 신 트리(마운트 컨테이너)에 합성 `click`/`keydown`을 디스패치한다. `useSteps` 창 리스너는 advance에 맞을 때만 진행하고, 신 자체 단축키(N 노트·F 전체화면 등)도 같은 입력을 받는다. 단일 처리 경로라 이중 진행이 없다.
- 매니저 static 경로는 `h.input()`(타입 위임), 플레이어 다음-단계 버튼은 명시적 `stepForward()`(`next()` 유지, 기존 테스트·동작 보존).
- 구 런타임(확장 전 워크스페이스 복사본)은 `input`을 무시하므로 §2의 런타임 갱신과 함께 배포한다.

## 5. 마지막 단계 클릭 후 멈춤 가능

`advance()`가 `finished`를 영구 래치하고, 매니저 `onDone`은 엣지와 맞지 않는 입력에 아무 것도 하지 않아 복구가 없었다. §4 수정으로 mismatched 입력은 `done` 자체를 만들지 않아 원인이 해소되고, 추가로 복구 경로를 열었다.

- `createStepController.input()`: `finished` 뒤에도 마지막 스텝 규칙과 맞는 입력이면 `done`을 다시 알린다.
- `prev()`: `finished`를 풀고 마지막 스텝으로 되돌린다.

## 검증

- `pnpm lint`·`pnpm typecheck` 통과, `pnpm test` 158파일 1173테스트 통과, `cargo test` 127통과.
- `pnpm --filter @vanilla/runtime build`로 `resources/runtime` 재생성(`dist.test.ts` 통과).
- 임시 워크스페이스로 `scaffold-scene --template opus-narrative-deck@1` 실측: 템플릿 유지, 초안 코드 계약 준수. 리소스 없을 때 경고+폴백 동작 확인.

## Pitfalls

- Bridge 같은 버전 내 메시지 추가는 구 런타임이 무시하므로 안전해 보이지만, static 신은 입력 경로 자체가 바뀌어 낡은 복사본에서는 멈춘 것처럼 보인다. 앱 소유 복사본(`vanilla/runtime`, workspace `scripts/*.mjs`)은 열 때 갱신하는 쪽으로 맞춰야 한다.
- `checkScene`은 생성기와 같은 규칙 파일을 쓰므로, 생성기 버그(§1)는 검사기 공백과 세트로 온다. 생성기를 고칠 때 검사기에도 같은 케이스를 넣는다.
