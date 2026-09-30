# Export / preview workers

Shipped to the installed app via `tauri.conf.json` (`"../resources/workers"`
→ `resources/workers`) and resolved by
`src-tauri/src/commands/export_commands.rs` (`resolve_worker_script`, dev
fallback: `<repo>/resources/workers/<name>`).

| File | What | Source |
| --- | --- | --- |
| `vanilla-export.mjs` | Export worker bundle: `node vanilla-export.mjs <job.json>` (NDJSON on stdout; exit 0 done, 2 cancelled, 1 failed) and `design-lint <DESIGN.md>` | Built, do not edit: `pnpm --filter @vanilla/export-worker run build` (entry `packages/export-worker/src/cli-entry.ts`, single self-contained ESM file, reproducible across rebuilds) |
| `vite-runner.mjs` | Preview dev server: `node vite-runner.mjs --root <project>` | Source (T4.10) |
| `vendor/dom-to-pptx.bundle.js` | Browser bundle for editable PPTX (Beta, T5.7; MIT). Resolved from the worker script directory (`slidesEditable.resolveVendorBundle`), so it must stay next to `vanilla-export.mjs` | Vendored (npm package pulls in all of puppeteer) |

Rebuild the bundle after any `packages/export-worker/src/**` change and
commit it with the source change (like `resources/runtime/`).
