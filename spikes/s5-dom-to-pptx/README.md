# S5 — dom-to-pptx로 편집 가능한 PPTX

PoC 결과: `wiki/sources/poc-s5.md`

## 구성

- `index.html` + `src/main.js`: 1920×1080 슬라이드 3장
  1. 웹 폰트 제목, 굵게·기울임이 섞인 텍스트, 자간, 대문자 변환
  2. 그라데이션·둥근 모서리·그림자 카드 + 목록
  3. 막대, 인라인 SVG, 이미지, 2D 캔버스, WebGL 캔버스
- `scripts/export.mjs`: Vite + puppeteer-core로 페이지를 연다.
  - `dom-to-pptx` 브라우저 번들을 주입하고 `exportToPptx(slides, { skipDownload: true, width: 13.333, height: 7.5 })`로 변환한다.
  - 변형: `as-is`, `rasterized-canvas`(canvas → img 선변환), `system-font`(웹 폰트 → Georgia)
- `scripts/fix-wrap.mjs`: 후처리. 한 줄짜리 텍스트 상자에 `wrap="none"`
- `scripts/inspect-pptx.ps1`: PowerPoint COM으로 도형 종류·위치(pt)·텍스트·폰트를 JSON으로 뽑고, 슬라이드를 PNG로 내보낸다.

## 실행

```powershell
$env:PUPPETEER_SKIP_DOWNLOAD = 'true'   # dom-to-pptx가 끌어오는 puppeteer의 Chrome 다운로드 방지
pnpm install --ignore-workspace
Copy-Item ../s2-still-pptx/public/texture.png public/
node scripts/export.mjs
node scripts/fix-wrap.mjs out/deck-system-font.pptx out/deck-system-font-nowrap.pptx
powershell -File scripts/inspect-pptx.ps1 -Pptx out/deck-system-font-nowrap.pptx -OutDir out/ppt-system-font-nowrap
```
