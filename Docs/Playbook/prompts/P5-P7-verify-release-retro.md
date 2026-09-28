# P5 검증 · P6 릴리스 · P7 회고 — 프롬프트

> 상태: 템플릿 초안. 각 단계 수행 시 실제 사용 원문을 해당 절에 추가한다.

## P5 검증·수정 루프

### 실제 사용 원문
(P5 수행 후 기록)

### 일반화 템플릿

```text
골든 샘플 시나리오({{SCENARIO_PATH}})를 처음부터 끝까지 실행하고 결과를
Docs/Verification/Test-Report-{{DATE}}.md에 기록하라.
- 각 단계의 기대 결과 vs 실제 결과, 스크린샷 경로, 재현 절차.
- 버그는 심각도(치명/높음/보통/낮음)로 분류하고, 치명·높음부터 수정 브랜치(fix/...)에서 수정하라.
- 수정마다 회귀 테스트를 추가하라.
```

## P6 릴리스·배포

### 실제 사용 원문
(P6 수행 후 기록)

### 일반화 템플릿

```text
버전 {{VERSION}} 릴리스를 준비하라.
1. CHANGELOG.md와 릴리스 노트 초안을 커밋 히스토리에서 작성하라.
2. package.json / tauri.conf.json / Cargo.toml 버전을 맞춰라.
3. pnpm tauri build를 실행하고 산출물 경로·크기를 보고하라.
4. 릴리스 체크리스트(Docs/Verification/Release-Checklist.md)를 채워라.
5. 태그 생성·push·업로드는 내 승인 후에만 하라.
```

## P7 회고·템플릿화

### 실제 사용 원문
(P7 수행 후 기록)

### 일반화 템플릿

```text
wiki/의 단계 로그(phase-*, milestone-*, poc-*)를 종합해 회고를 작성하라.
1. 단계별: 잘된 점 / 문제 / 교훈 / 다음에 바꿀 것 → wiki/syntheses/retrospective.md
2. 다른 프로젝트에도 통하는 절차·프롬프트·양식을 Docs/Playbook/에 일반화해 반영하라({{변수}} 표기).
3. User-Checklist.md에 사람이 해야 했던 일 중 빠진 것을 추가하라.
4. 강의 목차 초안(단계 = 장)을 Docs/Playbook/Lecture-Outline.md로 작성하라.
```
