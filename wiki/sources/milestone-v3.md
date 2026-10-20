---
title: 'Milestone V3: 가이드·인스펙터'
type: source
tags: [milestone, v2, guides, inspector]
date: 2026-10-06
source_file: Docs/Planning/TODO.md
sources: [implementation-plan, milestone-v2, technical-design]
last_updated: 2026-10-06
---

브랜치 `feat/v2-guides`. TODO T3.1~T3.14 완료. 이전: [[milestone-v2]]. 계획: [[implementation-plan]].

## 한 일

- **용어집·템플릿 형식**: 템플릿별 `glossary.json`(94개 motion 용어, static·3d 용어집), `schema.json`(`hide`·`defaults`·`fields`), 용어 콤보박스(검색·다중·자유 입력·툴팁·키보드).
- **내장 템플릿 3종 콘텐츠**: motion `commercial@1`은 원문 29개 섹션을 코드 구현용 규칙(`rules.md` §0~29, 6~7천자 제한 삭제, 구현 힌트)·체크리스트·프롬프트 3종으로 개편. static `web-page@1`(사용자 입력으로만 진행, steps 규칙), 3d `three-scene@1`(결정성·성능 예산).
- **폼 정의·편집기**: `forms.ts`가 인스펙터 가이드 탭을 구동(원문 29개 → 필드 매핑을 테스트로 고정), beats 편집기(시간 합 검증), steps 편집기(클릭·키·선택지만), 검증 실패 상태는 저장하지 않고 이유 표시.
- **DESIGN 섹션**: 토큰 요약·대비 경고, 팔레트 적용(colors만 교체·본문 바이트 보존), 분위기 키워드(마커 구간), 신 오버라이드(`extends`) 파일 생성.
- **사용자 정의 템플릿(D-031)**: `extends` 병합 규칙(필드 추가·숨김·기본값만, 정체성 필드·내장 필드 재정의·타입 변경·용어 중복 거부), 우선순위 해석(워크스페이스 `guide-templates/` > `templatesDir` > 내장, 같은 ref 자기 확장 허용), 검증 실패 시 **사용 거부**(목록에 이유와 함께 표시, 조용한 대체 없음), Rust `read_template_folders`(읽기 전용·텍스트만·크기·개수·깊이 상한·심링크 거부), 설정 › 가이드 템플릿 편집기(복제 → 편집 → 검증 → 저장).
- **프롬프트**: CodeMirror 사용자 프롬프트 편집기, `prompts/user-prompt.md` 저장, 클립보드 미리보기.
- **정리**: v1 템플릿 갤러리·`lib/templates`·`resources/templates`·템플릿 폴더 검사 UI 제거.

## 검증

`pnpm lint`·`typecheck`·`test`(103 파일 714 테스트)·`pnpm build`·`cargo test`(84) 통과. E2E 성격의 테스트: 복제 → 필드 추가·규칙 추가 → 신에 적용 → `scene.json`·AGENTS.md 반영(`templateEditor.test.ts`).

## 결정·문제·교훈

- 용어집은 `resources/glossary/`가 아니라 **템플릿 폴더 안**(`glossary.json`)에 둔다(D-028: 내장·사용자 정의 같은 형식). TODO 문구와 다르며 설계서 §8.2에 반영.
- scene.json에 `custom{}`(사용자 템플릿 필드 값)를 추가했다 — 데이터 계약 변경이라 설계서와 함께 갱신(`version` 1 유지, 기본값 `{}`).
- 3d 신은 motion과 필드를 공유하므로 3d 용어집에 motion 용어집 전체를 포함한다(테스트가 "폼 필드의 용어 카테고리가 용어집에 있는가"를 검사해 발견).
- 템플릿이 사용 불가이면 `writeScene`은 scene.json만 쓰고 생성물은 건드리지 않는다. 이전의 "내장으로 조용히 대체"는 제거했다.
- 템플릿 편집기는 확장 템플릿의 label·hide·fields·규칙·체크리스트·프롬프트만 다룬다. 내장 필드 기본값(`defaults`)·용어 추가 편집 UI는 없다(파일을 직접 편집).
- 환경: Windows bash heredoc에서 백슬래시가 소실되는 문제가 반복됐다(정규식·`\n`). 해당 코드는 Write/Edit 도구나 `chr(92)`로 쓴다. 파일이 CRLF이면 Edit의 여러 줄 매칭이 실패하므로 바이트 단위로 바꾼다.

## 알려진 한계

- 샘플 신(강동 숲)에 규칙을 적용해 에이전트가 따르는지는 수동 확인 항목이라 하지 못했다(V4 터미널 실행 후 확인).
- 인스펙터는 선택한 동안 외부 수정을 반영하지 않는다. `templatesDir`은 파일 선택 대화상자 없이 절대 경로 입력만 지원한다.
- GUI 실행(`pnpm tauri dev`) 확인은 사람이 해야 한다.

See: [[milestone-v2]], [[implementation-plan]], [[technical-design]]
