# Clean-Install Checklist (T7.2)

- 문서 버전: v1.0 (2026-10-02) · 대상: `feat/m7-release` 상당(main + T7.2 수정분)
- 완료 판정: 아래 전 항목 통과. **깨끗한 Windows VM에서의 재실행은 아직 남음** — 본 기록은 개발 PC 실행 결과이며, VM 재실행 시 이 문서 그대로 따라 한다.

## 0. 환경 (실행일 2026-10-02, 개발 PC — clean VM 아님)

- Windows 11, Node 22.13.0, pnpm 10.32.1, tauri-cli 2.11.5, Chrome 154.0.8037.92
- PowerPoint 16.0 (COM 검증용), Claude Code 2.1.286 (로그인됨, 미사용)
- FFmpeg: 시스템 빌드(libx264 없음) → S1의 GPL 빌드(`spikes/s1-hyperframes-r3f/.tools/`, git 제외)로 export 실행
- 샘플 프로젝트: `resources/project-template` + `resources/runtime` 복사본 (temp, `t7-2-sample`)

## 1. 인스톨러 빌드 (T7.1 연기분)

- [x] `pnpm tauri build` 성공 (EXIT 0)
  - `src-tauri/target/release/bundle/msi/Vanilla Studio_0.1.0_x64_en-US.msi` (23.5MB)
  - `src-tauri/target/release/bundle/nsis/Vanilla Studio_0.1.0_x64-setup.exe` (19.9MB)
  - **미서명** — T7.5(인증서) 대기. 설치 실행 자체는 clean VM에서 한다.

## 2. 샘플 export — 전부 출하 번들(`resources/workers/vanilla-export.mjs`)로 실행

| 형식 | 잡 | 결과 |
| --- | --- | --- |
| web | `t7-2-job-web.json` | `site.zip` 89KB ✓ |
| image | `t7-2-job-image.json` (960×540 @1x) | PNG 1장 ✓ |
| slides 이미지 | `t7-2-job-slides.json` (2장, @2x) | PNG 2장 + `slides.pptx`(2장·960×540pt, PowerPoint COM 확인) + `slides.pdf` ✓ |
| slides 편집(Beta) | 동일 잡(`editable:true`) | `slides-editable.pptx` + `FONTS-README.md` ✓, PowerPoint에서 열림·텍스트프레임 1개 확인·COM으로 텍스트 수정→저장→XML 반영 확인 ✓ |
| video | `t7-2-job-video.json` (960×540·30fps·3초·workers 1, hyperframes 0.8.82 + GPL FFmpeg) | `video.mp4` (h264·960×540·3.000초) + `poster.png` ✓ |

검증 스크립트: `spikes/s2-still-pptx/scripts/verify-pptx.ps1`(장수·크기·도형·텍스트프레임·PNG 추출).

## 3. 실행 중 발견·수정한 결함 (T7.2 수정분, 단위 테스트 포함)

1. **출하 번들이 실제 잡에서 전부 죽음**: 번들 말미 `throw Could not resolve "proxy-agent"` (optional peer 미설치 → Vite가 무조건 throw stub 생성). `--help`·에러 경로는 평가 완료 전 종료돼서 기존 번들 테스트를 통과했음.
   - 수정: `proxy-agent` 8.0.2 실의존 추가(MIT, `Feasibility-Risks.md` §2.9 기록) + `scripts/build.test.ts`에 "번들에 `Could not resolve` 없음" 회귀 assertion.
2. **같은 패턴 2차**: `kerberos`(`proxy-agent-negotiate`의 네이티브 optional peer, 번들 불가) → `scripts/kerberos.stub.mjs` alias(쓸 때만 실패, upstream과 동일 의미).
3. **번들 CDP WebSocket 세션 실패** (소스에서는 정상): 런처를 stdio pipe(`pipe: true`)로 전환 — `capture.ts`·`slidesEditable.ts`. localhost 소켓·포트 충돌도 함께 제거.
4. **편집 PPTX 2장 병합본이 PowerPoint에서 안 열림**: 병합이 donor의 `notesSlide` rel을 그대로 복사해 두 슬라이드가 한 notes를 공유 + `app.xml` 개수 갱신 누락.
   - 수정: `stripSharedNotesSlideRels` + `fixAppXmlSlideCount` (`mergeSlideDecks` 내장, 단위 테스트 4건). COM 실편집까지 재검증 완료.

## 4. Clean VM에서 할 일 (사용자)

- [ ] VM 스냅샷 → NSIS 인스톨러 설치(서명 경고 확인 — T7.5 전에는 정상) → 실행
- [ ] Doctor 탭: 13개 항목 확인, FFmpeg 다운로드 동의 흐름 1회
- [ ] 샘플 프로젝트 1개로 파이프라인 끝까지 + 5종 export (이 문서 §2와 대조)
- [ ] `pnpm tauri dev` 흰 화면 수정(CSP)目视 확인 — 이 PC에서는 빌드·번들로만 검증됨
- [ ] 실제 Claude Code 세션 시작·대화·취소 + 셸 권한 다이얼로그 확인 (`claude` 로그인済)

## 5. T7.5 런북 (인증서 준비 후 — 사용자 체크리스트 P6)

1. `pnpm tauri signer generate -w ~/.tauri/vanilla.key` (비밀키 절대 커밋 금지) → 공개키를 `tauri.conf.json` `plugins.updater.pubkey`에.
2. `plugins.updater.endpoints`: GitHub Releases 등 배포 채널 URL (인증서·채널 결정 후 기입).
3. `bundle.createUpdaterArtifacts: true` 추가 후 `pnpm tauri build`.
4. Windows 서명: NSIS/MSIsigntool(AzureSignTool 권장) + 타임스탬프 → 서명된 인스톨러가 T7.5 완료 판정.
5. 현 상태: updater 플러그인 미추가(키·채널 없이 추가하면 빌드/실행 검증 불가라 구현 보류 — AGENTS.md §8).
