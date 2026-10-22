---
title: '한글 경로 Node 세그폴트 이분·ascii-cwd 런처 (D-043)'
type: source
tags: [distribution, node, windows, unicode, bugfix]
sources: [resources/workspace-template/scripts/ascii-cwd.mjs]
last_updated: 2026-10-22
---

# 한글 경로 Node 세그폴트 이분·`ascii-cwd` 런처 (D-043)

D-042의 `guard:path`(한글 경로 전면 차단)를 한글 지원 요구에 따라 부분 지원으로 바꿨다.

## 측정 결과 (Node 22.13.0, Windows, `pnpm` 10.32.1)

- 정상: 프로세스 시작·코어 `require`·`fs`·자식 프로세스·ESM 엔트리 로드·junction 생성·로컬 파일 `require`(충돌 없는 음절 경로)·네이티브 `.node` `dlopen`·pnpm 심링크·3단 junction 체인·`exports` 맵 해결.
- 세그폴트(exit 3221225477): 리졸버/로더 네이티브 코드가 특정 한글 음절 포함 경로를 밟을 때.
  `숲·속·도·서·바·이·브·코·딩·개·론·나·한·증`은 죽고 `가·관·글·검`은 산다(낱음절·기존 파일 `require` 기준).
  한글 cwd + 비코어 `require`, ASCII cwd + 충돌 음절 한글 target 로드, vite 그래프·zod 로드에서 재현.
- 우회 불가: junction·subst·`--preserve-symlinks` 모두 해결이 한글 실경로로 정규화되어 vite는 그대로 죽는다.
- `esbuild` postinstall(`node install.js`)은 검증용이라 생략해도 플랫폼 바이너리(`@esbuild/<platform>` optional dep)가 있어 vite가 동작한다.
  반대로 `allowBuilds: { esbuild: true }` 사전 승인은 한글 경로에서 postinstall이 죽어 `pnpm install`이 exit 1 + `.bin` 미생성으로 끝난다.

## 수정 (D-043, [[decisions]])

- `scripts/ascii-cwd.mjs`(코어 모듈만) 런처: ASCII cwd면 그대로 실행. 비ASCII cwd(Windows)에서
  `node` 스크립트(`check:scene`·`vanilla`)는 `%TEMP%/vanilla-ws-<hash>` junction 별칭에서 재실행한다(`dist`는 런처를 거치지 않고 제자리 실행, 한글 경로에서 정상).
  `vite`(`dev`·`play`·`build`·`preview`)는 D-044부터 제자리 실행 후 exit 3221225477일 때만 영문 경로 이전 안내를 출력한다(초기 D-043은 사전 차단이었음).
- 템플릿 `package.json` 6종 스크립트를 `node scripts/ascii-cwd.mjs <cmd>`로 교체, `guard:path` 삭제.
- 템플릿 `pnpm-workspace.yaml`에 `allowBuilds`를 두지 않는다(생략=스킵+exit 0). `Ignored build scripts` 경고는 무시해도 된다.
- 기존 폴더 `package.json`은 사용자 소유라 Studio가 덮지 않는다(D-042 정책 유지). `.mjs`는 open 시 보충.

## 검증 (D-044 추가)

- `강의` 경로: `pnpm build` exit 0, vite dev 서버 `/play.html`·`/play/main.tsx` 200. `숲` 경로: 안내 메시지 + exit 3221225477. `pnpm check:scene`·`pnpm dist`는 두 경로 모두 정상.
- zip: 중첩 `scenes/*/.vanilla/` 썸네일 제외(464→434 파일), vitest 31건.

## 검증 (D-043)

- 한글 경로(`C:\Workspace\강의\vanilla-한글검증\...`, `숲` 포함): `pnpm install` exit 0, `pnpm check:scene` PASS, `pnpm build` 안내 메시지 exit 1.
- 영문 경로: `pnpm build` 성공(`✓ built in 2.19s`), vitest·cargo test 통과.

## Pitfalls

- 한글 경로라고 다 죽는 게 아니라 음절에 따라 다르다(`강의` 경로 `pnpm build`·dev 서버 정상, `숲` 경로 크래시). 안전 음절 목록으로 사전 분기하거나 비ASCII 전체를 사전 차단하지 말 것 — 사전 차단은 멀쩡한 경로까지 막는다(D-043 초기 실수). 실행 후 종료 코드 3221225477로 판정한다(D-044).
- `pnpm approve-builds`에서 esbuild를 선택(승인)하면 한글 경로 설치가 깨진다. 템플릿이 `allowBuilds`를 생략한 이유다.
- `pnpm pack`은 내장 tarball 명령이라 여전히 금지, `pnpm dist` 사용(D-042 유지).

## Connections

- [[decisions]] — D-043 결정 원문
- [[issue-dist-pack-pnpm-policy]] — D-041·D-042 배경
- [[standalone-play]] — 배포 워크스페이스 자체 실행 전제
