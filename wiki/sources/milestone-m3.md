---
title: 'Milestone M3: 파이프라인 (Brief→Plan→Prompts→Build)'
type: source
tags: [milestone, phase-p4, m3]
date: 2026-09-30
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, parallel-execution, decisions, technical-design]
last_updated: 2026-09-30
---

## Summary

M3은 Brief → Plan → Prompts → Build 전 경로를 앱에서 진행하게 했다. 웨이브 3(레인 H: 상태 Context·Brief·프리앰블·스키마·뷰어·디자인 탭 + 레인 D/R: design 이관·lint 워커) → 웨이브 4(레인 K: 체크포인트·태스크 그래프) → 웨이브 5(레인 P: Plan 생성·승인·Prompts·실행기)를 `feat/m2-agents`에 `--no-ff`로 병합했다. T3.16 데모는 실제 에이전트 대화 없이 목/스텁으로 전 흐름을 검증했다. main 병합·push는 사용자 승인 대기.

## 한 일

| 레인 | 항목 | 결과 |
| --- | --- | --- |
| H 파이프라인 UI | T3.4·T3.12·T3.1·T3.3·T3.2·T3.8·T3.9 | `plan.json` zod(`design` 필드), `tasks.json`+위상 정렬+순환 검출, PipelineContext·사이드패널, 영문 프리앰블+조립기(스냅샷), Brief 편집기+자료 업로드, 기획서 뷰어(스토리보드·Asset·타임라인·파라미터·디자인 요약), 디자인 탭 |
| D·R | T3.5·T3.7 | `src/lib/design` 이관(S7 테스트 10개), DESIGN.md 공식 CLI lint 워커 |
| K 체크포인트·스킬 | T3.10·T3.15 | git 체크포인트(승인 시 커밋·히스토리, git 없으면 스냅샷), TaskGraph 시각화 |
| P 파이프라인 흐름 | T3.6·T3.13·T3.11·T3.14 | Plan 생성(검증·최대 2회 자동 재요청), Prompts 트리 편집기(CodeMirror)+승인, Plan 승인→체크포인트→다음 단계, 태스크 실행기(자동·한 단계씩·일시정지·재시도·`task_runs`·태스크 후 체크포인트) |
| M 마무리 | T3.16 | 목 기반 Build까지 데모 수행, 본 기록 작성 |

## 검증(최종)

- `pnpm lint`·`typecheck` 통과, `pnpm test` 632테스트 전부 통과
- M3 데모(목/스텁, 실제 에이전트 대화 제외): ① 브리프 입력→`brief/brief.md` 생성(BriefEditor 7테스트) ② Plan 생성 요청→검증→최대 2회 재요청 루프(`planStep.test.ts` 17테스트) ③ 기획서 뷰어 렌더(PlanViewer 9테스트)→승인→체크포인트→다음 단계 활성화 ④ `tasks.json` 생성·트리 편집·승인(PromptsTab 5·promptsFiles 12테스트) ⑤ 3태스크 순차 실행·일시정지·재시도·`task_runs` 기록(runner 14테스트) ⑥ 태스크 그래프 표시(TaskGraph 4테스트) ⑦ 디자인 탭 표시·수정 저장(DesignTab 11테스트)
- **수동 확인 필요**(자동화 불가): 실제 에이전트로 샘플 브리프 1종 Build까지(에이전트가 `DESIGN.md`·`plan.md`·`plan.json` 작성→검증·재요청→승인→`src/` 생성), 승인 시 git 커밋 생성 확인

## 결정·문제·해결

- 새 결정 없음(D-001~D-018 범위 내, [[decisions]] 변경 불필요)
- R2(T4.18) 연계 계약: `update_task_status`가 쓰는 claim 보드 파일을 runner가 읽어 done을 claim으로 처리, `TaskRunRecord` 형식 공유 → [[parallel-execution]] 웨이브 5
- Pitfalls
  - `pipeline.test.tsx` flaky(복원 테스트 타이밍): `holder.api` `waitFor`로 안정화. 비동기 복원 단언은 즉시 assert 금지.
  - X2 병합 잔류 문자 1개(CenterWorkspace): 병합 직후 lint·typecheck·test 재실행으로 검출. 공유 파일 충돌 해결 후 전 검증을 돌린다.
  - wiki 파일 한글 편집은 `write`/`edit` 도구로만 한다. PowerShell 파이프·`Add-Content`는 바이트를 망가뜨린다.

## 남은 일(M3 이후)

- 실제 에이전트 Build 데모 1종(수동, T3.16 잔여): 계획서 M3 데모 ①~④를 사람 확인으로 수행
- M4 마무리(T4.22)·M5 마무리(T5.11)는 각 웨이브 6 레인에서 수행

## Connections

[[implementation-plan]] · [[parallel-execution]] · [[decisions]] · [[technical-design]] · [[ProductionPipeline]] · [[DesignMd]]
