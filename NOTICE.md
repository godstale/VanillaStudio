# NOTICE — Vanilla Studio Third-Party Notices

Vanilla Studio itself is distributed under the MIT License (see `LICENSE`).

This file lists third-party software the app depends on, bundles, or
downloads with user consent. It mirrors `Docs/Planning/Feasibility-Risks.md`
§2.9 (the license table is the source of truth; this file is its user-facing
summary). Discrepancies are resolved in favor of §2.9 by the coordination
session.

## 0. Application dependencies (v2)

The desktop app itself (Tauri 2 + React 19) uses these direct npm and Cargo
dependencies. Everything is MIT, Apache-2.0, ISC or a compatible permissive
license unless a row says otherwise.

| Component | License | Used for |
| --- | --- | --- |
| Tauri 2 (`@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-sql`, `tauri`, `tauri-plugin-*`) | MIT or Apache-2.0 | Desktop shell, native dialogs, SQLite app state |
| `react`, `react-dom`, `react-router-dom`, `react-resizable-panels`, `react-markdown`, `remark-gfm` | MIT | UI |
| Radix UI (`@radix-ui/react-*`), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` | MIT (lucide: ISC) | UI components and icons |
| `@xyflow/react` (React Flow) | MIT | The scene canvas (keep the on-canvas attribution) |
| `@xterm/xterm`, `@xterm/addon-fit` | MIT | The embedded agent terminal |
| `portable-pty` (Rust) | MIT | Pseudo-terminal that runs the agent CLI in the scene folder |
| CodeMirror 6 (`codemirror`, `@codemirror/*`, `@lezer/highlight`) | MIT | Prompt and rules editors |
| `zod` | MIT | Data-contract validation (`scene.json`, `sequence.json`, `.vsx` manifest, Bridge messages) |
| `yaml`, `culori` | ISC / MIT | `DESIGN.md` parsing and color math |
| `notify` (Rust) | CC0-1.0 | Watching scene folders for changes |
| `tauri-plugin-window-state` (Rust) | MIT OR Apache-2.0 | Remembering window size, position and maximized state |
| `zip`, `sha2`, `hex` (Rust) | MIT or Apache-2.0 | `.vsx` packages (deterministic zip, SHA-256 manifest) and FFmpeg download verification |
| Fonts (`@fontsource-variable/geist`, `@fontsource-variable/jetbrains-mono`, `@fontsource/ibm-plex-sans-kr`) | OFL-1.1 | App UI (see section 3) |

Removed in v2 (no longer shipped): the ACP and MCP server crates
(`agent-client-protocol`, `rmcp`, `axum`), the v1 project wizard and pipeline
modules.

The export stack below (HyperFrames, `pptxgenjs`, `dom-to-pptx`, `jszip`,
`pdf-lib`, `puppeteer-core`, `@google/design.md`) is kept as code for a later
release (D-027). The v2.0 UI does not use it; the notices remain accurate for
anyone who builds those workers.

## 1. Rendering / export libraries

| Component | License | How it ships |
| --- | --- | --- |
| HyperFrames (video render, `hyperframes` CLI resolved from the user's project at export time — not bundled with the app) | Apache-2.0 | External tool, invoked as a child process with `DO_NOT_TRACK=1`, `HYPERFRAMES_SKIP_SKILLS=1` |
| three.js / React Three Fiber / pptxgenjs | MIT | npm dependencies (`@vanilla/runtime` peers, `@vanilla/export-worker`) |
| dom-to-pptx (editable-PPTX Beta) | MIT | Only the browser bundle is vendored (`resources/workers/vendor/dom-to-pptx.bundle.js`); the npm package is not a dependency because it pulls in all of puppeteer |
| `jszip` 3.10.2 (OOXML slide transplant) | MIT, used under MIT (upstream is dual-licensed MIT OR GPL-3.0-or-later) | npm dependency of `@vanilla/export-worker` |
| `pdf-lib` 1.17.1 | MIT | npm dependency of `@vanilla/export-worker` |
| `puppeteer-core` 25.12.0 (still capture; brings no browser — uses the HyperFrames-managed `chrome-headless-shell` or system Edge) | Apache-2.0 | npm dependency of `@vanilla/export-worker` |
| `@google/design.md` CLI 0.4.0 (DESIGN.md lint, version-pinned) | Apache-2.0 | npm dependency of `@vanilla/export-worker` |
| `proxy-agent` 8.x (proxy support for the `@puppeteer/browsers` download path in the export worker bundle) | MIT | npm dependency of `@vanilla/export-worker` |
| `yaml` | ISC | npm dependency |
| `culori` | MIT | npm dependency |
| Rust crates (`reqwest`, `sha2`, `hex`, `zip`, `winreg`, `windows-sys`, `schemars`, `tauri`, plugins, …) | MIT or Apache-2.0 | Cargo dependencies |
| Built-in palettes (`resources/palettes/`, 24 kinds) | CC0 (made in-house; no external color combinations copied) | Bundled resources |

GSAP is intentionally **not** used by the app (D-007). Generated project code
may use it under its own license at the user's discretion.

## 2. FFmpeg — downloaded only with consent (GPL build)

FFmpeg is **not bundled** with the installer.

- When video export needs it, the app asks for consent first (Doctor screen)
  and downloads a **win64 GPL static build** (libx264 is GPL) from
  `BtbN/FFmpeg-Builds` GitHub releases, pinned to a major line.
- Install location: `<app data>/tools/ffmpeg/` (system PATH is untouched).
- The download is SHA-256 verified; on hash mismatch or cancel nothing is
  left behind. The build's `LICENSE.txt` is extracted next to the binaries.
- An LGPL build can only do WebM; MP4 (libx264) requires the GPL build (S1).
- Legal review before distribution is recommended (Feasibility-Risks §2.9).

## 3. Fonts (OFL)

The app UI and generated projects use SIL Open Font License 1.1 fonts via
Fontsource (bundled with the app):

- Geist Variable (`@fontsource-variable/geist`) — OFL-1.1
- JetBrains Mono Variable (`@fontsource-variable/jetbrains-mono`) — OFL-1.1
- IBM Plex Sans KR (`@fontsource/ibm-plex-sans-kr`) — OFL-1.1

Editable-PPTX export notes: PowerPoint ignores embedded web fonts, so the
used font files are attached next to the output with an install note
(`slidesEditable.ts`, FONTS-README).

## 4. User materials

External resources (fonts, textures, icons) added to a user project must be
open-licensed and recorded in that project's `CREDITS.md` (D-006; generative
image/video AI services are not integrated).

## 5. Full license texts

- Apache-2.0 / MIT / ISC / OFL-1.1: see each package (`node_modules/<pkg>/`,
  Cargo registry sources) and `LICENSE.txt` next to the FFmpeg binaries.
- This NOTICE is also shown in the app: Settings → App → Open-source notices.
