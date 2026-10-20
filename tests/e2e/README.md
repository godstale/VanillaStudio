# E2E: scene preview (T4.7)

`scene-preview.mjs` checks the preview server, the runtime and Bridge v2 in a real browser, without the Tauri app:

1. builds a workspace fixture (`resources/workspace-template` + `resources/runtime` + a sample scene) in a temp folder and runs `pnpm install`;
2. starts `resources/workers/vite-runner.mjs` on the workspace root (the same server the app starts);
3. opens a host page on another origin (`http://localhost:<port>`) whose iframe loads `scenes/demo/src/index.html?mode=preview&host=...`;
4. asserts the Bridge `ready` message (protocol v2, from the preview origin), that `init.canvas` reaches the scene's `useFrame()`, and that editing the scene hot-updates it **without a full page reload**.

```powershell
pnpm test:e2e:scene                      # fresh fixture, removed afterwards
node tests/e2e/scene-preview.mjs --keep  # keep the fixture (prints its folder)
E2E_DEBUG=1 pnpm test:e2e:scene          # also print the page console
```

Needs a local Chrome (`CHROME_PATH` overrides `C:/Program Files/Google/Chrome/Application/chrome.exe`) and `pnpm`. Not part of `pnpm test`.
