---
title: 'Milestone V5: 레퍼런스 분석'
type: source
tags: [milestone, v2, reference, design]
date: 2026-10-06
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, milestone-v4, technical-design, poc-agent-terminal]
last_updated: 2026-10-06
---

브랜치 `feat/v2-reference`. TODO T5.1~T5.7 완료(GUI·실제 에이전트 데모 확인 대기). 이전: [[milestone-v4]]. 계획: [[implementation-plan]].

## 한 일

- **레퍼런스 등록(T5.1)**: `scene.json.references`가 진실 공급원이고 `references/references.json`은 에이전트용 거울(`writeScene`이 함께 씀). 이미지·영상은 **복사만**(링크 없음, D-029), URL은 http(s)만 기록(앱이 내려받지 않음), 메모, 삭제는 목록에서만(복사본 유지). 인스펙터 레퍼런스 탭.
- **키프레임·메타 추출(T5.2)**: Rust `extract_reference_frames`가 고정 argv(`ffprobe` → `ffmpeg`)로 균등 N장(기본 8, 최대 24, 폭 1280 JPEG)과 `meta.json`을 `references/analysis/<id>/`에 쓴다. 앱 관리형 FFmpeg 우선, 없으면 PATH, 둘 다 없으면 Doctor 안내. 입력은 slug·`ref-N`·`references/` 아래 상대 경로로만 제한.
- **분석 프롬프트(T5.3)**: 레퍼런스별 줄(경로·키프레임 규약 위치·URL 열람 전용), 사용자 메모는 인용된 데이터, 인젝션 방어 문구, 분석 마커 구간 안내. 인스펙터 [분석 실행]이 같은 에이전트 터미널로 전달한다.
- **DESIGN.md(T5.4)**: `design/analysis.ts`(분석 구간 읽기/쓰기, 마커 밖 바이트·CRLF 보존), `design/extends.ts`(워크스페이스 DESIGN.md만 상속 허용, 참조 해석 전에 병합, 신 값 우선), `mood` 필드.
- **분석 검토(T5.5)**: 분석 전후 스냅샷으로 분석 파일·DESIGN.md 구간 diff를 만들고 기존 실행 검토 다이얼로그에 통합. 마커 밖 DESIGN.md 변경·깨진 마커는 허용되지 않는 변경으로 경고, 그 부분만 되돌리기(분석 구간은 유지)·전부 되돌리기. 승인하면 분석 파일을 `references[].analysis`에 연결해 GUIDE.md가 가리키게 한다. 분석 실행은 신의 완료 상태를 바꾸지 않는다.
- **정책(T5.6)**: AGENTS.md 레퍼런스 구간에 스타일 전용·복제/추적/삽입 금지·저작권·URL 기록 전용 규칙, 인스펙터 안내 문구.
- **E2E(T5.7)**: 목 에이전트 `analyze`/`analyze-rogue` 모드와 `referenceFlow.test.ts`: 분석 → 검토 → 승인·연결 → GUIDE.md → DESIGN 상속 → 재생성(revise) 프롬프트 → 신 생성.

## 검증

`pnpm lint`·`typecheck`·`test`(125 파일 907 테스트, `resources/runtime` 재빌드 후)·`cargo test`(107 통과, 실제 FFmpeg 왕복 포함)·V4의 E2E 2종. 실제 FFmpeg 왕복 테스트는 PATH의 2013년 빌드(`-hide_banner` 미지원)에서는 건너뛰도록 되어 있어 `VANILLA_TEST_FFMPEG_DIR`로 현대 빌드를 지정해 돌렸다.

## 결정·문제·교훈

- 분석 마커는 기획서의 `vanilla:analysis:start/end`가 아니라 저장소 공통 형식 `<!-- vanilla:begin:analysis -->`~`<!-- vanilla:end:analysis -->`로 구현했다(기획서·설계서 문구를 정정).
- 기존 `applyMarkers`는 줄바꿈을 LF로 정규화해 CRLF 사용자 파일의 마커 밖 바이트가 바뀐다. 사용자 소유 파일용 `applyMarkersKeepEol`을 추가하고 mood에도 적용했다.
- `resolveRefs`가 배열을 객체로 바꾸는 기존 버그를 `mood` 배열을 넣다가 발견해 고쳤다. 이 파서는 런타임 Vite 플러그인에 번들되므로 `resources/runtime`을 다시 빌드해야 `dist.test.ts`가 통과한다.
- 이전 프롬프트의 "URL 금지"는 R-7(앱이 내려받지 않음, 에이전트가 열람)과 어긋나 "내려받기·저장 금지, 열람만"으로 정정했다.
- `useRunReview.begin`이 Promise를 돌려주도록 바뀌어, 테스트에서 `act(() => begin())`처럼 반환값을 넘기면 act가 비동기로 바뀌어 뒤 테스트가 깨진다(`void`로 감싸야 함).
- 환경(반복): 이 Windows 셸 도구는 명령 문자열의 백슬래시·`\n`을 한 번 해석해 파이썬/heredoc 코드가 깨진다. 이스케이프가 필요한 코드는 Write 도구로 쓰거나 `chr(92)`를 쓴다. 파일이 CRLF이면 여러 줄 치환이 실패하므로 LF로 바꿔 치환한 뒤 되돌린다.

## 알려진 한계

- 런타임 Vite 플러그인은 아직 신 단위 `DESIGN.md`(상속)를 소비하지 않는다. 앱 쪽 해석(`parseSceneDesign`)만 있다.
- 분석 결과의 "분위기 키워드 → 인스펙터 visualStyle.mood 자동 반영"은 하지 않았다(에이전트가 `scene.json` 허용 필드를 직접 쓴다).
- 실제 Claude Code·Codex로 영상 레퍼런스를 분석하는 데모는 하지 못했다(GUI·미설치).
- `references` 삭제는 복사본 파일을 지우지 않는다.

See: [[milestone-v4]], [[poc-agent-terminal]], [[implementation-plan]]
