---
title: 'DesignTemplateSkill'
type: concept
tags: [template, skill]
sources: [product-spec]
last_updated: 2026-09-29
---

디자인 템플릿을 Agent Skill 형식으로 만든 것(D-008): `SKILL.md` + `template.json` + **`DESIGN.md`(필수, D-015)** + `frame.md`(선택, video) + `palettes/`(선택) + `references/` + `examples/` + `preview/` + `CREDITS.md`. 템플릿은 **형태**를 담고, 색은 [[ColorPalette]]로 따로 바꾼다. 템플릿의 DESIGN.md가 프로젝트 [[DesignMd]]의 초기본이 된다. 프로젝트 생성 시 `.claude/skills/`와 `.agents/skills/`에 설치해 어떤 에이전트든 인식. 공통 스킬 `vanilla-core`(런타임 계약·파이프라인 규칙·심미 체크리스트)는 항상 설치. 관련: [[ProjectFolderLayout]]

참고 자료(D-017): HyperFrames 프리셋·카탈로그 → [[research-2026-09-29-design-md-hyperframes]]. 코드를 복사하지 않고 런타임으로 재구현한다.

## Discussed In

- [[product-spec]] — §8.3, §8.4
- [[decisions]] — D-008, D-015, D-017
