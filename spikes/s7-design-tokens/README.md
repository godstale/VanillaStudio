# S7 — DESIGN.md 토큰 파이프라인 + 팔레트 교체

PoC 결과: `wiki/sources/poc-s7.md`

## 구성

- `src/design/`: 앱의 `src/lib/design`과 런타임이 공유할 라이브러리 초안
  - `frontmatter.ts`: front matter와 본문 분리(바이트 오프셋 보존, CRLF 지원)
  - `parse.ts`: YAML 파싱, 관대한 zod 스키마, `{a.b}` 참조 해석(끊긴 참조·순환 참조 검출), 역할 파생
  - `rewrite.ts`: `colors` 블록만 교체. 선택하면 본문에 적힌 이전 hex도 갱신한다. front matter가 없으면 새로 추가
  - `roles.ts`: 핵심 역할 4개 + 파생 역할 5개(대비 보장), 대비 검사 쌍
  - `hyperframes.ts`: HyperFrames 팔레트 → Vanilla 역할 매핑(밝기·scheme 기준)
  - `vite-plugin.ts`: `virtual:vanilla/design` 가상 모듈 + DESIGN.md HMR
- `src/runtime/design.tsx`: `DesignProvider`(CSS 변수 `--color-*`·`--spacing-*`·`--rounded-*` 주입, Bridge override), `useDesign()`
- `src/Scene.tsx`: 토큰만 쓰는 예제 장면(DOM + R3F)
- `host.html`: Bridge host 하네스, `scripts/measure.mjs`: puppeteer 측정
- `refs/`: HyperFrames `DESIGN.md`(Apache-2.0). 프리셋·팔레트 추출본 `hyperframes-presets.json`은 git에서 제외했다(사이트 데이터, 재배포 금지 — D-017). 재생성: 사이트 번들을 받아 `python scripts/extract-hf-presets.py <chunk.js> refs/hyperframes-presets.json`

## 실행

```powershell
pnpm install --ignore-workspace
pnpm test                      # 단위 테스트
node scripts/measure.mjs       # 결과: out/measure.json, out/*.png, out/hf-palettes-report.json
node node_modules/@google/design.md/dist/index.js lint DESIGN.md   # stdin을 닫아야 함(bash: < /dev/null)
```
