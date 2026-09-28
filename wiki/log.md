# Wiki Log (append-only)

> 형식: `## [YYYY-MM-DD] <type> | <title>` + 한두 줄. type: ingest · decision · phase · research · poc · milestone · lint · update

## [2026-09-28] phase | P0 준비 확인
- 템플릿 원본을 git 기준 커밋(master 65272b8)으로 보존, `docs/planning` 브랜치 생성. → [[phase-p0-setup]]

## [2026-09-28] ingest | 요구사항 원본
- `Docs/Vanilla-Studio-Requirements.txt` → [[vanilla-studio-requirements]], 원본 `wiki/originals/`에 보관.

## [2026-09-28] research | 에이전트 연동·렌더·PPT·라이선스
- ACP·HyperFrames·Remotion·GSAP·dom-to-pptx·AGY 조사. → [[research-2026-09-28-agents-rendering]]

## [2026-09-28] decision | D-001~D-010 Accepted (인터뷰 3라운드)
- ACP+터미널, MVP 4유형, PPT 이중 방식, HyperFrames, Windows+Doctor, 오픈 라이선스 에셋, 파라미터+스크러버, Agent Skill 템플릿, 폴더=프로젝트, 파일 자동·셸 확인. → [[decisions]]

## [2026-09-28] decision | D-011~D-014 Proposed
- 공통 Scene 런타임, 앱 소유 프로세스 분리, git 체크포인트, 에이전트용 MCP 도구. 사용자 확인 대기.

## [2026-09-28] ingest | 기획 문서 4종
- [[product-spec]], [[technical-design]], [[feasibility-risks]], [[decisions]]

## [2026-09-28] phase | P2 상세 기획 완료
- 플레이북(`Docs/Playbook/`), AGENTS.md 갱신, wiki 구축. → [[phase-p2-planning]]

## [2026-09-28] lint | Wiki health check
- 33 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-28] update | P0 기준선 검증
- Node 22.13 / pnpm 10.32 / rustc 1.97. lint·typecheck·test(10) 통과. → [[phase-p0-setup]]

## [2026-09-29] research | DESIGN.md·HyperFrames 프리셋·카탈로그
- 사용자 지정 링크 2건 보관 + DESIGN.md 형식 조사. → [[research-2026-09-29-design-md-hyperframes]]

## [2026-09-29] decision | D-015·D-016 Accepted, D-017 Proposed
- 프로젝트 DESIGN.md 표준, 컬러 팔레트 = 색 역할 토큰 교체, HyperFrames 자료는 참고용. → [[decisions]]

## [2026-09-29] update | 기획 문서 v0.2 (디자인 시스템·팔레트)
- Product-Spec §8·§5.7, Technical-Design §4.4, Feasibility-Risks §2.10·S7, AGENTS.md §4-6. → [[DesignMd]], [[ColorPalette]], [[phase-p2-planning]]

## [2026-09-29] lint | Wiki health check
- 36 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] decision | D-011~D-014·D-017 Accepted
- D-011 범위 수정(시간 함수 계약은 영상·이미지 계열만), D-014 MVP 필수. 기획서·설계서 v0.3. → [[decisions]], [[SceneRuntimeContract]]

## [2026-09-29] lint | Wiki health check
- 36 pages, orphans 0, broken links 0. → `wiki/lint-report.md`

## [2026-09-29] phase | P3 구현 계획 시작
- 기획 브랜치를 master에 병합·origin 푸시 후 PoC 착수. → [[DevelopmentPhases]]

## [2026-09-29] poc | S1 HyperFrames + React/R3F 렌더 통과
- MP4 2회 렌더 바이트 동일(450프레임, 약 18초). 워커 첫 프레임 경쟁 조건 해결, FFmpeg GPL 빌드 필요. → [[poc-s1]]

## [2026-09-29] lint | Wiki health check
- 37 pages, orphans 0, broken links 0. → `wiki/lint-report.md`
