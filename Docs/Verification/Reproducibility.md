# 재현성 검증 절차 (T7.4)

> 목표(D-023): **같은 입력 → 같은 바이트.** 같은 `scene.json`은 같은 가이드 파일(`GUIDE.md`·`AGENTS.md`·`prompts/*`)을 만들고, 패키지(`.vsx`)를 풀었다 다시 묶으면 같은 파일이 나오며, 폴더·PC가 달라도 결과가 같다.
> 문서 버전: v1.0 (2026-10-06)

## 1. 자동 검증 (CI·개발 중)

```bash
pnpm vitest run tests/repro                 # 재현성 테스트 9개
pnpm vitest run src/lib/json                # 정규화 직렬화(canonical) 단위 테스트
cd src-tauri && cargo test package_commands # .vsx: 같은 입력 → 같은 zip, pack → extract → pack 바이트 동일
```

| 보장 | 테스트 |
| --- | --- |
| 샘플의 모든 JSON이 정규형이다(파싱 → 직렬화가 원본과 같다) | `tests/repro` "sample JSON files are canonical" |
| 입력 키 순서·CRLF·들여쓰기가 달라도 같은 바이트 | "input key order…", "CRLF input…" |
| 시간(초)은 항상 소수 3자리 | "time values are written with three decimals" |
| 가이드 생성물이 렌더마다 같고, 시각·절대 경로가 없다 | "generated guide files are identical…", "a copy of the workspace in another folder…" |
| 기존 `AGENTS.md`의 마커 밖 텍스트 보존, 두 번째 렌더는 변화 없음 | "re-rendering over an existing AGENTS.md…" |
| `GUIDE.md`의 `scene-hash`는 `scene.json` 내용에만 의존한다 | "the scene hash header…" |
| 패키지: 파일 수정 시각이 달라도 같은 zip 바이트 | `create_is_deterministic_and_the_manifest_matches` |
| 패키지: pack → extract → pack 바이트 동일, 실제 샘플 왕복 | `round_trip_extracts_byte_identical_files`, `the_real_sample_sequence_round_trips` |
| Rust·TS가 같은 manifest 계약을 쓴다 | `tests/fixtures/manifest.sample.json` 골든 파일 |

## 2. 다른 폴더·다른 PC에서 재현하는 절차 (수동)

앱이 만든 결과가 환경에 묶이지 않았음을 사람이 확인할 때 쓴다.

1. **원본 PC**: 워크스페이스 폴더에서 신 하나를 고르고 해시를 남긴다.
   ```powershell
   Get-FileHash scenes\<slug>\scene.json, scenes\<slug>\GUIDE.md, scenes\<slug>\AGENTS.md, sequence.json -Algorithm SHA256
   ```
2. **패키지로 옮기기**: 앱에서 *공유(.vsx)* → 시퀀스 전체. 파일을 다른 PC로 복사한다(`.vsx`는 SHA-256 manifest를 가지고 있어 전송 중 손상은 열 때 거부된다).
3. **대상 PC**: *패키지 열기…* → 검사 결과(원본 워크스페이스 이름·파일 수)와 에이전트 지시 파일 목록을 확인하고 가져온다.
4. **같은 해시 확인**: 가져온 신의 `scene.json`을 같은 방법으로 해시한다.
   - `scene.json`: 신 `id`만 새로 발급되므로 `id` 줄을 제외하면 같다(워크스페이스가 달라지는 것은 의도된 동작, D-029).
   - 에이전트가 쓴 `src/`·`params/`·`references/analysis/`: **바이트 동일**해야 한다(앱이 건드리지 않는 사용자·에이전트 소유물).
   - `GUIDE.md`·`AGENTS.md`·`prompts/*`: 가져오면서 새 `workspaceId`·`sceneId`로 다시 렌더되므로 해당 헤더 줄만 다르다. 같은 PC에서 두 번 렌더하면 완전히 같다.
5. **재생 확인**: 대상 PC에서 *플레이그라운드*로 시퀀스를 재생한다. 같은 시각 `t`는 같은 프레임(결정성, D-011).

## 3. 환경이 결과에 새어 들어가는지 점검

생성물에 다음이 보이면 버그다(테스트가 이미 막고 있다):

- 절대 경로(`C:\Users\…`, `/home/…`), 사용자 이름·PC 이름
- 현재 시각·난수·정렬되지 않은 목록
- CRLF 섞임(앱이 쓰는 생성물은 항상 LF)

점검 한 줄:

```bash
grep -rEn "[A-Za-z]:[\\/]|/(Users|home)/|[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:" scenes/*/GUIDE.md scenes/*/AGENTS.md scenes/*/prompts
```

## 4. 알려진 한계

- 에이전트가 만든 결과물(`src/`) 자체는 에이전트가 쓰므로 같은 프롬프트라도 다를 수 있다. 재현성은 **앱이 만드는 파일과 패키지**에 대한 보장이다.
- 렌더 결과(픽셀)의 PC 간 동일성은 GPU·드라이버에 따라 다를 수 있다. 시계 계약은 "같은 `t`에서 같은 상태"까지이며 픽셀 동일성은 보장하지 않는다.
- zip 압축 결과는 같은 앱 버전(같은 `zip` 크레이트·압축 수준)에서만 바이트 동일하다. 다른 버전 사이에서는 manifest의 파일별 SHA-256로 내용 동일성을 확인한다.
