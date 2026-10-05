# 병렬 실행 가이드 v2 (여러 에이전트 세션으로 구현하기)

- 문서 버전: v2.0 (2026-10-05) — v1 가이드는 `legacy/Parallel-Execution-v1.md`
- 작업 원본: `Docs/Planning/TODO.md`(항목 ID `T<마일스톤>.<번호>`) · 계획: `Implementation-Plan.md`
- 이 문서의 "레인 상태"는 **조정 세션**(사용자 또는 사용자가 지정한 메인 세션)만 갱신한다.

## 1. 규칙 (AGENTS.md §6 + v2 보강)

- 병렬 작업은 `git worktree add ../VanillaStudio-<topic> -b feat/<topic> <마일스톤 브랜치>`로 만들고, 끝나면 `git worktree remove`.
- **같은 브랜치에서 2개 이상의 세션이 동시에 작업하지 않는다.** 레인마다 워크트리·브랜치를 따로 쓰고, 조정 세션이 마일스톤 브랜치로 병합한다.
- 항목의 `[레인 X · Wn]` 태그: X = 담당 레인, n = 웨이브(같은 웨이브 안의 레인은 병렬, 웨이브 순서는 선행 관계).
- 공유 파일(아래 §3)은 소유 레인만 수정한다. 다른 레인은 소유 레인에 요청하거나, 조정 세션이 병합 시 통합한다.

## 2. 레인과 소유 경로

| 레인 | 성격 | 소유 경로 |
| --- | --- | --- |
| A | 캔버스·노드·인스펙터·UI | `src/components/{canvas,scene,inspector,guides,playground}/`, `src/pages/Settings/*` |
| B | Rust 명령·프로세스·인프라 | `src-tauri/src/**`, `resources/workers/` |
| C | 스키마·가이드 엔진·시퀀스 로직 | `src/lib/{scene,sequence,guides,json,workspace,package,migrate}/` |
| D | 런타임·디자인 | `packages/runtime/**`, `src/lib/design/**` |
| E | 콘텐츠(가이드 규칙·용어집·샘플) | `resources/guides/**`, `resources/glossary/**`, `resources/samples/**` |
| 단독 | 마일스톤 시작/마무리·PoC·통합 | 조정 세션 |

## 3. 공유 파일 (소유 레인 외 직접 수정 금지)

| 파일 | 소유 | 비고 |
| --- | --- | --- |
| `src/lib/i18n/dictionaries/{ko,en}.ts` | 조정 세션 | 레인은 키 목록을 완료 보고에 적어 전달. 충돌 시 조정 세션이 병합 |
| `package.json`·`pnpm-lock.yaml`·`Cargo.toml`·`tauri.conf.json` | 조정 세션 | 새 의존성은 라이선스 확인 후 `Feasibility-Risks.md` §2.9 기록 |
| `src/lib/db/migrations/*` | 레인 C | 번호 충돌 방지: 조정 세션이 번호 배정 |
| `Docs/Planning/*`·`wiki/*` | 조정 세션 | 레인은 보고만 |
| 데이터 계약(zod 스키마·Bridge) | 소유 레인 + 설계서 갱신 | AGENTS.md §4-5 |

## 4. 웨이브 배치 (마일스톤 요약)

| 마일스톤 | W1 | W2 | W3+ |
| --- | --- | --- | --- |
| V1 | A: T1.1(R-5) · B: T1.2 · C: T1.5, T1.6 | B: T1.3, T1.4 · C: T1.7~T1.9 · D: T1.10 · A: T1.13 | D: T1.11, T1.12 → 마무리 T1.14 |
| V2 | A: T2.1 · B: T2.2 · C: T2.5 | A: T2.3, T2.4 · B: T2.10 · C: T2.6~T2.8 | A: T2.11, T2.12 · C: T2.9 → 마무리 |
| V3 | A: T3.1, T3.2 · B: T3.3 · E: T3.5, T3.7 | A: T3.4 · E: T3.9 | A: T3.6, T3.8, T3.10, T3.13 · D: T3.11 · B: T3.12, T3.14 |
| V4 | A: T4.1 · B: T4.2 · D: T4.6 | A: T4.3, T4.4 · C: T4.5 · B: T4.7 | B: T4.8 · D: T4.9 · A: T4.10 → T4.11 |
| V5 | A: T5.1 · B: T5.2 | C: T5.3 · D: T5.4 | A: T5.5 · C: T5.6 → T5.7 |
| V6 | (W0) T6.0 → A: T6.1 | B: T6.2 · C: T6.3 · A: T6.5 | B: T6.6 · C: T6.4, T6.7 → T6.8 |
| V7 | A: T7.1 | A: T7.2 · B: T7.3 · C: T7.4 | D: T7.5 · E: T7.6 · B: T7.7 → T7.8 |

## 5. 세션 시작 프롬프트 (레인 세션용)

```
너는 Vanilla Studio v2 구현의 레인 <X> 세션이다. 아래를 지켜라.
1. AGENTS.md, Docs/Planning/Refactor-Spec-v2.md, Technical-Design.md, TODO.md의 담당 항목(<T..., T...>)을 읽는다.
2. 워크트리 `../VanillaStudio-<topic>`(브랜치 feat/<topic>)에서만 작업한다. 소유 경로 밖과 공유 파일은 수정하지 않는다.
3. 항목마다 완료 판정을 충족하고 pnpm lint·typecheck·test(Rust 변경 시 cargo test)를 통과시킨 뒤 논리 단위로 커밋한다. push 금지.
4. 설계와 다르게 구현해야 하면 멈추고 보고한다.
5. 완료 시 아래 보고 형식으로 답한다.
```

## 6. 완료 보고 형식

```
레인/항목: <X> / T..., T...
브랜치·커밋: <branch> <hash...>
검증: lint ✓ typecheck ✓ test ✓ (cargo test ✓) — 실패·건너뜀이 있으면 사유
i18n 추가 키: <key 목록>
의존성·계약 변경: <있으면 상세, 없으면 없음>
미해결/인계: <조정 세션이 처리할 것>
```

## 7. 레인 상태 (조정 세션 갱신)

| 레인 | 현재 항목 | 브랜치 | 상태 |
| --- | --- | --- | --- |
| — | V1 시작 전 | — | 대기 |
