---
title: 'AppOwnedProcesses'
type: concept
tags: [security, process]
sources: [technical-design]
last_updated: 2026-09-28
---

앱이 직접 띄우는 고정 목적 프로세스(프리뷰 Vite 서버, export 워커, pnpm install). 임의 문자열 셸(`run_shell`)과 분리해 Rust enum으로 종류를 받고 argv는 Rust가 조립(D-012, Proposed). `run_shell`의 매번 확인 원칙은 그대로 유지. 관련: [[PermissionPolicy]]

## Discussed In

- [[technical-design]] — §6
- [[decisions]] — D-012
