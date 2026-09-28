# S6 — Windows 의존성 점검(Doctor) + FFmpeg 다운로드

PoC 결과: `wiki/sources/poc-s6.md`

## 구성

`src/main.rs` (`doctor-probe`, Rust — 앱 `doctor_commands.rs`의 초안)

- `check [--path <PATH>|fresh] [--ffmpeg-dir <dir>]`: 아래 항목을 JSON으로 보고한다.
  - 점검 항목: Node(≥22)·pnpm·git·에이전트 CLI 5종·Claude 로그인·FFmpeg(H.264 가능 여부)·렌더 브라우저·WebView2·winget
  - PATH 해석은 cmd.exe와 같은 방식이다(PATH 순서 × `.exe/.cmd/.bat/.com`, `.ps1` 제외).
  - 명령은 stdin 닫힘·콘솔 창 없음·타임아웃 조건으로 실행한다.
  - `--path fresh`: 레지스트리(HKLM/HKCU Environment)에서 PATH를 다시 읽는다(앱 실행 후 설치한 도구 인식).
- `download-ffmpeg <dest>`: BtbN GitHub 릴리스 조회 → win64 GPL zip 선택 → 스트리밍 다운로드(진행률 NDJSON) + SHA-256 검증 → `ffmpeg.exe`·`ffprobe.exe`·`LICENSE.txt`만 추출 → 사후 점검

## 실행

```powershell
cargo build
target/debug/doctor-probe.exe check > out/check-real.json
target/debug/doctor-probe.exe check --path "C:\Windows\System32;C:\Windows"   # 깨끗한 PC 모의
target/debug/doctor-probe.exe check --path fresh
target/debug/doctor-probe.exe download-ffmpeg tools/ffmpeg                     # 약 190MB
```
