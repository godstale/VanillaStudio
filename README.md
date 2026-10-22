# Vanilla Studio

> 코딩 에이전트(Claude Code·Codex·OpenCode·Hermes·AGENTS 호환 CLI)가 **브라우저 기술(코드)만으로**
> 정적 페이지·모션 그래픽·3D 애니메이션을 만들고, 그 신(Scene)들을 전환으로 이어 **시퀀스**(PPT·영상·인터랙티브)로
> 재생하는 Tauri 데스크탑 스튜디오. 생성형 이미지/영상 AI는 쓰지 않습니다.

Vanilla Studio는 에이전트를 조종하지 않습니다. **에이전트가 일하기 좋은 작업 폴더를 만들어 주고**(신별 가이드·`DESIGN.md`·`AGENTS.md` 생성),
**내장 터미널에서 에이전트 CLI를 띄우며 프롬프트를 클립보드로 전달**하고, **결과물을 바로 재생**해 줍니다.

**현재 상태**: v2(Scene 워크스페이스) 구현 V1~V7 완료, 버전 0.1.0. 클린 VM 설치·실제 에이전트 데모·코드 서명은 사람 확인 대기
(`wiki/overview.md`, `Docs/Verification/Clean-Install-Checklist-v2.md`).

## 핵심 개념

| 개념 | 설명 |
| --- | --- |
| **워크스페이스** | 작업 폴더 1개 = 워크스페이스 1개 = 시퀀스 1개. `workspace.json`이 식별자(`workspaceId`)와 화면 규격(비율·해상도·fps)을 가진다 |
| **Scene(신)** | `scenes/<slug>/` 폴더. 타입은 `static`(사용자 입력으로 진행) · `motion`(시간 함수형 모션) · `3d`(three.js). `scene.json`이 구조화 데이터 |
| **시퀀스** | `sequence.json`의 그래프. 신을 노드, 전환(trigger·transition)을 엣지로 연결 |
| **가이드 템플릿** | 신 유형별 입력 폼·용어집·규칙·프롬프트 묶음. 내장 템플릿 + 사용자 정의(확장만 가능) |
| **디자인 토큰** | `DESIGN.md` front matter가 색·타이포·간격의 유일한 출처. 생성물은 토큰으로만 스타일링 |
| **플레이그라운드** | 신 갤러리 + 시퀀스 재생기. 앱 없이도 `pnpm play`로 워크스페이스를 단독 발표할 수 있다 |

## 사용 흐름

1. 첫 실행 → **작업 폴더 선택**(새 워크스페이스 생성 또는 기존 열기, 신뢰 확인, 캔버스 규격).
2. **스토리보드/시퀀스 캔버스**(ComfyUI형, `@xyflow/react`)에서 Scene 노드 생성 → 타입·가이드 템플릿 선택.
3. 신 인스펙터에서 가이드 항목(용어 콤보박스 포함)·프롬프트·레퍼런스를 편집 → 앱이 `GUIDE.md`·신 `AGENTS.md`·프롬프트를 생성.
4. (선택) 레퍼런스 영상/이미지/URL 등록 → 키프레임 추출 → 분석 프롬프트로 **에이전트가 분석**, 결과는 DESIGN.md 분석 구간과 `scene.json`에 반영.
5. **에이전트 실행** → 내장 터미널(PTY)이 신 폴더에서 에이전트 CLI를 띄우고 생성 프롬프트는 클립보드에 준비됨 → 붙여넣기.
6. 미리보기 iframe에서 신 확인, **계약 검사**(결정성·금지 API·하드코딩 색상), 썸네일 자동 생성, 신별 코멘트로 수정 요청.
7. 신을 엣지로 연결해 시퀀스 구성 → **플레이그라운드**에서 재생(컷·크로스페이드·슬라이드·마스크 와이프 등 전환).
8. 신·시퀀스를 **`.vsx` 패키지**로 내보내거나 워크스페이스를 **zip**으로 압축/불러오기, 수업 배포는 `pnpm dist`.

## 화면 구성

사이드바: **스토리보드 · 시퀀스(워크스페이스 캔버스) · 신 목록 · 템플릿 · 플레이(플레이그라운드)** · 워크스페이스 전환/히스토리 · **설정**
(일반 · 워크스페이스 · 템플릿 · 에이전트 · 앱 · Doctor). 우측 플로팅 인스펙터와 하단 터미널 도크는 접을 수 있습니다.

## 주요 기능

- 🧱 **Scene 워크스페이스**: 신 CRUD, 타입별 스키마(zod), 정규화 직렬화(같은 입력 → 같은 바이트)
- 🧭 **가이드 엔진**: 내장 템플릿(motion/static/3d 및 opus 계열) + 사용자 템플릿, 마커 구간만 갱신하고 사용자 편집 보존
- 🤖 **에이전트 중립 실행**: `src/lib/agents/` 레지스트리(고정 argv, 감지, 붙여넣기 모드) — 터미널 실행 + 클립보드 전달뿐, 대화·권한은 CLI가 관리
- 🎞 **결정적 런타임** `@vanilla/runtime`: `useTime()` 순수 함수 → 같은 `t`에서 같은 프레임, Bridge v2(호스트 ↔ 신 iframe)
- 🎨 **DESIGN.md 파이프라인**: 토큰 파싱·상속·팔레트(내장 24종)·WCAG 대비, 색 교체 시 본문 바이트 보존
- 🔎 **레퍼런스 분석**: 등록·키프레임 추출(FFmpeg, 사용자 동의 후 다운로드)·분석 프롬프트 — URL은 앱이 내려받지 않음
- 💬 **코멘트·작업 지시서**: 신별 수정 요청 → `WORK_ORDER.md`로 집계, `pnpm vanilla` CLI 브리지
- 🖼 **썸네일 자동 생성**: DOM-only 신 포함, 여러 시점을 찍어 내용이 가장 풍부한 프레임 선택
- 📦 **공유·배포**: `.vsx`(해시 매니페스트, zip-slip·심링크 거부), 워크스페이스 zip 압축/불러오기, 단독 재생 빌드
- 🪟 **창 상태 복원**, 최근 워크스페이스 히스토리, 한/영 다국어, 라이트/다크 테마
- 🩺 **Doctor**: WebView2·Node 22+·pnpm·git·에이전트 CLI·FFmpeg 점검과 설치 안내

## 기술 스택

| 영역 | 채택 기술 |
| :-- | :-- |
| 데스크탑 셸 | Tauri 2 (Rust), Windows 우선 |
| 프런트엔드 | React 19, TypeScript(strict), Vite 7, Tailwind CSS 3 |
| UI | shadcn/ui("new-york"), Radix UI, lucide-react, react-resizable-panels |
| 캔버스 | `@xyflow/react` |
| 터미널 | `portable-pty`(Rust) + `@xterm/xterm` |
| 에디터 | CodeMirror 6 |
| 검증 | zod |
| 상태 | React Context per concern (전역 스토어 금지) |
| 저장소 | 내용은 **파일**(`workspace.json`·`scene.json`·`sequence.json`…), 앱 상태만 SQLite(`@tauri-apps/plugin-sql`) |
| 라우팅 | react-router-dom v7 `HashRouter` |
| i18n | 자체 사전 ko/en |
| 신 런타임 | Vite + React 19, three.js/`@react-three/fiber`, `@vanilla/runtime` (pnpm 워크스페이스 패키지) |

## 저장소 구조

```
src/                 React 앱 (components/·lib/·pages/) — 도메인별 lib + components 세트
src-tauri/           Rust 코어 (commands/·process/·watch.rs): 워크스페이스·신·PTY·프로세스·패키지·Doctor
packages/runtime/    @vanilla/runtime — 신 런타임 계약, Bridge, 디자인 토큰 Vite 플러그인, check_scene
packages/export-worker/  export 워커(코드 보존, v2.0 범위 밖)
resources/           워크스페이스 템플릿·가이드 템플릿·팔레트·골든 샘플·런타임 사본 (번들 리소스)
Docs/                요구사항·기획·설계·결정·플레이북·사용자 가이드·검증
wiki/                프로젝트 지식베이스 (index.md부터)
tests/e2e/           CDP 기반 E2E 스크립트(신 미리보기·시퀀스 재생·v1 마이그레이션·샘플)
```

상세 트리와 파일 찾기: [Docs/Project-Structure.md](./Docs/Project-Structure.md)

## 시스템 요구사항

- **Node.js** 22+ (신 프리뷰 서버·워크스페이스 스크립트용), **pnpm** 9+ (npm/yarn 금지)
- **Rust** stable 1.77.2+ (앱 빌드)
- 에이전트 CLI 1개 이상(Claude Code·Codex 등), 레퍼런스 영상 키프레임 추출 시 FFmpeg(앱이 동의 후 설치)
- 비ASCII(한글) 경로: 일부 한글 음절에서 Node 리졸버가 크래시하므로 워크스페이스는 영문 경로를 권장 — `Docs/Planning/Decisions.md` D-043·D-044

## 빠른 시작

```bash
pnpm install        # 의존성 설치
pnpm tauri dev      # 데스크탑 앱 개발 실행
pnpm dev            # 웹 프리뷰만 (Tauri 네이티브 기능 제외)
```

```bash
pnpm typecheck      # tsc --noEmit (+ packages)
pnpm lint           # eslint . --max-warnings=0
pnpm test           # vitest run
cargo test          # (src-tauri) Rust 변경 시
pnpm test:e2e:scene | test:e2e:sequence | test:e2e:samples   # CDP E2E
pnpm tauri build    # 배포용 인스톨러 (MSI·NSIS, 미서명)
```

워크스페이스 안에서(앱이 스캐폴딩): `pnpm dev`/`pnpm play`(발표 화면) · `pnpm build` · `pnpm check:scene` · `pnpm vanilla <cmd>` · `pnpm dist`(배포 zip).

## 작업 규칙 요약

- 브랜치: `main` 직접 커밋 금지, `<type>/<topic>` 브랜치 → Conventional Commits → PR. `git push`는 사용자 승인 후.
- 완료 전 `pnpm lint`·`typecheck`·`test`(Rust 변경 시 `cargo test`) 통과.
- 설계와 다르게 구현해야 하면 멈추고 보고 → `Technical-Design.md`·`Decisions.md` 갱신.
- 기록: 진행 기록은 `wiki/`, 재사용 절차는 `Docs/Playbook/`. 자세한 내용은 [AGENTS.md](./AGENTS.md).

## 문서 맵

| 문서 | 내용 |
| :-- | :-- |
| [AGENTS.md](./AGENTS.md) | AI 코딩 에이전트·개발자 작업 지침 (먼저 읽기) |
| [Docs/Vanilla-Studio-Requirements.txt](./Docs/Vanilla-Studio-Requirements.txt) | 요구사항 원본 |
| [Docs/Planning/Refactor-Spec-v2.md](./Docs/Planning/Refactor-Spec-v2.md) | v2 기획서 — 무엇을 만드는가 |
| [Docs/Planning/Technical-Design.md](./Docs/Planning/Technical-Design.md) | 기술 설계서 — 고유 설계의 진실 공급원 |
| [Docs/Architecture.md](./Docs/Architecture.md) | 아키텍처 개요(v2) + 기반 템플릿 구조 |
| [Docs/Project-Structure.md](./Docs/Project-Structure.md) | 디렉터리 구조·파일 찾기 |
| [Docs/Planning/Decisions.md](./Docs/Planning/Decisions.md) | 결정 기록 D-001~D-045 |
| [Docs/Planning/Implementation-Plan.md](./Docs/Planning/Implementation-Plan.md) · [TODO.md](./Docs/Planning/TODO.md) | 구현 계획(V1~V7)과 작업 목록 |
| [Docs/User-Guide/](./Docs/User-Guide/) | 사용자 가이드(시작하기·신과 가이드·시퀀스·레퍼런스·공유·문제 해결) |
| [Docs/Extension-Guide.md](./Docs/Extension-Guide.md) | 패널·뷰어·설정·명령·DB 추가 절차 |
| [Docs/Playbook/](./Docs/Playbook/README.md) | 개발 단계(P0~P7) 플레이북 |
| [DESIGN.md](./DESIGN.md) · [BRANDING.md](./BRANDING.md) | 앱 UI 디자인 토큰·브랜딩 |

## 라이선스

[MIT License](./LICENSE) · 서드파티 고지는 [NOTICE.md](./NOTICE.md)
