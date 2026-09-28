---
title: 'VanillaBridge'
type: concept
tags: [protocol, review]
sources: [technical-design]
last_updated: 2026-09-29
---

앱(호스트)과 미리보기 iframe 사이의 postMessage 프로토콜 `{v:1,type,payload}`. host→scene: init/play/pause/seek/setParams/goto/capture, scene→host: ready/time/error. iframe은 별도 origin(127.0.0.1:port)으로 Tauri IPC와 격리. PoC S4. 관련: [[SceneRuntimeContract]]

## Discussed In

- [[technical-design]] — §5

## Pitfalls (PoC S4, [[poc-s4]])

- WebView2는 Tauri IPC 스크립트를 iframe에도 주입한다. 격리는 capability ACL(로컬 origin 한정)이 담당하므로 `remote.urls`에 localhost 계열을 넣지 않는다.
- 같은 모듈을 30ms 간격으로 연속 쓰면 HMR이 마지막 변경을 놓친다. 앱이 파일 감시와 `hmr` 보고를 비교하고, 누락 시 `reload` + `init`으로 복원한다.
- 첫 host 메시지 전에는 host origin을 모르므로 `ready`만 `'*'`로 보내고, 이후에는 수신한 origin으로 고정한다.
