---
title: '수업 배포 zip 설치 실패 (pnpm v11 minimumReleaseAge)'
type: source
tags: [distribution, pnpm, supply-chain, bugfix]
sources: [resources/workspace-template/scripts/pack-workspace.mjs, resources/workspace-template/pnpm-workspace.yaml]
last_updated: 2026-10-22
---

# 수업 배포 zip 설치·실행 실패 (D-041·D-042)

`tests/LLM_and_Vibe_Coding_Day02_v2`를 폴더째 압축해 다른 PC에서 `pnpm install`했더니
`[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION]`으로 실패했다.
`caniuse-lite@1.0.30001818`(2026-10-21T10:34:59Z 발행, `browserslist` 경유 전이 의존성)이
컷오프(2026-10-21T07:48:22Z) 안에 있었다. 네트워크 경고(`GET registry.npmjs.org error`)도 겹쳤다.

## 원인 4가지

1. **pnpm v11 기본 24시간 게이트**: `minimumReleaseAge` 기본값 `1440`(분) —
   발행 24시간 이내 버전의 해결을 거부한다. `caniuse-lite`는 수일 간격으로 갱신되는 DB라
   새로 `pnpm install`하면 상시 노출된다. 배포 PC(pnpm 10, 무검사)로 만든 lock이 신선 버전을
   물고 있었고, 받는 PC(pnpm 11)가 거부했다. (`pnpm` 공식 문서: `pnpm.io/supply-chain-security`)
2. **잘못된 압축**: `node_modules/`·`dist/`·`.vanilla/`를 포함한 채 압축했다
   (템플릿 `.gitignore` 위반). 용량·PC별 꼬임의 원인.
3. **`pnpm pack` 섀도잉**(D-042): 템플릿에 `"pack"` 스크립트를 둬도 `pnpm pack`은 pnpm **내장**
   tarball 명령이라 스크립트를 가리고, 결과물은 `package/` 고정 tarball이라 요구(산출물명
   최상위 폴더)와 달랐다. 스크립트명을 `dist`로 개명했다(내장 충돌 없음 확인).
4. **한글 경로에서 Node 모듈 로더 세그폴트**(D-042, exit 3221225477):
   `C:\Workspace\강의\...`에서 `pnpm play`가 죽는다. 이분 결과 —
   한글 포함 경로의 파일을 `require`·`import`하면 Node 22.13.0 자체가 세그폴트한다
   (사소한 1줄 파일·절대경로·파일 경유 인자 모두 재현). `fs` 읽기·`vm` 컴파일·자식 프로세스
   spawn·esbuild.exe 직접 실행은 모두 정상이라, esbuild·Vite 문제가 아닌 환경/상류 문제다.
   코드 우회 불가 → 영문 경로 + 사전 가드가 답이다.

## 수정 (D-041, D-042, [[decisions]])

- 템플릿에 `pnpm-workspace.yaml`(`minimumReleaseAge: 0`) 추가 — 받는 쪽 무개입 설치가 우선.
  직접 의존성 영향 없음. `open_workspace`가 기존 폴더에도 비파괴 보충한다.
- `pnpm dist`(`scripts/pack-workspace.mjs`, Node 내장만·Win/Mac/Linux): 제외 목록 적용,
  `pnpm-lock.yaml` 포함, 정책 파일 미존재 시 자동 생성. 미니 zip 라이터 내장
  (`node:zlib` deflate, 의존성 없음). zip 최상위 폴더는 `package.json` `name`.
  `pnpm pack`은 pnpm 내장 tarball 명령(`package/` 고정)이라 스크립트명을 `dist`로 했다.
- 받는 쪽 순서 고정: **영문 경로에** 압축 풀기(한글 경로에서는 Node/Vite가 exit 3221225477로
  죽는다) → `pnpm install` → `pnpm dev`. 템플릿 스크립트(`dev`·`play`·`preview`·`build`·
  `check:scene`·`vanilla`)는 `guard:path`(파일 로드 없는 인라인 `node -e`)로 먼저 검사해
  한글 경로에서 안내 후 exit 1로 멈춘다.

## Pitfalls

- pnpm 10/11 혼재 환경에서 lock을 만들면 신선 전이 패키지가 v11 게이트에 걸린다.
  배포물은 정책 파일과 함께 내보낼 것.
- 폴더째 압축 금지 — 반드시 `pnpm dist` (또는 제외 목록: `node_modules dist .vanilla .git *.log .env*`).
- 워크스페이스 경로는 반드시 ASCII-only. 한글 경로의 파일 `require`·`import`는
  Node 자체가 세그폴트한다(상류/환경 문제, 코드 우회 불가).
  → D-043에서 부분 완화: node 스크립트는 `ascii-cwd` 런처로 한글 경로 동작, vite는 여전히 영문 경로 필요. See: [[issue-korean-path-ascii-launcher]]

## Connections

- [[decisions]] — D-041·D-042 결정 원문
- [[standalone-play]] — 배포 워크스페이스 자체 실행 전제
