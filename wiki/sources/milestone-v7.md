---
title: 'Milestone V7: 패키지·마이그레이션·릴리스'
type: source
tags: [milestone, v2, package, migration, release]
date: 2026-10-06
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, milestone-v6, technical-design, issue-v1-migration, poc-agent-terminal]
last_updated: 2026-10-06
---

브랜치 `feat/v2-release`. TODO T7.1~T7.7 완료, T7.8은 자동 확인분만 완료(깨끗한 VM·GUI·서명은 사람 몫), T7.9 이 문서. 이전: [[milestone-v6]]. 계획: [[implementation-plan]].

## 한 일

- **`.vsx` 패키지(T7.1·T7.2)**: Rust `package_commands.rs` — 허용 목록(allowlist)으로만 담고, 같은 입력 → 같은 zip 바이트(정렬·고정 시각·고정 권한·타임스탬프 없는 manifest), 파일별 SHA-256. 열기 전 **검사**(zip-slip·절대 경로·역슬래시·드라이브·심링크·암호화·중복·개수·크기·manifest 대조)를 하고, 추출은 덮어쓰지 않는다. TS는 새 신 폴더·새 sceneId·workspaceId 재작성·가이드 재렌더·엣지 이관(`package/import.ts`)과 열기 전 확인 다이얼로그(에이전트 지시 파일 목록 + 신뢰 체크 필수), 내보내기 다이얼로그. Rust↔TS manifest 계약은 골든 파일로 대조.
- **신 템플릿으로 저장(T7.3)**: 구조 필드만 사용자 템플릿 기본값으로 남기고 내용은 비운다(beats·steps는 뼈대만). 가이드는 `extends`로 상속.
- **재현성(T7.4)**: `tests/repro`(키 순서·CRLF·시간 소수점·다른 폴더/cwd에서 같은 바이트), 절차 문서 `Docs/Verification/Reproducibility.md`.
- **v1 마이그레이션(T7.5)**: 읽기 전용 `read_v1_project` → 순수 변환 계획 → 적용 → 온보딩 다이얼로그. **출하 게이트 통과**(샘플 3종 재생) → [[issue-v1-migration]].
- **샘플(T7.6)**: 4종(motion 강동 숲속 도서관 변환·static 랜딩·3d 토러스·시퀀스 데모), JSON 드리프트·가이드 렌더·계약 검사 테스트, 재생 회귀 E2E(결정성 포함).
- **문서(T7.7)**: v2 사용자 문서 7종(v1은 `legacy/` 보관), 앱 안 링크 목록, `NOTICE.md` v2 의존성 표 + 직접 의존성 전수 일치 테스트(`react-dom`·`proxy-agent` 누락을 발견·보강).
- **릴리스 점검(T7.8)**: 실제 `pnpm tauri build` 성공. 클린 VM 체크리스트를 v2 기준으로 다시 썼다(`Docs/Verification/Clean-Install-Checklist-v2.md`).

## 검증

- `pnpm lint`·`typecheck`·`test`(149 파일 1133 테스트)·`cargo test`(127 통과, 실제 FFmpeg 왕복 포함)
- E2E(실제 Chrome·프리뷰 서버): `test:e2e:scene`·`agent`·`sequence`·`v1`·`samples` 전부 통과
- **인스톨러**: `Vanilla Studio_0.1.0_x64_en-US.msi` 21.3MB, `Vanilla Studio_0.1.0_x64-setup.exe`(NSIS) 18.4MB, 릴리스 `app.exe` 30.9MB. 번들 리소스에 `workspace-template`·`runtime`이 들어간다. **릴리스 `app.exe`를 실행해 10초 동안 살아 있고 창 제목이 "Vanilla Studio", WebView2 프로세스가 뜨는 것까지 확인**했다(화면 내용은 사람이 확인해야 한다).
- 인스톨러는 **미서명**이다.

## 결정·문제·교훈

- 패키지는 **허용 목록 방식**이다(알 수 없는 파일은 담지 않는다). 사용자 폴더에 무엇이 있을지 모르므로 "제외 목록"보다 안전하다.
- 가져오기는 **사람이 지시 파일을 보고 승인**해야 열린다(AGENTS.md §7: 패키지의 `AGENTS.md`·프롬프트·템플릿은 신뢰할 수 없는 외부 콘텐츠). 템플릿은 기존 것을 덮어쓰지 않고 병합하지 않는다.
- 마이그레이션 변환 중 **런타임 결함**을 발견해 고쳤다: 신별 `params/`가 읽히지 않아 사용자 조절값이 사라졌다(`paramsForPath`). 마이그레이션 테스트가 아니었다면 놓쳤을 결함이다 — 새 기능이 기존 기능의 숨은 가정을 드러낸다.
- 의존성 표 일치 테스트가 실제 누락 2건을 찾았다. "문서와 코드가 같다"는 주장은 테스트로 고정한다.
- 환경(반복): 이 Windows 셸 도구는 명령 문자열의 백슬래시를 한 번 해석해 파이썬·heredoc 코드의 정규식·`\n`이 깨진다. 이스케이프가 필요한 코드는 Write 도구나 `chr(92)`로 쓰고, 편집 후 곧바로 `typecheck`로 확인한다.

## 알려진 한계 / 사람이 해야 할 것

- **클린 VM 설치·GUI(`pnpm tauri dev`)·실제 Claude Code·Codex 데모·코드 서명·배포는 하지 못했다**(체크리스트 §3·§4). 에이전트 테스트는 목 에이전트까지다.
- v1 마이그레이션 샘플은 대표 샘플이라 실제 v1 프로젝트로 한 번 시험해야 한다.
- 런타임 Vite 플러그인은 신 단위 `DESIGN.md` 상속을 소비하지 않는다. Playground는 재생 중 신 안의 버튼을 누를 수 없다. 내보내기는 후속(D-027).
- push는 한 번도 하지 않았다. 완료한 브랜치(V1~V6)는 로컬 `main`에 fast-forward 했고 `feat/v2-release`는 아직 병합하지 않았다 — **병합·push는 사용자 승인 대기**.

See: [[milestone-v6]], [[issue-v1-migration]], [[implementation-plan]]
