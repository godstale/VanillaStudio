# WORK_ORDER.md — LLM_and_Vibe_Coding_Day01_v2 작업 지시서

- Workspace: **LLM_and_Vibe_Coding_Day01_v2** (`ws_e794b37e9b5ff1e5`)
- Status: Initialized (No pending changes or open comments)

> 이 파일은 사용자가 **Vanilla Studio**에서 변경한 시퀀스·신·파라미터·디자인 내역과 신별 코멘트(`scenes/<slug>/comments.json`)를 에이전트가 한눈에 읽고 반영할 수 있도록 기록하는 **통합 작업 지시서**입니다.
> - 상세 구조화 데이터: `.vanilla/work-order.json` 및 `scenes/<slug>/comments.json`
> - CLI 조회: `pnpm vanilla work-order`
> - 반영 완료 처리: `pnpm vanilla resolve <id>` (또는 전체 완료 시 `pnpm vanilla resolve --all`)

## 1. 미해결 사용자 코멘트 (Open Comments)

_(현재 등록된 미해결 코멘트가 없습니다.)_

## 2. 바닐라 스튜디오 UI 변경 내역 (Pending Studio Changes)

_(현재 기록된 미확인 변경 내역이 없습니다.)_

## 3. 에이전트 초기 작업 안내

아직 시퀀스(`sequence.json`)나 신(`scenes/`)이 생성되지 않았다면 다음 순서로 작업을 시작하세요:
1. 사용자의 요청 의도를 바탕으로 `pnpm vanilla templates`를 실행하여 어울리는 **매체 의도(`web`/`image`/`slide`/`motion`)·템플릿·기법·컬러 팔레트·파라미터**를 사용자와 인터뷰하여 구체화합니다.
2. 작업 규모가 크거나 다중 신인 경우, 먼저 `pnpm vanilla scaffold-scene <slug> --name "<이름>" --type <static|motion|3d> --template <id@ver>`로 **러프한 Draft 신과 시퀀스**를 생성해 사용자가 Vanilla Studio에서 흐름을 확인하게 합니다.
3. 사용자가 Vanilla Studio에서 확인 후 남긴 코멘트와 수정 내역이 이 파일(`WORK_ORDER.md`)에 기록되면 세부 연출과 코드를 다듬어 나갑니다.
