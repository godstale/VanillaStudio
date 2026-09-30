---
title: 'Milestone M5: Export (워커·형식별 export·작업 큐·임베드)'
type: source
tags: [milestone, phase-p4, m5]
date: 2026-09-30
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, parallel-execution, technical-design, poc-s1, poc-s2, poc-s5]
last_updated: 2026-09-30
---

## Summary

M5는 export 워커(Node)와 형식별 export·작업 큐·임베드 패키지를 구현했다. 웨이브 4 레인 X(T5.1·T5.3·T5.4·T5.5·T5.6·T5.8) → 웨이브 5 레인 X2(T5.2·T5.9·T5.7) → 웨이브 6 레인 O(T5.10·T5.11)로 진행했고, `feat/m2-agents` 계열에 병합했다. T5.11 데모는 `vanilla-export.mjs` 번들 미연결(X2 인계 확인) 탓에 워커 직접 실행 기준으로 수행해 4/5 형식을 자동화 통과했고, video MP4는 환경 차단으로 T7.2에 이월한다. main 병합·push는 사용자 승인 대기.

## 한 일

| 레인 | 항목 | 결과 |
| --- | --- | --- |
| X 워커 | T5.1, T5.3, T5.4, T5.5, T5.6, T5.8 | 워커 골격(작업 JSON·NDJSON·취소·환경 변수), web zip, 스틸 캡처 공통, image 변형 일괄, slides 이미지 PPTX+PDF, video MP4+포스터 |
| X2 UI·편집 | T5.2, T5.9, T5.7 | 작업 큐 Context·진행률·취소 UI, 유형별 옵션 다이얼로그, 편집 PPTX(Beta: 벤더 번들·`wrap="none"` 후처리·폰트 동봉) |
| O 임베드·마무리 | T5.10, T5.11 | `embed.ts`(ES 모듈+`<vanilla-scene>`+React 래퍼+예제), 5종 데모 수행·본 문서 |

## 검증(T5.11 데모, 워커 직접 실행)

- `web`: `site.zip`(1647B) → 해제하면 `index.html`에 장면 포함
- `image`: 2샷 × PNG/JPG × @1x/@2x = 8파일. `cover@1x.png` 480×270, `@2x` 960×540(PNG 헤더 실측). 같은 스틸 2회 캡처 바이트 동일(S2 결정성)
- `slides`: 슬라이드 3장 캡처 → `slides.pptx` 87KB(`ppt/slides/slide*.xml` 3건, JSZip 실측) + `slides.pdf` 34KB(3쪽·960×540pt, pdf-lib 실측)
- `embed`: `index.html`+`vanilla-scene.js`+`VanillaScene.tsx`+`embed-example.html` 출력. 실제 headless Chrome에서 외부 HTML을 열어 custom element 등록·shadow-DOM iframe·프레임 안 장면 텍스트까지 확인(T5.10 완료 판정)
- `video` MP4: **환경 차단으로 미실행** → T7.2 이월. 근거: S1 PoC에서 동일 조건(15초·1080p·450프레임) 두 번 렌더 바이트 동일 입증済, T5.8에서 png-sequence 20프레임 차이 0 입증済. 인코더 단계 결정성은 입증됐으므로 데모 게이트로 삼지 않는다
- `pnpm lint`·`typecheck` 통과, `pnpm test` 전부 통과(데모용 임시 파일은 삭제 후 재검증)
- **수동 확인 필요**(자동화 불가·범위 밖): PowerPoint에서 편집 PPTX 텍스트 편집·겹침 확인, 깨끗한 Windows VM 설치·실행(T7.2)

## 결정·문제·해결

- `vanilla-export.mjs` 미연결 확인(X2 인계): `resources/workers/`에는 `vite-runner.mjs`+`vendor/`만 있고 번들이 없다. Rust `export_commands.rs`는 `vanilla-export.mjs`를 기대하므로 번들 연결은 릴리스(웨이브 7) 작업이다. T5.11 데모는 워커 함수 직접 실행으로 수행했다
- video 차단 상세(5회 시도, 설정 변경 포함): workers:2는 브라우저 2개가 뜨고 네비게이션 없이 stall(3/3). workers:1 GPU 경로로 12/30프레임까지 진행 후 `ERR_NETWORK_CHANGED`로 중단(1회). 이후 workers:1 GPU·SwiftShader·1초 클립·protocol-timeout 단축 모두 frame 0 stall. 동일 픽스처·핸드셰이크로 한 번은 진행됐으므로 코드가 아니라 호스트 상태(병렬 브라우저·localhost) 문제로 판단하고 추가 파싱을 중단했다
- 다음 레인 인계(본 레인에서 고치지 않음, 웨이브 7 예정)
  - `slidesEditable.ts` `exportSlideHtml`: `page.evaluate(함수 문자열, ...args)`는 puppeteer가 실행하지 않고 함수 객체(`{}`)를 돌려줘 항상 `no PPTX bytes`로 실패한다. 프로브에서 IIFE 래핑+JSON 인자로 21KB 정상 덱을 확인했으니 같은 방식으로 고치면 된다(소유: 레인 X2)
  - `runViteBuild`·Rust `run_export`는 `cwd=projectDir`를 지정하지 않아 vite가 호출 프로세스의 cwd를 루트로 삼는다. 워커에 `--root` 전달 또는 스폰 cwd 지정을 하면 된다
- Pitfalls
  - 데모용 임시 테스트(`m5demo.test.ts`)는 저장소 오염을 막으려고 수행 후 삭제했다. 데모 재현이 필요하면 TEMP 기록을 보고 다시 만든다
  - `vitest run --reporter=basic`은 vitest 5에 없어 러너 자체가 뜬다. 기본 리포터를 쓴다
  - PowerShell에 `tail`·`Select-Object -String`이 없다. `Select-Object -Last N`·`Select-String`을 쓴다
  - BtbN FFmpeg는 `ffmpeg-n8.1-latest-win64-gpl-8.1.zip`(약 193MB, libx264 포함)을 썼다. 앱 데이터의 기존 다운로드는 `.part`(미완)뿐이라 데모용으로 TEMP에 받았다

## 남은 일(M5 이후로 이월)

- T7.2 깨끗한 VM에서: 샘플 export 전 형식 + PowerPoint 편집 PPTX 확인 + MP4 렌더(본 레인 차단 건)
- `vanilla-export.mjs` 번들 연결(릴리스)
- HyperFrames `--workers` 수·GPU 경로 재검증(릴리스 하드웨어·CI `--no-browser-gpu` 기준)
- `slidesEditable.ts` evaluate 수정 + `cwd=projectDir` 수정(웨이브 7)

## Connections

[[implementation-plan]] · [[parallel-execution]] · [[technical-design]] · [[ExportPipeline]] · [[poc-s1]] · [[poc-s2]] · [[DomToPptx]] · [[HyperFrames]] · [[milestone-m2]]
