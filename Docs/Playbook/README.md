# 개발 플레이북 (Vibe-Coding Playbook)

> **목적**: Vanilla Studio를 Requirements부터 배포까지 만드는 전 과정을 단계별로 정리해,
> **비슷한 앱을 새로 만들 때 그대로 재사용할 수 있는 템플릿**(절차·프롬프트·문서 양식·사용자 체크리스트)으로 남긴다.
> 추후 바이브 코딩 강의 자료의 원천이 된다.

## 구성

| 경로 | 내용 | 재사용 방법 |
| --- | --- | --- |
| `README.md` (이 문서) | 단계 정의: 목표·할 일·입력·산출물·완료 기준·역할 분담 | 새 프로젝트에 그대로 복사 |
| `User-Checklist.md` | 단계별로 **사용자(사람)가 직접 만들거나 결정해야 할 것** | 새 프로젝트 킥오프 시 체크 |
| `prompts/Pn-*.md` | 단계별 핵심 프롬프트: 이번 프로젝트에서 **실제 사용한 원문** + **일반화 템플릿** | `{{변수}}`만 바꿔 사용 |
| `templates/*.md` | 산출물 문서 양식(요구사항·기획서·구현 계획서·결정 기록·단계 로그·AGENTS.md 골격) | 복사 후 채우기 |

진행 기록(무슨 일이 있었는지)은 `wiki/`에, 재사용 가능한 정제 자료(어떻게 하면 되는지)는 이 폴더에 둔다.

---

## 단계 한눈에 보기

| 단계 | 이름 | 핵심 산출물 | 게이트(다음 단계 진입 조건) |
| --- | --- | --- | --- |
| P0 | 준비 (Setup) | 스타터 템플릿, git 저장소, 에이전트 스킬, wiki 골격 | 빌드·린트·테스트가 통과하는 빈 앱 |
| P1 | 요구사항 (Requirements) | `Docs/<App>-Requirements.txt` | 사용자가 "무엇을/왜"를 한 문서로 설명 가능 |
| P2 | 상세 기획 (Planning) | Product Spec, Technical Design, Feasibility & Risks, Decisions, AGENTS.md, Playbook | 핵심 결정 Accepted, 리스크별 PoC 정의 |
| P3 | 구현 계획 (Implementation Plan + TODO) | PoC 결과, 구현 계획서, 마일스톤별 TODO | PoC 통과(또는 대안 확정), TODO가 1~2시간 단위로 쪼개짐 |
| P4 | 구현 (Build) | 마일스톤별 코드·테스트·문서 갱신 | 마일스톤 완료 기준 충족 + lint/typecheck/test 통과 |
| P5 | 검증·수정 루프 (Verify) | 테스트 리포트, 버그 목록, 수정 커밋, 골든 샘플 결과 | 릴리스 체크리스트 전 항목 통과 |
| P6 | 릴리스·배포 (Release) | 인스톨러, 릴리스 노트, CHANGELOG, 태그 | 깨끗한 PC에서 설치·실행 확인 |
| P7 | 회고·템플릿화 (Retrospective) | 단계별 회고, 플레이북·템플릿 갱신 | 다음 프로젝트가 이 폴더만으로 시작 가능 |

---

## 단계 상세

각 단계는 같은 형식: **목표 / 입력 / 할 일 / 산출물 / 완료 기준 / 사용자 역할 / 에이전트 역할 / 기록**.

### P0. 준비 (Setup)

- **목표**: 에이전트가 일관되게 일할 수 있는 작업 환경.
- **입력**: 스타터 템플릿(이 프로젝트: Tauri 2 + React 19 워크스페이스 템플릿), 사용할 에이전트 스킬.
- **할 일**: 템플릿 복제 → `pnpm install` → lint/typecheck/test 확인 → `git init` + 기준 커밋 → 스킬 설치(`.claude/skills`, `.agents/skills`) → `wiki/` 골격 생성.
- **산출물**: 동작하는 빈 앱, 기준 커밋, 스킬, wiki 골격.
- **완료 기준**: `pnpm lint && pnpm typecheck && pnpm test` 통과.
- **사용자**: 템플릿·스킬 선택. **에이전트**: 설치·검증.
- **기록**: `wiki/log.md`에 환경 정보(OS·Node·pnpm·Rust 버전).

### P1. 요구사항 (Requirements)

- **목표**: 앱이 무엇이고 왜 필요한지, 핵심 동작 흐름과 결과물을 사용자의 언어로 기록.
- **입력**: 아이디어, 참고 서비스, 제약.
- **할 일**: 한 줄 정의 → 동작 구조(사용자 흐름) → 최종 결과물 → 주요 기능 영역 → 향후 확장.
- **산출물**: `Docs/<App>-Requirements.txt` (양식: `templates/Requirements-Template.md`).
- **완료 기준**: 처음 보는 사람이 읽고 "누가, 무엇을, 어떤 순서로" 하는지 설명 가능.
- **사용자**: **직접 작성(핵심)**. 에이전트에게 맡기지 않는 것이 좋다 — 제품의 의도가 여기서 결정된다.
- **에이전트**: 빠진 항목 질문, 모호한 표현 지적.
- **기록**: wiki 원본 보관(`wiki/originals/`) + 소스 요약.

### P2. 상세 기획 (Planning) ← 이번 프로젝트 2026-09-28 수행

- **목표**: 요구사항을 **구현 가능한 형태**로 바꾸고 기술 스택을 확정.
- **입력**: 요구사항 문서, 템플릿 아키텍처 문서, 외부 리서치.
- **할 일**:
  1. 요구사항별 구현 난이도·가능성 검토 → 어려운 부분 식별
  2. 외부 리서치(대체 기술·라이선스·성숙도)
  3. **인터뷰**로 결정 사항 확정(선택지 + 권장안 + 트레이드오프 제시)
  4. 상세 기획서(제품), 기술 설계서, 리스크/PoC 계획, 결정 기록 작성
  5. 프로젝트 지침(AGENTS.md) 갱신, 기본 파일 점검
  6. wiki·플레이북 기록
- **산출물**: `Docs/Planning/{Product-Spec, Technical-Design, Feasibility-Risks, Decisions}.md`, `AGENTS.md`, `CLAUDE.md`, `Docs/Playbook/**`, `wiki/**`.
- **완료 기준**: 핵심 결정이 모두 Accepted/Proposed로 기록되고, 불확실한 기술 가정마다 PoC가 정의됨.
- **사용자**: 인터뷰 응답(결정), 기획서 검토·승인. **에이전트**: 분석·리서치·문서화·질문 설계.
- **기록**: 결정은 `Decisions.md` + `wiki/log.md`, 리서치는 `wiki/sources/`, 과정은 `wiki/sources/phase-p2-planning.md`.
- **프롬프트**: `prompts/P2-planning.md`

### P3. 구현 계획 (Implementation Plan + TODO)

- **목표**: 불확실성을 제거(PoC)하고, 에이전트가 바로 실행할 수 있는 작은 작업 단위로 쪼갠다.
- **입력**: P2 산출물.
- **할 일**: PoC(S1~Sn) 수행 → 설계서 ⚠️ 갱신 → 마일스톤 정의 → 마일스톤별 TODO(각 1~2시간, 완료 기준·검증 방법 포함) → 의존성 순서 정리.
- **산출물**: `spikes/**`, `wiki/sources/poc-*.md`, `Docs/Planning/Implementation-Plan.md`, `Docs/Planning/TODO.md` (양식: `templates/Implementation-Plan-Template.md`).
- **완료 기준**: 모든 PoC 결론 기록, TODO 항목마다 "완료 판정 방법"이 있음.
- **사용자**: 마일스톤 우선순위 결정, 대안 선택. **에이전트**: PoC 코드, 계획서 작성.
- **프롬프트**: `prompts/P3-implementation-plan.md`

### P4. 구현 (Build)

- **목표**: 마일스톤 단위로 동작하는 기능을 쌓는다.
- **입력**: 구현 계획서·TODO.
- **할 일**: 마일스톤마다 브랜치 → TODO 순서대로 구현 → 작은 커밋 → 테스트 작성 → 문서(`Docs/`) 동기화 → 마일스톤 데모.
- **산출물**: 코드, 테스트, 갱신된 문서, 마일스톤 데모 스크린샷/영상.
- **완료 기준**: 마일스톤 완료 기준 + `pnpm lint`·`typecheck`·`test` 통과.
- **사용자**: 마일스톤 데모 확인, 방향 수정. **에이전트**: 구현·테스트·문서.
- **기록**: 마일스톤마다 `wiki/sources/milestone-mN.md`(한 일·결정·문제·해결·교훈).
- **프롬프트**: `prompts/P4-build.md`

### P5. 검증·수정 루프 (Verify)

- **목표**: 실제 사용 시나리오에서 품질 확인, 결함 수정.
- **할 일**: 골든 샘플 시나리오 실행 → 버그/개선 목록 → 우선순위 → 수정 → 회귀 테스트. 필요 시 반복.
- **산출물**: `Docs/Verification/Test-Report-<date>.md`, 버그 목록, 수정 커밋.
- **완료 기준**: 릴리스 체크리스트 통과, 치명 버그 0.
- **사용자**: 실제 사용·피드백. **에이전트**: 재현·수정·회귀 테스트.
- **프롬프트**: `prompts/P5-P7-verify-release-retro.md` §P5

### P6. 릴리스·배포 (Release)

- **목표**: 사용자가 설치해 쓸 수 있는 배포본.
- **할 일**: 버전 정하기 → CHANGELOG → `pnpm tauri build` → 코드 서명 → 깨끗한 PC 설치 테스트 → 태그 → 배포 채널 업로드(승인 후) → 자동 업데이트 설정.
- **산출물**: 인스톨러, 릴리스 노트, 태그.
- **완료 기준**: 깨끗한 Windows에서 설치·Doctor 통과·샘플 export 성공.
- **사용자**: 서명 인증서·배포 채널·**push/배포 승인**. **에이전트**: 빌드 스크립트·체크리스트.
- **프롬프트**: `prompts/P5-P7-verify-release-retro.md` §P6

### P7. 회고·템플릿화 (Retrospective)

- **목표**: 이번 경험을 다음 프로젝트의 출발점으로.
- **할 일**: 단계별 회고(잘된 점/문제/교훈) → 프롬프트·양식 일반화 → 사용자 체크리스트 보강 → 강의 목차 초안.
- **산출물**: 갱신된 `Docs/Playbook/**`, `wiki/syntheses/retrospective.md`.
- **프롬프트**: `prompts/P5-P7-verify-release-retro.md` §P7

---

## 단계 운영 규칙 (모든 단계 공통)

1. 단계 시작 시: 이 문서에서 해당 단계를 읽고, `wiki/index.md`에서 관련 지식을 조회한다.
2. 단계 중: 결정은 즉시 `Docs/Planning/Decisions.md`, 새 지식(리서치·PoC·문제 해결)은 wiki에 기록한다.
3. 단계 종료 시: `wiki/sources/phase-<id>-*.md` 단계 로그(양식: `templates/Phase-Log-Template.md`)를 작성하고,
   실제 사용한 핵심 프롬프트 원문을 `prompts/Pn-*.md`의 "실제 사용 원문"에 추가한다.
4. 새로 알게 된 "다른 프로젝트에도 통하는 방법"은 이 폴더의 문서·템플릿에 반영한다.
