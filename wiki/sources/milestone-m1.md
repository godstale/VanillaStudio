---
title: 'Milestone M1: 기반 (앱 골격·Doctor·프로젝트 생성)'
type: source
tags: [milestone, phase-p4, m1]
date: 2026-09-29
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, parallel-execution, decisions, technical-design, poc-s6, poc-s7]
last_updated: 2026-09-29
---

## Summary

M1은 템플릿을 Vanilla Studio 앱 골격으로 바꾸고 프로젝트를 만들고 열 수 있게 했다. 웨이브 0(T1.1·T1.3) → 웨이브 1(레인 A·B·C·D 병렬) → 웨이브 2(B′·C′)로 진행했고, 조정 세션이 `feat/m1-foundation`에 `--no-ff`로 병합했다. main 병합·push는 사용자 승인 대기.

## 한 일

| 레인 | 항목 | 결과 |
| --- | --- | --- |
| 웨이브 0 | T1.1, T1.3 | `pnpm tauri dev` 기준선(콜드 빌드 ~1분), pnpm 워크스페이스(`packages/runtime`, `packages/export-worker`) |
| A 앱 셸 | T1.2, T1.4, T1.5, T1.17, T1.6 | 브랜딩, 예제 도메인 제거, 보안 기본값, 탭·액티비티바 등록, `.vanilla` DB + 마이그레이션 골격 |
| B Rust·Doctor | T1.8, T1.9, T1.10 | 프로세스 공통 모듈, `doctor_check`(13항목), FFmpeg 다운로드(실제 다운로드 검증) |
| C 프로젝트 모델 | T1.7, T1.12 | `vanilla.json` zod, 프로젝트 스캐폴딩 원본 |
| D 런타임·디자인 | T3.5, T4.1~T4.8 | `src/lib/design`, `@vanilla/runtime`(시계·준비 신호·Canvas·토큰·Bridge·도우미·check_scene) |
| B′ | T1.11, T1.15 | Doctor 화면, 고정 argv `pnpm install` 작업 + 동의 다이얼로그 |
| C′ | T1.13, T1.14, T1.16 | 스캐폴딩 Rust 명령, 새 프로젝트 마법사, 최근 프로젝트·신뢰 게이트 |
| 조정 | 통합 수정 | T1.15를 마법사에 연결, `.app-data`→`.vanilla`(Rust·vite·i18n), 번들 리소스, DB 경쟁 조건, 경로 접두어 |

## 검증(최종)

- `pnpm lint`·`typecheck` 통과, `pnpm test` 217개, `cargo test` 43개(+실제 FFmpeg 다운로드 1개 ignored, 수동 실행 통과)
- 실제 앱(`pnpm tauri dev`, WebView2 CDP)에서 확인: 창 제목 "Vanilla Studio", Doctor 화면(실제 환경 값·누락 항목 해결 방법), 스캐폴딩 결과 트리, 프로젝트 열기(파일 트리·`.vanilla/app.db` 생성·신뢰 확인), 콘솔 오류 0
- **수동 확인 필요**(자동화 불가): 네이티브 폴더 선택창을 거치는 마법사 클릭 흐름, 마법사 완료 후 `pnpm install` 동의·로그 실제 실행, 최근 프로젝트 목록에서 다시 열기, FFmpeg 다운로드 다이얼로그 클릭 흐름

## 결정·문제·해결

- 새 결정안(Proposed): D-019 FFmpeg 메이저 8 고정, D-020 `vanilla.json` 필드 계약, D-021 assetProtocol·Bridge 보완 → [[decisions]]
- Pitfalls
  - 병렬 레인 병합 시 `TODO.md` 체크박스 충돌이 매번 난다. 충돌 해결 후 체크박스를 다시 확인한다(한 번 풀린 것을 복구 커밋으로 살렸다).
  - TS만 `.vanilla`로 바꾸고 Rust `ensure_app_dir`가 `.app-data`를 만들어 DB가 안 열렸다. 경로 상수는 TS·Rust·vite 감시 제외를 함께 바꾼다.
  - 여러 Provider가 동시에 DB를 열면 마이그레이션이 경쟁해 `database is locked`. 초기화 promise를 공유한다. 첫 실행 기본 행은 `INSERT OR IGNORE`.
  - `canonicalize`는 Windows에서 `\?\` 경로를 준다. 프런트가 워크스페이스 루트로 쓸 값은 접두어를 벗긴다.
  - Tauri assetProtocol 스코프는 추가만 되고 회수 불가(`forbid_directory`는 영구·우선).
  - `frameloop="never"`(R3F)에서는 에셋 로드 후 재질 변경이 자동으로 다시 그려지지 않는다. 준비 신호는 "적용 완료"까지 봐야 한다.
  - Windows `.cmd` 실행 시 인자에 `=`가 있으면 따옴표가 붙는다. 예약 포트(EACCES)가 있다(5391 등).
  - reqwest 0.13 blocking에는 `read_timeout`이 없다. BtbN 릴리스는 8.1·9.0·master가 섞여 있어 메이저로 골라야 한다.
  - dev 포트 14200을 다른 프로젝트가 쓰면 `pnpm tauri dev --config` 로 devUrl·beforeDevCommand를 덮어써 실행한다.
  - `lint.py --save`는 Windows에서 `PYTHONUTF8=1`이 필요하고 `log.md` 맨 위에 쓰므로 맨 아래로 옮긴다.
  - pnpm 워크스페이스에서 루트 스크립트가 `pnpm -r`을 쓸 때 `--filter "./packages/*"`가 없으면 자기 자신을 재귀 호출한다.

## 남은 일(M1 이후로 이월)

- 새 프로젝트를 열 때 탭 저장소가 프로젝트별이 아님(M3 전에 수정)
- 새 프로젝트도 신뢰 확인이 뜸(자동 신뢰 여부 정책 결정)
- T4.9 런타임 빌드·배포 경로(레인 D 웨이브 2)
- `package.json`(name)·`README.md`·`LICENSE`의 템플릿 표기 정리

## Connections

[[implementation-plan]] · [[parallel-execution]] · [[decisions]] · [[technical-design]] · [[poc-s6]] · [[poc-s7]]
