---
title: 'Milestone M4: 검수·런타임 (Scene 런타임·검수 스튜디오·팔레트·수정 요청·MCP)'
type: source
tags: [milestone, phase-p4, m4]
date: 2026-09-30
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, parallel-execution, decisions, technical-design, poc-s1, poc-s2, poc-s4, poc-s7]
last_updated: 2026-09-30
---

## Summary

M4는 Scene 런타임 패키지와 검수 스튜디오를 구현했다. M4a 런타임(`@vanilla/runtime`: T4.1~T4.9)은 M1 웨이브 1(레인 D) → 웨이브 3(레인 R)에서, M4b 검수 스튜디오(T4.10~T4.21)는 웨이브 4(레인 V) → 웨이브 5(레인 D2·R2)에서 진행했고, 모두 `feat/m2-agents`에 `--no-ff`로 병합했다. T4.22 본 항목은 계획서 M4 완료 기준 데모 ①~⑥을 자동화 가능한 범위에서 수행한 기록이다. main 병합·push는 사용자 승인 대기.

## 한 일

| 레인 | 항목 | 결과 |
| --- | --- | --- |
| D 런타임 (M1 W1) | T4.1~T4.8 (+T3.5) | `defineScene`·`param.*`·`useParams`, clock/free 시계, 준비 신호·폰트·`__vanillaReady`, `<VanillaCanvas>`, 토큰 Vite 플러그인+`DesignProvider`·`useDesign`, Bridge 클라이언트, 결정성 도우미·`useInput`, `check_scene` ESLint 규칙 |
| R 런타임·워커 (W3) | T4.9 | 런타임 빌드·배포 경로(`resources/runtime`, 스캐폴딩 `install_runtime`에 포함, 최신성 테스트) |
| V 검수 스튜디오 (W4) | T4.10~T4.14, T4.21 | 프리뷰 서버(`vite-runner.mjs`), iframe+Bridge 호스트(origin 검사), HMR 누락 감지(Rust 감시+`reload`), 스크러버, 파라미터 패널, CDP E2E 하네스(`tests/e2e`, 1개 시나리오 PASS) |
| D2 디자인·팔레트 (W5) | T4.15~T4.17 | 디자인 패널(미리보기 `setDesign`→적용 시 `colors` 재작성+바이트 보존+체크포인트·대비 경고), 팔레트 라이브러리(`palette.json` 스키마), 팔레트 편집기(OKLCH·잠금·대비 표) |
| R2 수정 요청·MCP (W5) | T4.18~T4.20 | 수정 요청(`reviews/R-NNN.md`+`capture` 스크린샷→에이전트 요청), 체크포인트 전/후 비교, MCP 실구현 4도구(`snapshot_scene`·`check_scene`·`get_review`·`update_task_status`) |
| N 마무리 (W6) | T4.22 | 데모 ①~⑥ 자동화 범위 수행 + 본 기록 |

## 데모 ①~⑥ (계획서 M4 완료 기준)

| # | 데모 | 자동화 수행 결과 |
| --- | --- | --- |
| ① | 에이전트가 만든 Scene을 iframe 미리보기 | Bridge `ready`→loopback iframe(`http://127.0.0.1:*`, origin 검사) 흐름은 E2E `run-review-preview.mjs` 시나리오로 레인 V에서 PASS(본 레인에서 하네스 변경 없음). 본 레인: `BridgeContext.test.tsx`(3)·`mount.test.tsx`(5)·`bridgeProtocol.test.ts`(6) 전부 통과, CDP 포트에 실행 중 앱 없음 확인(재실행 제외, 아래 참조) |
| ② | 스크러버(clock 유형) | `Scrubber.test.tsx`(5: 재생·정지·프레임 이동·구간 반복·키보드)·`timeline.test.ts`(4)·`clock.test.ts`(15) 통과 |
| ③ | 파라미터 조절·저장 | `ParamsPanel.test.tsx`(4)·`params.test.ts`(5: 우선순위 코드<토큰<사용자 값) 통과. 저장 경로 `params/*.values.json`+체크포인트 배선은 레인 V 완료 보고 범위 |
| ④ | 팔레트 교체·적용·대비 경고 | `DesignPanel.test.tsx`(4: 미리보기 `setDesign`→되돌리기)·`designApply.test.ts`(6: `colors` 재작성·바이트 보존)·`palettes.test.ts`(9)·`PaletteEditor.test.tsx`(6) 통과. 실측 지연(<100ms)은 PoC S7·레인 V 기록으로 갈음 |
| ⑤ | 수정 요청 → 반영 → 전/후 비교 | `revision.test.ts`(13: R-001 발급·스크린샷 sidecar 파싱)·`Compare.test.tsx`(4) 통과. 목 에이전트 R-001 생성·반영 흐름은 레인 R2 완료 판정으로 갈음(실제 에이전트 대화는 제외) |
| ⑥ | `snapshot_scene`으로 에이전트 자기 검수 | `cargo test` MCP 5도구 스위트 전부 통과(`snapshot` sidecar 제공 4·`check` 6·`review` 4·`task` 3·서버 핑/토큰 6). 에이전트가 스냅샷을 보고 수정하는 실제 대화 데모는 제외 |

**제외 항목(자동화 불가, 명시)**: 실제 WebView2 수동 조작(이 검수 워크트리에는 GUI 세션이 없어 E2E 재실행을 못 했고, 실행 중 앱의 CDP 포트도 응답 없음), 실제 에이전트(Claude Code 등)와의 수정 반영 대화, CDP 지연 실측(<100ms) 재측정, 깨끗한 Windows VM. 수동 확인은 T7.2·사용자 확인으로 이월한다.

## 검증(최종)

- `pnpm lint` 통과(경고 0), `pnpm typecheck` 통과(루트+`packages/runtime`·`packages/export-worker`)
- `pnpm test`: 90파일 632테스트 전부 통과(M4 영역: runtime clock/bridge/ready/canvas/composition/mount/scene/helpers/design/vite/eslint-plugin, review BridgeContext/Scrubber/ParamsPanel/DesignPanel/Compare/revision/params/hmrGuard/timeline/previewLayout, design palettes/design, export-worker dist 최신성 포함)
- `cargo test`: 165개 통과·0 실패·4 ignored(실제 `claude-agent-acp`·vite preview·어댑터 설치·FFmpeg 다운로드는 수동 전용)
- E2E 하네스(`tests/e2e/*.mjs`)는 변경 없이 유지. 재실행은 제외(위 참조), 레인 V PASS 기록 유효

## 결정·문제·해결

- 새 결정 불필요. M4 범위에서 D-011(시간 함수 계약)·D-015/D-016(토큰·팔레트 계약) 준수, 위반 없음
- 후속 레인 인계 완료 사항: `palette.json` 통합 계약(`src/lib/design/palettes.ts`가 정본, templates 측은 alias re-export, 양쪽 스위트 통과), `snapshot_scene`은 호스트 캡처(`.b64` sidecar) 제공·실제 헤드리스 캡처는 T5.4 영역, `update_task_status`의 done은 클레임 보드로 기록되고 runner가 클레임으로 취급
- Pitfalls
  - HMR 연속 쓰기 누락(S4): 파일 감시+`hmr` 보고 비교로 감지하고 `reload`/`init`으로 복원한다. `hmrGuard` 테스트가 S4 30ms 연속 쓰기 패턴을 재현한다
  - 팔레트 미리보기와 적용을 분리한다: 미리보기는 Bridge `setDesign`(메모리 반영), 적용은 `DESIGN.md` front matter `colors` 재작성+본문 hex 갱신+체크포인트. 되돌리기는 `setDesign(null)`
  - `resources/runtime` 최신성은 `dist.test.ts`가 강제한다(배포본이 stale하면 실패). 런타임을 고치면 `pnpm --filter @vanilla/runtime build` 후 테스트를 돌린다
  - E2E는 실행 중 앱(CDP 포트)이 전제다. `--prepare` 픽스처는 `resources/runtime`을 `vanilla/runtime`에 복사해야 `pnpm install`이 성공한다

## 남은 일(M4 이후)

- 수동 확인 이월: WebView2 실기동 검수 흐름(CDP E2E 재실행), 실제 에이전트 수정 반영 대화, 지연 실측 — T7.2·사용자 확인
- 코드 잔여 없음: T4.1~T4.21 전부 체크, T4.22 본 항목으로 마감

## Connections

[[implementation-plan]] · [[parallel-execution]] · [[decisions]] · [[technical-design]] · [[poc-s1]] · [[poc-s2]] · [[poc-s4]] · [[poc-s7]] · [[SceneRuntimeContract]] · [[VanillaBridge]] · [[DeterministicRendering]] · [[VisualSelfReview]] · [[ColorPalette]]
