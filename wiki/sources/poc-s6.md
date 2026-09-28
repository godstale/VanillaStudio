---
title: 'PoC S6: Windows Doctor(의존성 점검) + FFmpeg 다운로드'
type: source
tags: [poc, phase-p3, doctor, windows, ffmpeg]
date: 2026-09-29
source_file: spikes/s6-doctor/README.md
sources: [feasibility-risks, technical-design]
last_updated: 2026-09-29
---

## Summary

**결론: 통과(깨끗한 PC는 최소 PATH로 모의).** Rust `doctor-probe`로 다음을 확인했다.

- 이 PC의 의존성 13종을 약 5초에 정확히 판정했다.
- PATH를 System32로 줄인 "깨끗한 PC" 조건에서 누락 항목과 해결 방법을 보고했다.
- FFmpeg GPL 빌드를 23초(194MB)에 받아 SHA-256을 검증하고, H.264 가능 여부를 확인했다.

실제 깨끗한 Windows 설치 검증은 P5 릴리스 체크리스트로 넘긴다.

## 결과

| 항목 | 실제 환경 | 최소 PATH |
| --- | --- | --- |
| Node | ok v22.13.0 (≥22 판정) | missing → `winget install OpenJS.NodeJS.LTS` |
| pnpm | ok 10.32.1 (`.cmd` shim 해석) | missing → Node 설치 후 `corepack enable pnpm` |
| git | ok 2.45.2 | missing → `winget install Git.Git`(없으면 폴더 스냅샷) |
| Claude Code / 로그인 | ok 2.1.283 / `claude auth status` → loggedIn | missing |
| Codex | missing(미설치) | missing |
| OpenCode·Hermes·AGY | ok (`.cmd`·`.exe`) | missing |
| FFmpeg | **outdated**: PATH의 2013년 빌드가 `-colorspace bt709` 검사에 실패 | missing → 앱 다운로드 |
| 렌더 브라우저 | ok chrome-headless-shell 152 (여러 버전 중 최신) | ok (캐시는 PATH 무관) |
| WebView2 | ok 153.0.4234.48 (레지스트리) | ok |
| winget | ok 1.29 | missing |

FFmpeg 다운로드:
- 과정: 릴리스 조회 → `ffmpeg-n9.0-latest-win64-gpl-9.0.zip` 선택 → 스트리밍 다운로드(진행률 32회) → SHA-256 일치 → 필요한 3개 파일만 추출 → 사후 점검 `libx264=true`
- 추출한 exe 2개가 합쳐 약 315MB를 차지한다.

## 발견 (Pitfalls)

1. **앱의 PATH는 실행 시점에 고정된다.**
   - 앱을 켜 둔 채 Node·Git을 설치하면 재점검해도 보이지 않는다.
   - 재점검할 때 레지스트리(`HKLM\...\Session Manager\Environment`, `HKCU\Environment`)의 `Path`를 다시 읽고 `%VAR%`를 확장한다(`--path fresh`로 확인).
   - 앱이 띄우는 자식 프로세스(에이전트·프리뷰 서버·워커)에도 이 새 PATH를 넘긴다.
2. **Windows 명령 shim**
   - npm 계열 CLI는 `.ps1`·`.cmd`·확장자 없는 sh 스크립트를 함께 설치한다(`pnpm`, `opencode`).
   - Rust `Command::new("pnpm")`은 `.exe`만 찾으므로 PATHEXT 순서로 직접 해석한다. `.ps1`은 건너뛰고 `.cmd`를 쓴다.
3. **FFmpeg 존재 ≠ 사용 가능**: 버전 문자열로는 판정할 수 없다. `-encoders`에서 `libx264`를 확인하고, HyperFrames가 쓰는 옵션(`-colorspace bt709`)으로 실제 인코딩을 시험한다.
4. **BtbN "latest"는 매일 다시 빌드된다.**
   - 이번에는 9.0이 받아졌다(S1은 8.1로 검증). 9.0으로도 S1 렌더는 성공했지만, **출력 바이트가 8.1과 다르다.**
   - 앱은 검증된 메이저 계열로 고정하고, 받은 자산 이름·SHA-256을 앱 데이터에 기록한다.
   - 골든 테스트는 FFmpeg 버전까지 고정한다.
   - 오래된 빌드는 릴리스에서 사라지므로, 재현 가능한 배포가 필요하면 자체 미러를 검토한다(P6).
5. **로그인 확인은 필요한 필드만 읽는다.** `claude auth status`는 이메일·조직 등도 출력한다. Doctor는 `loggedIn`만 읽고 나머지는 저장하거나 로그로 남기지 않는다.
6. **외부 명령 실행 규칙**: stdin을 닫고(`Stdio::null`, 입력 대기 방지 — S7 CLI 사례와 같음), 콘솔 창을 띄우지 않고(`CREATE_NO_WINDOW`), 15~20초 타임아웃을 둔다.

## 설계 반영

- 기술 설계서:
  - §2.4 의존성 표에 점검 방법을 추가했다.
  - §6 프로세스 실행 규칙에 fresh PATH·stdin·창 없음·타임아웃을 추가했다.
  - FFmpeg 다운로드 절차와 버전 고정 규칙을 정했다.
- 리스크 문서 §2.7·§3 진행 현황을 갱신했다.
- P5 릴리스 체크리스트: "깨끗한 Windows VM에서 Doctor 안내대로 준비"를 추가할 예정이다.

## Connections

- [[AppOwnedProcesses]], [[VanillaStudio]], [[ExportPipeline]], [[HyperFrames]], [[technical-design]], [[feasibility-risks]]
