# E2E: review preview smoke (T4.21)

One scenario, no extra dependencies (Node 22 globals: `fetch`, `WebSocket`):

| file | role |
| --- | --- |
| `cdp.mjs` | minimal CDP client (list/attach/evaluate/wait, console+page error collectors) |
| `review-preview.mjs` | scenario: seed workspace+trust → open review tab → Bridge `ready` → loopback iframe → scrubber/params rendered → preview target live → no page errors |
| `run-review-preview.mjs` | supervisor: fixture prepare (`resources/project-template` + `pnpm install`), optional `pnpm tauri dev` launch, verdict + exit code |

## Run

```powershell
# 1. app already running with a CDP port, project prepared:
node tests/e2e/run-review-preview.mjs --prepare --port 9223

# 2. supervisor launches the app itself (needs an interactive Windows session for WebView2):
node tests/e2e/run-review-preview.mjs --prepare --launch dev

# 3. attach to a running app with an existing project (skips pnpm install):
node tests/e2e/run-review-preview.mjs --project C:\path\to\project
```

Env equivalents: `CDP_PORT`, `E2E_TIMEOUT_MS` (default 180000), `E2E_PROJECT`.
`pnpm test:e2e:review` runs variant 1 (attach; the app must already run with
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`).

## Preconditions

- Windows + WebView2, Node 22, `pnpm tauri dev` working (`T1.1` baseline).
- The fixture needs `node_modules/vite` (`--prepare` installs it); otherwise the
  preview server reports `not-installed` and the scenario fails at "bridge ready".
- The scenario seeds `wt_current_workspace_root` + `wt_trusted_workspaces` (the same
  localStorage keys the welcome/project UI writes) and reloads — no native dialogs.

## What it proves (T4.11–T4.14 wiring)

- `ready` arrives from the real runtime through the real `BridgeProvider` (origin check,
  `init` restore) — not a mock.
- The iframe serves from `http://127.0.0.1:<port>` (origin isolation, T4.10/T4.11).
- Scrubber (T4.13) and params panel (T4.14) render in the review tab.
- No console errors or page exceptions during the flow.
