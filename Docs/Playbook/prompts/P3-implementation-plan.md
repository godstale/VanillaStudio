# P3 구현 계획(+TODO) — 프롬프트

> 상태: 템플릿 초안. P3 수행 시 실제 사용 원문을 §1에 추가한다.

## 1. 실제 사용 원문

(P3 수행 후 기록)

## 2. 일반화 템플릿

### 2.1 PoC 수행

```text
Docs/Planning/Feasibility-Risks.md §3의 PoC {{SPIKE_ID}}를 수행하라.
- 코드는 spikes/{{SPIKE_ID}}-<topic>/ 에 최소한으로 작성한다(앱 코드와 섞지 않는다).
- 성공 기준을 측정 가능한 값으로 확인하고, 실패하면 대안을 시도하기 전에 결과를 보고하라.
- 결과를 wiki/sources/poc-{{SPIKE_ID}}.md에 기록하고, Technical-Design.md의 관련 ⚠️ 항목을 갱신하라.
```

### 2.2 구현 계획서 작성

```text
PoC 결과를 반영해 Docs/Planning/Implementation-Plan.md와 Docs/Planning/TODO.md를 작성하라
(양식: Docs/Playbook/templates/Implementation-Plan-Template.md).
- 마일스톤마다 목표, 완료 기준(데모 가능한 상태), 브랜치명을 정하라.
- TODO는 1~2시간 단위, 각 항목에 [대상 파일], [완료 판정 방법], [선행 항목]을 적어라.
- 기능 명세 ID(F-xxx)와 TODO를 연결해 누락이 없게 하라.
- 결정이 필요한 부분은 인터뷰로 확인하라.
```
