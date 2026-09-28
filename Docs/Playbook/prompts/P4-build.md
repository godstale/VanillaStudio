# P4 구현 — 프롬프트

> 상태: 템플릿 초안. 마일스톤 수행 시 실제 사용 원문을 §1에 추가한다.

## 1. 실제 사용 원문

(P4 수행 후 마일스톤별로 기록)

## 2. 일반화 템플릿

### 2.1 마일스톤 시작

```text
Docs/Planning/TODO.md의 마일스톤 {{MILESTONE}}을 시작하라.
- AGENTS.md의 git 규칙대로 master에서 {{BRANCH}} 브랜치를 만든다.
- wiki/index.md에서 관련 지식(결정·PoC·개념)을 먼저 조회하라.
- TODO 순서대로 진행하고, 항목마다 테스트 → 커밋(Conventional Commits) → TODO 체크.
- 설계와 다르게 구현해야 하면 멈추고 이유와 대안을 보고하라.
```

### 2.2 마일스톤 마무리

```text
마일스톤 {{MILESTONE}}을 마무리하라.
1. pnpm lint / typecheck / test 결과를 보고하라.
2. 변경된 구조를 Docs/(Project-Structure, Technical-Design)에 반영하라.
3. wiki/sources/milestone-{{MILESTONE}}.md에 한 일·결정·문제·해결·교훈을 기록하고 index/log를 갱신하라.
4. 이번 마일스톤에서 효과적이었던 프롬프트를 Docs/Playbook/prompts/P4-build.md §1에 추가하라.
5. push는 하지 말고 승인을 요청하라.
```
