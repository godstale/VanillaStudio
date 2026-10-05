# AGENTS.md — {{workspaceName}}

- Workspace: {{workspaceName}}
- workspaceId: {{workspaceId}}

This folder is one Vanilla Studio workspace = one sequence. Work only inside this folder (cwd and below).
Do not use generative image/video AI services. Record every external resource in `CREDITS.md` (open licenses only).

## One sequence per workspace

- This workspace holds exactly one sequence (`sequence.json`). A different sequence belongs in a new workspace.
- Bring scenes from another workspace by copying them; never link to them.
- Never change `workspaceId` in any file.

## Files

| Path | Owner | Rule |
| --- | --- | --- |
| `workspace.json` | app | Workspace id, name, canvas (aspect, resolution, fps). Do not edit. |
| `sequence.json` | app | Scene graph and transitions. Do not edit. |
| `DESIGN.md` | user | Design tokens. Colors, type and spacing come only from here. |
| `scenes/<slug>/scene.json` | app | Scene spec. Read it; do not edit. |
| `scenes/<slug>/GUIDE.md`, `AGENTS.md`, `prompts/` | app | Generated; edit only outside the app markers. |
| `scenes/<slug>/src/` | you | The scene implementation. |
| `scenes/<slug>/params/*.values.json` | user | Never overwrite without an explicit request. |
| `scenes/<slug>/references/` | user | Style references. Analyze only; never copy into deliverables. |
| `.vanilla/` | app | Do not touch. |

Canvas size and fps come from `workspace.json`; do not hard-code them.
