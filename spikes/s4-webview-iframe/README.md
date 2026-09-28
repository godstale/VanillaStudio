# S4 — Tauri WebView2 안 iframe으로 프리뷰 서버 표시 + Vanilla Bridge

PoC 결과: `wiki/sources/poc-s4.md`

## 구성

- `host/`: 앱 창 역할(Vite, :1430). iframe(`sandbox="allow-scripts allow-same-origin"`, `http://127.0.0.1:5199`)을 띄운다.
  - Bridge 메시지를 보내 왕복 시간을 재고, 결과를 Rust `report` 명령으로 저장한다.
- `preview-app/`: 사용자 프로젝트 역할(Vite + React + R3F, :5199).
  - Bridge 수신(origin 검사), `setParams`·`seek`를 적용한 뒤 2프레임 후 `applied`로 응답한다.
  - `label.ts`가 바뀌면 `label`을 알리고, `isolationCheck`로 IPC 격리를 확인한다.
- `src-tauri/`: 최소 Tauri 2 앱.
  - CSP에 `frame-src http://127.0.0.1:*`를 넣었다. capability는 `main` 창 로컬 origin만 대상이다.
  - 명령: `touch_preview`(HMR 유발용 파일 쓰기), `report`
- `run.mjs`: preview 서버 → `tauri dev` → `out/result.json` 대기 → 프로세스 트리 종료
- `cdp-probe.mjs`: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`으로 WebView2에 CDP 연결. 페이지·iframe의 콘솔·예외·DOM을 수집한다.

## 실행

```powershell
pnpm install --ignore-workspace
node run.mjs          # 결과: out/result.json
# 디버깅: $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'; node cdp-probe.mjs 60 (별도 창)
```
