# 02 — 설계서 (Design Flow)

## 서사 구조

먼저 온 미래(바둑·프로그래밍) → 다가올 미래 → **뇌에서 출발한 70년 연대기**(1943 → 2026) → 맺음말(사람의 역할) → 보너스: 생각의 원리.
Scene 5~21은 하단 **연대기 바**에 현재 연도를 표시해 청중이 시간 위치를 잃지 않게 한다.

## 데이터 구조

- `storyboard/data/content.json` — 유일한 문구 원본. `chapters[]`, `scenes[]{key,title,chapter,year,screens[]}`.
  화면(`screen`)은 `layout`(cover·divider·statement·split·cards·compare·timeline·stats·bars·figure·quote·hero·photo·table)과
  그 레이아웃의 필드를 가진다. `build: true`면 `items`가 클릭마다 하나씩 드러난다. `**단어**` = 앰버 강조.
- `storyboard/data/items.json` — 도식 데이터와 라벨(바둑판 37수, 확산 노이즈 시드, 프리필·디코딩 토큰).
- `assets/img/` — 강의자 제공 이미지(ASCII 이름, 큰 이미지는 1920px 이하로 축소).

## 조립 계획

1. `shared/deck/content.ts` — 타입·조회·스텝 계산(`stepsOf`: 화면 1개 = 1스텝, build 화면 = 항목 수만큼)
2. `shared/deck/atoms.tsx` — Rich(강조 파서)·Reveal·Figure(액자 맞춤)·Bullets·Note
3. `shared/deck/diagrams.tsx` — go-board·diffusion·chain·matrix·page-one/many·vector·vector-compare·multihead·prefill·decode
4. `shared/deck/layouts.tsx` — 레이아웃 14종
5. `shared/deck/DeckShell.tsx` — 1920 무대, 헤더·챕터 칩·연대기 바·카운터·키 입력
6. `scenes/<slug>/src/Scene.tsx` — `<DeckShell sceneKey="sNN" />` 한 줄. `node scripts/sync-deck.mjs`가 생성
7. `sequence.json` — 28개 신 선형 연결(`key:ArrowRight`, crossfade 500ms)

진행 규칙: 모든 스텝과 엣지는 `key:ArrowRight`. 단독 실행 시 클릭·Space·PageDown·Enter도 다음, ←·PageUp·Backspace는 이전.

## 신 구성 (강의안 Scene → 화면)

| 신 | 챕터 | 화면(step) |
| --- | --- | --- |
| S1 알파고 쇼크 | 01 먼저 온 미래 | 표지 · 대국 전 여론 · 37수 1/10,000 · 먼저 온 미래(도제식 vs AI) |
| S2 먼저 온 미래 | 01 | 반신반의 → 사용량 급증 · Cursor vs Stack Overflow |
| S3 다가올 미래 | 01 | 8개 산업 카드 · 첫걸음 선언 |
| S4 신경망 | 02 뇌를 닮은 기계 | 챕터 구분 · LLM vs 뇌 · 뉴런과 시냅스 |
| S5 퍼셉트론 | 02 | 1943·1958 연표 · NYT 인용 · XOR · 첫 번째 겨울 |
| S6 역전파와 두 번째 겨울 | 02 | 역전파 · 4가지 장벽(순차) |
| S7 손글씨 인식 신경망 | 03 보고 기억하는 신경망 | 챕터 구분 · 입력/은닉/출력 · MNIST 데모 |
| S8 CNN | 03 | 르쿤·벨 연구소 · CNN 원리 3카드 · LeNet-5 1998 |
| S9 RNN | 03 | 은닉 상태·장기 의존성 · RNN vs LSTM |
| S10 딥 블루 | 04 딥러닝의 부활 | 챕터 구분 · 탐색 기계 |
| S11 부활의 전조 | 04 | 2006~2011 연표(순차) |
| S12 AlexNet | 04 | 오류율 막대 · AlexNet · 구글의 고양이·경매 |
| S13 이미지에서 언어로 | 05 언어와 생성, 그리고 깊이 | 챕터 구분 · Word2Vec · Seq2Seq→Attention→구글 번역(순차) |
| S14 생성형 AI | 05 | GAN · 딥페이크·StyleGAN(순차) |
| S15 거대 신경망 실험 | 05 | 층 수 막대 · ResNet·배치 정규화 |
| S16 알파고 쇼크(딥마인드) | 05 | 딥마인드 연표(순차) · 37수·78수·3일 |
| S17 Attention | 06 트랜스포머와 GPT | 챕터 구분 · 논문 · RNN vs Attention · BERT vs GPT |
| S18 OpenAI | 06 | 2015~2019 연표(순차) |
| S19 LLM과 멀티모달 | 06 | 스케일링(로그 막대) · 알파폴드 · 확산 모델 · 이미지 생성 연표(순차) |
| S20 프런티어 랩 | 07 프런티어 경쟁 | 챕터 구분 · RLHF(순차) · ChatGPT · 2023(순차) · 2024(순차) |
| S21 지능의 폭발 | 07 | 히어로 · 2025(순차) · 2026(순차) |
| S22 맺음말 | 08 | 네팔의 짐꾼(풀블리드 사진) |
| E1~E6 | + 생각의 원리 | 보너스 구분 · 나랏말싸미 · 연상(순차) · 3단계(순차) · 스무고개(순차) · 국왕→여왕→왕자(순차) · 어텐션 헤드 · FFN·레이어 · 프리필 · 디코딩 · 숫자 3개 · 연산 표 · 메모리 표 · 병목 4단계(순차) · 이제 이해가 되시나요? |

합계: 신 28개, 화면 73개, 클릭 147번(순차 등장 포함).
