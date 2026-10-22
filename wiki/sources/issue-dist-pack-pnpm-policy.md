---
title: '수업 배포 zip 설치 실패 (pnpm v11 minimumReleaseAge)'
type: source
tags: [distribution, pnpm, supply-chain, bugfix]
sources: [resources/workspace-template/scripts/pack-workspace.mjs, resources/workspace-template/pnpm-workspace.yaml]
last_updated: 2026-10-22
---

# 수업 배포 zip 설치 실패 (D-041)

`tests/LLM_and_Vibe_Coding_Day02_v2`를 폴더째 압축해 다른 PC에서 `pnpm install`했더니
`[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION]`으로 실패했다.
`caniuse-lite@1.0.30001818`(2026-10-21T10:34:59Z 발행, `browserslist` 경유 전이 의존성)이
컷오프(2026-10-21T07:48:22Z) 안에 있었다. 네트워크 경고(`GET registry.npmjs.org error`)도 겹쳤다.

## 원인 2가지

1. **pnpm v11 기본 24시간 게이트**: `minimumReleaseAge` 기본값 `1440`(분) —
   발행 24시간 이내 버전의 해결을 거부한다. `caniuse-lite`는 수일 간격으로 갱신되는 DB라
   새로 `pnpm install`하면 상시 노출된다. 배포 PC(pnpm 10, 무검사)로 만든 lock이 신선 버전을
   물고 있었고, 받는 PC(pnpm 11)가 거부했다. (`pnpm` 공식 문서: `pnpm.io/supply-chain-security`)
2. **잘못된 압축**: `node_modules/`·`dist/`·`.vanilla/`를 포함한 채 압축했다
   (템플릿 `.gitignore` 위반). 용량·PC별 꼬임의 원인.

## 수정 (D-041, [[decisions]])

- 템플릿에 `pnpm-workspace.yaml`(`minimumReleaseAge: 0`) 추가 — 받는 쪽 무개입 설치가 우선.
  직접 의존성 영향 없음. `open_workspace`가 기존 폴더에도 비파괴 보충한다.
- `pnpm pack`(`scripts/pack-workspace.mjs`, Node 내장만·Win/Mac/Linux): 제외 목록 적용,
  `pnpm-lock.yaml` 포함, 정책 파일 미존재 시 자동 생성. 미니 zip 라이터 내장
  (`node:zlib` deflate, 의존성 없음).
- 받는 쪽 순서 고정: 압축 풀기 → `pnpm install` → `pnpm dev`.

## Pitfalls

- pnpm 10/11 혼재 환경에서 lock을 만들면 신선 전이 패키지가 v11 게이트에 걸린다.
  배포물은 정책 파일과 함께 내보낼 것.
- 폴더째 압축 금지 — 반드시 `pnpm pack` (또는 제외 목록: `node_modules dist .vanilla .git *.log .env*`) .

## Connections

- [[decisions]] — D-041 결정 원문
- [[standalone-play]] — 배포 워크스페이스 자체 실행 전제
