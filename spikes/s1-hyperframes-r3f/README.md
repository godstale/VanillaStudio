# S1 — HyperFrames로 React + R3F 장면을 MP4 렌더

PoC 결과: `wiki/sources/poc-s1.md`

## 구성

- `index.html`: 컴포지션 루트(`data-composition-id`, `data-duration`, `data-fps`, `data-no-timeline`)
- `src/clock.ts`: `@vanilla/runtime` 시계의 최소 대역. `hf-seek` → `waitUntil(sceneReady.then(setTime))`
- `src/Scene.tsx`: DOM 오버레이 + R3F(`frameloop="never"`) 토러스 매듭·시드 파티클·카메라 궤도
- `scripts/render-twice.mjs`: MP4 2회 렌더 → 디코딩 프레임 MD5 비교, 대표 프레임 PNG 추출
- `scripts/png-twice.mjs`: PNG 시퀀스 2회 렌더 → 원본 캡처 해시 비교(인코더 영향 배제)

## 실행

```powershell
pnpm install --ignore-workspace
pnpm build
# FFmpeg: libx264가 있는 빌드 필요(아래 참고). PATH를 바꾸지 않고 환경 변수로 지정
$env:HYPERFRAMES_FFMPEG_PATH = "<ffmpeg.exe>"
$env:HYPERFRAMES_FFPROBE_PATH = "<ffprobe.exe>"
node scripts/render-twice.mjs
node scripts/png-twice.mjs
```

재현에 쓴 FFmpeg: BtbN `ffmpeg-n8.1-latest-win64-gpl-8.1.zip`(`.tools/`에 받아 둠, git 제외).
`DO_NOT_TRACK=1`, `HYPERFRAMES_SKIP_SKILLS=1`로 텔레메트리와 스킬 확인을 끈다.
