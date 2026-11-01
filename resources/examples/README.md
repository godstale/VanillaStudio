# 예제 라이브러리 제작 규칙

스타일, 프로젝트 템플릿, 신 가이드, 프리셋, 레시피, 기법, 팔레트 카드에 보여줄 작은 예제를 만듭니다.
폴더를 추가하면 등록 작업 없이 앱 카드에 나타납니다(D-047).

## 만드는 순서

```bash
pnpm examples new style cyberpunk            # 정지 예제. 움직이면 --motion 추가
# resources/examples/style/cyberpunk/ 의 example.html, example.json 작성
pnpm examples capture style/cyberpunk        # preview.webp 생성(HTML을 고칠 때마다 다시 실행)
pnpm examples check                          # 전체 규칙 검사
```

## 폴더 구조

```text
resources/examples/<kind>/<id>/
  example.html   직접 작성. 1280×720 단일 파일
  example.json   직접 작성. seconds, note{ko,en}
  preview.webp   도구가 생성. 직접 만들지 않음
```

- `kind`: `style`, `template`, `guide`, `preset`, `recipe`, `technique`, `palette`
- `id`: `Docs/Planning/Examples-Backlog.md`에 적힌 값을 그대로 씁니다. 폴더 이름을 임의로 바꾸지 않습니다.
- `seconds`: 정지 예제는 `0`, 움직이는 예제는 `1`~`12`. 움직이는 예제는 8프레임 필름스트립으로 캡처합니다.
- `note`: 이 예제에서 무엇을 봐야 하는지 ko/en 한 문장씩 씁니다.

## 예제 규칙

**한 예제는 한 가지만 보여줍니다.** 해당 항목의 특징이 썸네일 크기(480×270)에서도 바로 보여야 합니다. 작은 글자에 의존하지 않습니다.

- **작성 수단:** HTML, CSS, 인라인 SVG, canvas, 직접 작성한 WebGL만 씁니다. 파일 크기는 32KB 이하입니다.
- **외부 리소스 금지:** 외부 URL, 외부 스크립트, 웹폰트, `<img>` 파일, 영상, 오디오를 쓰지 않습니다. 필요한 그림은 코드로 그립니다.
- **결정성:** 움직임은 `window.seekExample(t)`의 순수 함수이거나 CSS `@keyframes`입니다. `Math.random`, `Date.now`, `new Date`, `performance.now`는 금지입니다. 무작위가 필요하면 고정 시드의 작은 함수를 파일 안에 씁니다.
- **자동 재생:** `seekExample`을 쓸 때는 `_starter/motion.html`의 재생 루프를 그대로 둡니다.
- **GSAP 금지:** D-007.
- **생성형 AI 이미지 금지:** D-006. 모든 시각 요소는 코드입니다.
- **저작권:** 기존 캐릭터, 로고, 상품 형태, 특정 작가의 고유 작품을 재현하지 않습니다. `ipSensitive` 스타일은 일반적인 조형 특징만 씁니다.
- **문구:** 짧은 중립 문구만 씁니다. 실제 회사, 제품, 인물 이름을 쓰지 않습니다.
- **이름 표기:** 예제 안에 항목 이름이나 설명을 넣지 않습니다. 이름은 카드가 보여줍니다.

## 종류별 기준

| 종류 | 보여줄 내용 | 시간 |
| --- | --- | --- |
| `style` | 백로그의 예시 문장을 하나의 주제로 구현. 해당 family의 `technique`를 따름 | 대개 정지. `sceneTypes`가 motion, 3d뿐인 family는 움직임 |
| `template` | 슬롯 순서와 비율이 보이는 축약 시퀀스(`template/product-launch` 참고) | 6~10초 |
| `guide` | 그 가이드로 만들 수 있는 대표 결과물 축소판 | static은 정지, motion·3d는 4~8초 |
| `preset` | 프리셋 한 가지 효과 | 2~6초 |
| `recipe` | 레시피 결과의 핵심 장면을 새로 구성. 원작을 복제하지 않음 | 대개 4~8초 |
| `technique` | 기법 한 가지를 가장 단순한 형태로 시연 | 움직임 기법은 2~4초 |
| `palette` | 같은 레이아웃에 팔레트 색만 교체(`palette/blush-ledger` 참고). 색은 파일의 `colors` 값 | 정지 |

참고 예제: `style/popart`(정지), `style/neonlight`(움직임), `template/product-launch`, `palette/blush-ledger`.

## 품질 확인

1. `pnpm examples capture` 뒤 `preview.webp`를 직접 엽니다.
2. 잘리거나 겹친 요소, 빈 화면, 읽히지 않는 대비가 없는지 봅니다.
3. 움직이는 예제는 8프레임이 눈에 띄게 달라야 합니다. 프레임이 거의 같거나 같은 시각의 결과가 다르면 `capture`가 실패합니다.

## 병렬 작업 규칙

- 한 에이전트는 백로그의 배치(`E01` 등) 하나를 맡고, 자기 배치의 `resources/examples/<kind>/<id>/`만 수정합니다.
- 앱 코드, 카탈로그 JSON, 다른 배치의 폴더, `Docs/Planning/Examples-Backlog.md`는 수정하지 않습니다.
- 백로그와 TODO 갱신은 병합 담당이 `pnpm examples backlog`로 합니다.
- 카탈로그 내용이 예제로 표현하기 어려우면 내용을 고치지 말고 완료 보고에 적습니다.

### 에이전트 시작 프롬프트

```text
resources/examples/README.md를 읽고 그대로 따르세요.
Docs/Planning/Examples-Backlog.md의 배치 {{E01}}에서 체크되지 않은 항목의 예제를 모두 만드세요.
참고 예제 4종을 먼저 읽고, 항목마다 capture 후 preview.webp를 직접 확인하세요.
마지막에 pnpm examples check를 통과시키고, 만든 항목과 건너뛴 항목을 이유와 함께 보고하세요.
```
