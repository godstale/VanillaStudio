# S2 — 특정 시각 스틸 캡처(@2x) + 이미지 PPTX/PDF

PoC 결과: `wiki/sources/poc-s2.md`

## 구성

- `src/main.tsx`: 슬라이드 3장(웹 폰트 Instrument Serif·텍스처 큐브(WebGL)·막대 차트)
  - `?slide=N&t=T`로 슬라이드와 시각을 지정한다.
  - 폰트(`document.fonts.load`)·텍스처·Canvas 생성·2프레임 페인트가 끝나면 `window.__vanillaReady = true`
- `scripts/make-texture.mjs`: 절차적 텍스처 PNG 생성(외부 에셋 없음)
- `scripts/capture.mjs`: `vite preview` + puppeteer-core(`chrome-headless-shell`)로 캡처한다.
  - 슬라이드마다 준비 대기 캡처 2회, 대기 없는 캡처, 폰트 지연(0.8초) 조건의 대기/비대기 캡처를 비교한다.
  - 이어서 `pptxgenjs`로 이미지 PPTX, `pdf-lib`로 PDF를 만든다.
- `scripts/verify-pptx.ps1`: 실제 PowerPoint(COM)로 PPTX를 열어 슬라이드 수·크기·도형·텍스트 프레임을 확인하고, 슬라이드를 PNG로 내보낸다.

## 실행

```powershell
pnpm install --ignore-workspace
node scripts/make-texture.mjs; pnpm build
node scripts/capture.mjs                     # out/capture.json, out/*.png, out/deck-image.pptx, out/deck.pdf
powershell -File scripts/verify-pptx.ps1     # PowerPoint 필요
```
