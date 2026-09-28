---
title: 'PoC S4: WebView2 iframe 미리보기 + Vanilla Bridge'
type: source
tags: [poc, phase-p3, preview, bridge, security]
date: 2026-09-29
source_file: spikes/s4-webview-iframe/README.md
sources: [feasibility-risks, technical-design]
last_updated: 2026-09-29
---

## Summary

**결론: 통과.** Tauri 2 창(WebView2, Edge 153) 안의 iframe에 별도 origin(`http://127.0.0.1:5199`)의 Vite dev server를 띄웠다. 확인한 항목은 다음과 같다.

- postMessage Bridge로 파라미터 변경·seek가 p95 34ms 안에 화면에 반영됐다.
- HMR은 약 27ms에 반영됐고, 그동안 상태가 유지됐다.
- iframe은 Tauri IPC를 쓸 수 없었다. IPC 스크립트는 주입되지만 ACL이 origin 검사로 거부했다.

추가로 **빠른 연속 쓰기(30ms 간격)에서 HMR이 마지막 변경을 놓치는** 경쟁 조건을 발견해 설계에 대응을 넣었다.

## 결과

| 기준 | 결과 |
| --- | --- |
| iframe 표시 | ✅ `ready` 약 620ms(콜드 로드 포함) |
| 파라미터 변경 반영 < 100ms | ✅ `setParams` 왕복 p50 33.3ms / p95 33.5ms / max 46ms (60회, 2프레임 대기 포함) |
| seek 반영 | ✅ p50 33.3ms / p95 33.5ms |
| HMR | ✅ 파일 쓰기 → 새 모듈 렌더 p50 27ms / max 43ms, React Fast Refresh로 파라미터·시간 상태 유지 |
| IPC 격리 | ✅ 아래 표 |

**IPC 격리 상세 (iframe 안에서 시도)**

| 시도 | 결과 |
| --- | --- |
| `window.__TAURI_INTERNALS__` | **존재함(object)**. WebView2가 초기화 스크립트를 모든 프레임에 주입한다 |
| 앱 명령 `invoke('touch_preview')` | 거부: `touch_preview not allowed. Plugin not found` |
| 플러그인 명령 `invoke('plugin:app\|version')` | 거부: `not allowed on … URL: http://127.0.0.1:5199/ — allowed on: [windows: "main", URL: local]` |
| `fetch('http://ipc.localhost/…')` | 500 |
| `window.parent.document`, `window.parent.__TAURI_INTERNALS__` | `SecurityError`(cross-origin) |

## 발견한 문제와 해결 (Pitfalls)

1. **IPC 스크립트가 iframe에도 주입됨**
   - 안전성은 스크립트 부재가 아니라 **capability ACL(로컬 origin 한정)**에서 나온다.
   - 따라서 capability에 `remote.urls`로 `http://127.0.0.1:*`나 `http://localhost:*`를 절대 넣지 않는다. 미리보기와 같은 origin 패턴을 허용하면 사용자 프로젝트 코드가 앱 명령을 호출할 수 있다.
   - 개발 모드의 host는 `http://localhost:1430`이다. 미리보기는 반드시 `127.0.0.1`로 띄워 origin을 구분한다.
2. **HMR이 연속 쓰기를 놓침**
   - 증상: 같은 모듈을 30ms 간격으로 두 번 쓰면 두 번째 변경이 끝내 반영되지 않았다(0ms·100ms·300ms 간격은 정상). 에이전트가 파일을 연달아 저장하면 미리보기가 **오래된 상태**로 남을 수 있다.
   - 대응(설계 반영): 앱이 프로젝트 파일 변경을 직접 감시한다. 변경이 500ms 멈추면 미리보기에 반영됐는지 확인한다.
     - 런타임 Vite 플러그인이 `vite:afterUpdate`로 갱신된 모듈 목록을 Bridge `hmr`로 보고한다.
     - 앱의 파일 변경 기록과 비교해 누락이 있으면 전체 새로고침한 뒤 `init`으로 파라미터·시각을 복원한다.
     - 빌드 태스크가 끝날 때는 항상 이 확인을 거친다.
3. **Vite 캐시 공유 충돌(검증 환경 한정)**
   - 같은 `node_modules`를 쓰는 두 dev server가 `.vite` 캐시를 서로 무효화해 `504 Outdated Optimize Dep`가 났다.
   - 실제 앱은 사용자 프로젝트마다 `node_modules`가 따로 있어 해당 없다. 같은 폴더에서 서버 두 개를 띄울 때는 `cacheDir`를 분리한다.
4. **Fast Refresh 경계**
   - `createRoot().render()`를 하는 부트스트랩 모듈이 Scene을 직접 정의하면, 수정할 때 전체 새로고침이 된다.
   - 부트스트랩(`src/main.tsx`, 앱 소유)과 Scene 모듈(컴포넌트만 export)을 분리하는 설계가 맞다.
   - Bridge 리스너는 effect cleanup으로 해제해야 Fast Refresh 때 중복 등록되지 않는다.

## 기타 관찰

- 미리보기의 `targetOrigin`: 첫 host 메시지를 받기 전의 `ready`는 `'*'`로 보낸다(민감 정보 없음). 이후에는 수신한 host origin으로 고정한다.
- **CDP 디버깅**: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>`로 WebView2에 CDP로 붙을 수 있고, OOPIF iframe도 별도 타깃으로 보인다(`cdp-probe.mjs`). 원인 분석에 결정적이었고, P5 자동 E2E 테스트 도구로도 쓸 수 있다.
- 템플릿 CSP에는 `frame-src`가 없다. 앱에 `frame-src http://127.0.0.1:*`를 추가해야 한다.

## 설계 반영

- 기술 설계서:
  - §5 Bridge: S4 ⚠️를 해소했다. `hmr` 메시지와 HMR 누락 대응을 추가했고, 격리 원칙을 "IPC 스크립트 주입 + ACL 거부"로 정정했다.
  - §10 보안: capability에 원격 URL 금지를 명시했다.
  - §11 테스트: CDP 기반 E2E를 추가했다.
- 리스크 문서 §2.6·§3 진행 현황을 갱신했다.

## Connections

- [[VanillaBridge]], [[PermissionPolicy]], [[SceneRuntimeContract]], [[technical-design]], [[feasibility-risks]]
