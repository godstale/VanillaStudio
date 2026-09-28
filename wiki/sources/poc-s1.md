---
title: 'PoC S1: HyperFrames로 React + R3F 장면 MP4 렌더'
type: source
tags: [poc, phase-p3, rendering, video]
date: 2026-09-29
source_file: spikes/s1-hyperframes-r3f/README.md
sources: [feasibility-risks, technical-design]
last_updated: 2026-09-29
---

## Summary

**결론: 통과.** Vite로 빌드한 React + R3F 장면을 HyperFrames 0.8.82로 15초·30fps·1080p MP4로 렌더했다. 같은 조건에서 두 번 렌더한 MP4가 **바이트 단위로 동일**했다(450프레임). 렌더 시간은 약 18초(6워커, Ryzen 9 7900X)다. 연결 방식은 `hf-seek` 이벤트를 받아 시각을 주입하는 런타임 시계이며, 기술 설계서의 `render` 모드 가정이 맞았다.

## 목표와 성공 기준

| 기준 | 결과 |
| --- | --- |
| 15초·30fps·1080p 렌더 | ✅ H.264, 1920×1080, 30/1, 450프레임, 10.3MB |
| 두 번 렌더한 프레임이 동일 | ✅ MP4 바이트 동일, PNG 시퀀스 4회 렌더에서 차이 0프레임 |
| 소요 시간 기록 | ✅ MP4 약 18초, PNG 시퀀스 약 31초 |

## 방법

- 코드: `spikes/s1-hyperframes-r3f/`(브랜치 `spike/s1-hyperframes-r3f`)
- 컴포지션: `index.html` 루트 div에 `data-composition-id="main" data-duration="15" data-fps="30" data-width/height`를 둔다. React는 그 안에 마운트한다.
- 시계(`src/clock.ts`):
  - HyperFrames 런타임은 프레임마다 `window`에 `hf-seek` CustomEvent(`detail: { time, waitUntil }`)를 보낸다. `waitUntil`은 리스너 안에서 **동기로** 호출해야 한다.
  - 처리 순서: `setTime(t)` → React DOM은 `flushSync`로 즉시 커밋 → R3F는 `frameloop="never"` + `advance(t*1000)`로 WebGL을 동기 렌더한다.
  - 애니메이션은 `useFrame` 안에서도 delta 대신 주입된 `getTime()`만 읽는다. 파티클은 시드 PRNG(mulberry32)를 쓴다.
- 비교: MP4는 `ffmpeg -f framemd5`로 디코딩 프레임 해시를 비교했다. 인코더 영향을 배제하려고 `--format png-sequence` 원본 PNG의 sha1도 비교했다.

## 발견한 문제와 해결 (Pitfalls)

1. **타임라인 대기 45초**
   - 증상: `window.__timelines[id]`를 등록하지 않는 컴포지션은 HyperFrames가 서브 타임라인 준비를 45초 기다린다. 렌더 시간이 109초였다.
   - 해결: 루트에 `data-no-timeline`을 붙이면 대기를 건너뛴다(109초 → 18초).
2. **워커 첫 프레임 경쟁 조건**
   - 증상: 대기를 없애자 PNG 450장 중 2장(300, 375번)이 렌더마다 달랐다. 두 번호 모두 6개 병렬 워커가 맡은 구간의 첫 프레임(75의 배수)이다.
   - 원인: R3F Canvas는 크기를 잰 뒤 비동기로 렌더러를 만든다. 새 워커의 첫 `hf-seek` 시점에는 그릴 대상이 아직 없다.
   - 파급: 이 한 프레임 차이가 H.264의 프레임 간 참조 때문에 뒤로 번져, MP4에서는 56번 이후가 모두 달라 보였다.
   - 해결: `sceneReady = Canvas onCreated + document.fonts.ready`를 만들고, `waitUntil(sceneReady.then(() => setTime(t)))`로 바꿨다. 이후 차이 0프레임이다.
   - **런타임 설계 반영**: 텍스처·HDRI·폰트 등 에셋 로딩도 이 준비 약속에 포함해야 한다. 참고로 HyperFrames에는 `window.__hf.buildReady`(Promise 맵)라는 준비 신호 구조도 있다.
3. **오래된 FFmpeg**
   - 증상: 시스템 PATH의 FFmpeg(N-55702, 약 2013년)는 `-colorspace bt709`를 몰라 인코딩 단계에서 실패했다.
   - 해결: HyperFrames는 `HYPERFRAMES_FFMPEG_PATH`, `HYPERFRAMES_FFPROBE_PATH` 환경 변수로 경로를 받는다. 앱이 관리하는 FFmpeg를 PATH를 건드리지 않고 넘길 수 있다.
4. **H.264에는 libx264(GPL) 필요**
   - HyperFrames의 MP4 인코딩은 `libx264`를 쓰고, macOS에서만 VideoToolbox로 대체된다. 코드에 "This FFmpeg build has neither libx264 nor VideoToolbox H.264 encoding" 오류가 있다.
   - Windows에서는 **GPL 빌드**가 필요하다. LGPL 빌드로는 WebM(libvpx)만 가능하다.
   - 확인한 빌드: BtbN `ffmpeg-n8.1-latest-win64-gpl-8.1.zip`, 184MB, 다운로드 22초. `libx264`·`h264_mf`·`h264_nvenc`·`h264_amf`·`libvpx-vp9`가 들어 있다.
5. **GPU와 소프트웨어 렌더의 결과 차이**
   - 같은 PC에서 GPU 렌더(기본 auto)끼리는 동일하다.
   - `--no-browser-gpu`(SwiftShader) 결과는 GPU 결과와 다르다(20.2초).
   - 따라서 골든 테스트(결정성 회귀)는 렌더러를 고정해야 한다. CI처럼 GPU가 없는 환경이면 `--no-browser-gpu` 기준으로 만든다.

## 기타 관찰

- 렌더용 Chrome은 puppeteer 캐시의 `chrome-headless-shell`(152)을 자동으로 썼다. 시스템 Chrome·Edge는 쓰지 않았다.
- 워커 6개에서 "V8 heap 4GB → 워커 4개 권장" 경고가 났다. 앱은 `--workers`를 메모리에 맞춰 지정해야 한다.
- 텔레메트리는 `DO_NOT_TRACK=1`로 껐다. `hyperframes telemetry disable`로 전역 설정도 가능하다. init은 GitHub에서 스킬을 확인하므로 `HYPERFRAMES_SKIP_SKILLS=1`로 끈다. 앱의 export 워커는 이 두 환경 변수를 항상 설정한다.
- `--variables`/`data-composition-variables`: HyperFrames 자체 파라미터 주입 기능이다. 우리 `params/*.values.json`을 넘길 대체 경로로 쓸 수 있다.

## 설계 반영

- 기술 설계서:
  - §4.1 `render` 모드 ⚠️를 해소했다(`hf-seek` + `waitUntil` + 준비 약속).
  - §2.4의 Chrome 항목은 HyperFrames가 관리하는 headless shell로 확정했다.
  - §7에 `data-no-timeline`과 FFmpeg 환경 변수를 추가했다.
- 리스크 문서 §2.9: FFmpeg 행을 "MP4에는 GPL 빌드 필요, 사용자 동의 후 다운로드, 앱 번들 금지"로 갱신했다.
- S6(Doctor)에서 "앱이 FFmpeg GPL 빌드를 받아 환경 변수로 넘기는 흐름"을 이어서 검증한다.

## Connections

- [[HyperFrames]], [[DeterministicRendering]], [[SceneRuntimeContract]], [[ExportPipeline]], [[feasibility-risks]], [[technical-design]]
