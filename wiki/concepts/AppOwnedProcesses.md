---
title: 'AppOwnedProcesses'
type: concept
tags: [security, process]
sources: [technical-design]
last_updated: 2026-09-29
---

앱이 직접 띄우는 고정 목적 프로세스(프리뷰 Vite 서버, export 워커, pnpm install). 임의 문자열 셸(`run_shell`)과 분리해 Rust enum으로 종류를 받고 argv는 Rust가 조립(D-012, Accepted 2026-09-29). `pnpm install`은 마법사에서 1회 동의, 이후 `package.json` 변경 시에만 재확인. `run_shell`의 매번 확인 원칙은 그대로 유지. 관련: [[PermissionPolicy]]

## Discussed In

- [[technical-design]] — §6
- [[decisions]] — D-012

## Pitfalls

- Windows 명령 shim: `.ps1`/`.cmd`/확장자 없는 스크립트가 함께 설치된다. PATHEXT 순서로 직접 해석하고 `.cmd`를 쓴다 → [[poc-s6]]
- 앱 PATH는 실행 시점에 고정된다. 자식 프로세스에는 레지스트리에서 새로 읽은 PATH를 넘긴다.
- CLI는 stdin이 열려 있으면 입력을 기다리며 멈출 수 있다(`@google/design.md`). 항상 stdin을 닫는다 → [[poc-s7]]
