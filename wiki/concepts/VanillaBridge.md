---
title: 'VanillaBridge'
type: concept
tags: [protocol, review]
sources: [technical-design]
last_updated: 2026-09-28
---

앱(호스트)과 미리보기 iframe 사이의 postMessage 프로토콜 `{v:1,type,payload}`. host→scene: init/play/pause/seek/setParams/goto/capture, scene→host: ready/time/error. iframe은 별도 origin(127.0.0.1:port)으로 Tauri IPC와 격리. PoC S4. 관련: [[SceneRuntimeContract]]

## Discussed In

- [[technical-design]] — §5
