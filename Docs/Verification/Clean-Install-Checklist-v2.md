# Clean-Install Checklist — v2 (T7.8)

- 문서 버전: v2.0 (2026-10-06) · 대상: `feat/v2-release` 상당(V1~V7)
- 이전 문서: `Clean-Install-Checklist.md`(v1, T7.2 기록 — export 5종 검증은 v2.0 범위 밖, D-027). 이 문서가 v2.0 출하 기준이다.
- 완료 판정: §3 사람 확인 항목 전부 통과 + §4 서명된 인스톨러. **§1·§2는 개발 PC에서 자동·기계적으로 확인한 결과다. 깨끗한 Windows VM·GUI·실제 에이전트·서명은 사람이 한다(아래 표시).**

## 0. 환경 (실행일 2026-10-06, 개발 PC — clean VM 아님)

- Windows 11, Node 22.13.0, pnpm 10.32.1, tauri-cli 2.x, Chrome 154
- 이 PC의 PATH `ffmpeg`는 2013년 빌드(최신 옵션 미지원) → 키프레임 테스트는 최신 빌드(`VANILLA_TEST_FFMPEG_DIR`)로 실행
- Codex CLI 미설치, Claude Code 설치됨(앱 안 터미널 데모는 하지 않음)

## 1. 인스톨러 빌드 (자동 확인)

- [x] `pnpm tauri build` 성공 — 결과 파일 경로·크기는 `wiki/sources/milestone-v7.md` §검증에 기록
- [x] 번들 리소스(`tauri.conf.json` `bundle.resources`): `workspace-template`·`runtime`·`workers`·`palettes`·`skills`. 워크스페이스 만들기는 `resources/workspace-template`·`resources/runtime`을 쓰므로 둘 다 포함되어야 한다.
- [x] 프런트엔드 번들에 가이드 템플릿·용어집(`resources/guides`)이 컴파일되어 들어간다(Vite `?raw`/glob). 별도 리소스 복사가 필요 없다.
- [ ] **미서명** — §4 대기.

## 2. 자동 회귀 (개발 PC)

```bash
pnpm lint && pnpm typecheck && pnpm test              # 단위·컴포넌트·계약 테스트
cd src-tauri && cargo test                             # Rust(경로 안전·패키지·v1 읽기·PTY·FFmpeg 등)
pnpm test:e2e:scene && pnpm test:e2e:agent            # 신 미리보기·HMR, 목 에이전트가 쓴 신 재생
pnpm test:e2e:sequence                                 # 시퀀스 샘플 전 구간 + 전환 지연
pnpm test:e2e:samples                                  # 샘플 3종 재생·결정성
pnpm test:e2e:v1                                       # v1 마이그레이션 출하 게이트(샘플 3종)
```

실제 FFmpeg 키프레임 왕복 테스트는 `VANILLA_TEST_FFMPEG_DIR=<최신 ffmpeg bin 폴더>`가 있을 때만 의미가 있다(없으면 건너뜀).

## 3. Clean VM에서 할 일 (사용자) — **미실행**

- [ ] VM 스냅샷 → NSIS 인스톨러 설치(서명 전에는 SmartScreen 경고가 정상) → 실행
- [ ] 첫 실행: **작업 폴더 선택**(빈 폴더) → 이름·규격 → 의존성 설치 동의 → 워크스페이스 열림(캔버스 표시)
- [ ] **설정 → 환경 점검(Doctor)**: 항목 확인, FFmpeg 내려받기 동의 흐름 1회
- [ ] **신 추가**(모션·정적·3D 각 1개) → 노드·`scenes/<이름>/` 파일 생성 확인 → 인스펙터 편집 → `GUIDE.md`·`AGENTS.md` 갱신
- [ ] 샘플 덮어쓰기(`resources/samples/sequence-demo/`를 워크스페이스 템플릿 위에 복사) → 캔버스에 4개 노드·연결 표시 → **플레이그라운드** 재생(자동 진행·클릭 3단계·분기·전환)
- [ ] **실제 에이전트로 신 생성**(Claude Code·Codex 각각): **에이전트 실행** → 터미널 + 클립보드 프롬프트 → 에이전트가 `src/` 작성 → 변경 사항 검토·승인 → 재생. (자동 테스트는 목 에이전트만 검증했다. `wiki/sources/poc-agent-terminal.md` 지원 매트릭스의 ⏳ 칸을 채운다.)
- [ ] 레퍼런스: 영상 등록 → 키프레임 추출 → **분석 실행** → 변경 사항 검토(분석 구간 diff)
- [ ] **패키지(.vsx)**: 공유 → 다른 폴더(또는 다른 PC)에서 열기 → 검사 결과·신뢰 확인 → 가져오기 → 재생, `Docs/Verification/Reproducibility.md` §2 절차로 해시 대조
- [ ] **v1 프로젝트 가져오기**(v1 앱으로 만든 프로젝트가 있다면): 미리보기의 "변환하지 못한 항목" 확인 → 빈 폴더로 변환 → 재생
- [ ] `pnpm tauri dev` GUI 실행(한 번도 하지 못함): 흰 화면 없음, 캔버스·인스펙터·도크 레이아웃, 한/영 전환, 다크/라이트

## 4. 코드 서명·업데이터 런북 (v1 T7.5 이월 — 사용자 인증서 준비 후)

1. `pnpm tauri signer generate -w ~/.tauri/vanilla.key` (비밀키 절대 커밋 금지) → 공개키를 `tauri.conf.json` `plugins.updater.pubkey`에.
2. `plugins.updater.endpoints`: 배포 채널 URL(인증서·채널 결정 후).
3. `bundle.createUpdaterArtifacts: true` 추가 후 `pnpm tauri build`.
4. Windows 서명: NSIS/MSI `signtool`(AzureSignTool 권장) + 타임스탬프 → 서명된 인스톨러.
5. 현 상태: updater 플러그인 미추가(키·채널 없이 추가하면 빌드·실행을 검증할 수 없어 보류, AGENTS.md §8). **서명·배포·push는 사용자 승인 후**에만 한다.

## 5. 알려진 한계 (v2.0)

- Playground는 재생 중 신 안의 버튼을 누를 수 없다(입력 레이어가 덮음). 분기는 호스트 선택지로 한다.
- 런타임 Vite 플러그인은 신 단위 `DESIGN.md`(상속)를 아직 소비하지 않는다.
- 실행 이력 탭은 자리만 있다(스냅샷은 `.vanilla/history/`에 쌓이고 diff 다이얼로그에서 쓰인다).
- 내보내기(이미지·슬라이드·영상)는 후속(D-027). 코드는 보존되어 있다.
