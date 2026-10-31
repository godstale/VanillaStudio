<!-- vanilla:begin:workspace -->
# AGENTS.md — LLM_and_Vibe_Coding_Day01_v2

- Workspace: LLM_and_Vibe_Coding_Day01_v2
- workspaceId: ws_e794b37e9b5ff1e5

This folder is one Vanilla Studio workspace = one sequence (`sequence.json`). Work only inside this folder (cwd and below).
Do not use generative image/video AI services. Record every external resource in `CREDITS.md` (open licenses only).

## Core Principle: Agent-Led Creation & Studio-Assisted Refinement

- **AI Agent is the primary creator**: You design and generate the sequence (`sequence.json`), individual scenes (`scenes/<slug>/`), design tokens (`DESIGN.md`), and React/Three.js implementations (`scenes/<slug>/src/`).
- **Vanilla Studio is the review & refinement studio**: The user inspects your generated scenes in Vanilla Studio, plays the sequence, adjusts parameters/guide fields/palettes, and leaves revision comments.
- **Work Order synchronization**: Every change or comment the user makes in Vanilla Studio is recorded in `WORK_ORDER.md` (backed by `.vanilla/work-order.json` and `scenes/<slug>/comments.json`). Always read `WORK_ORDER.md` (or run `pnpm vanilla work-order`) before starting an iteration.

## Standard 5-Stage Agent Workflow (Material-First)

### Stage 0: Worldview & Intent (세계관·의도 좁히기)
When the user gives an initial request (often just `WORK_ORDER.md`):
1. Define the work title and core value in **one sentence** (`storyboard/storyboard.json` → `brief.title`, `brief.oneLiner`).
2. Run `pnpm vanilla templates --intent <web|image|slide|motion>` and `pnpm vanilla taxonomy` to pick the best template / Opus preset / design taxonomy with the user.

### Stage 1: Three Documents First (글 3개 먼저 쓰기)
Before any code, write with `pnpm vanilla init-storyboard`:
- `storyboard/01-brief.md` (기획서: purpose, in-scope, **non-goals**), `storyboard/02-design-flow.md` (설계서: narrative arc, data schemas, assembly plan), `storyboard/03-visual-direction.md` (비주얼 디렉션: mood, invariant A vs variant B, taxonomy), plus `storyboard/storyboard.json` and `DESIGN.md`.
- Split invariants (공통 불변: material, light, framing) from variants (개별 가변: shape, specs).

### Stage 2: Core Materials First (핵심 재료 먼저 만들기)
Build data before components — never hard-code copy/specs in component code:
- `storyboard/data/content.json` (위계형 문구: Hero → Tagline → Brand values → Sections), `storyboard/data/items.json` (도메인·스펙·낮/밤 에셋 매핑).
- Mirror user-facing copy into each scene's `scene.json`: timed scenes (`motion`/`3d`) use `copy.items` (plus per-beat `beats[].copy`); static scenes use per-step `steps[].copy` (static scenes have no top-level `copy` field).

### Stage 3: Bottom-Up Assembly (작은 단위부터 조립)
Follow `02-design-flow.md` assembly plan in order:
1. Data bindings (`storyboard/data/` reference), 2. smallest units (`ProductCard`, `BrandValueCard`), 3. starter grids (`line-grid-2to1`, `continuity-filter-grid`) into sections/beats, 4. scenes (`scenes/<slug>/src/`) + `sequence.json`. Verify with `pnpm check:scene`.

### Stage 4: Root-Cause Iteration (원인 문서 역추적 수정)
When the user leaves comments or changes styles in Vanilla Studio:
1. Read `WORK_ORDER.md` / `pnpm vanilla work-order` — each item carries a root-cause layer (`brief` / `design-flow` / `visual-direction` / `materials` / `scene-polish`).
2. Update the **cause document** (`01` / `02` / `03`) and `data/*.json` first, then let the change flow down to components and scene code.
3. Mark completed items `done` via `pnpm vanilla resolve <id>` (or `--all`).

## Files & Ownership Rules

| Path | Role | Agent Rule |
| --- | --- | --- |
| `AGENTS.md`, `CLAUDE.md` | Root agent instructions | Read first. Keep markers intact. |
| `VANILLA_GUIDE.md` | Full studio guide, schema & parameter reference, template/palette catalog with preview images & demo URLs | Read to understand schemas, runtime APIs, and available templates. |
| `storyboard/storyboard.json`, `storyboard/01-brief.md`, `storyboard/02-design-flow.md`, `storyboard/03-visual-direction.md` | 3-document storyboard source (기획·설계·비주얼) | Write before code (`pnpm vanilla init-storyboard`); fix cause documents before scene code. |
| `storyboard/data/content.json`, `storyboard/data/items.json` | Core materials (위계형 문구·도메인 데이터) | Build before components; never hard-code copy in components. |
| `WORK_ORDER.md`, `.vanilla/work-order.json` | Work order log of user edits in Vanilla Studio + open comments | Read before every task; resolve completed items via `pnpm vanilla resolve <id>`. |
| `workspace.json` | Workspace id, name, global canvas (`aspect`, `width`, `height`, `fps`) | Read canvas spec via `useFrame()`; never change `workspaceId`. |
| `sequence.json` | Sequence graph (`mode`, `nodes[]`, `edges[]`, `start`) | Create/update when structuring scenes & transitions. Static scenes only allow user-input edge triggers (`click`, `key:*`, `choice:*`). |
| `DESIGN.md` | Design system tokens (`colors`, mood, typography, spacing) | Use `var(--color-*)` or `useDesign()` in scenes. Never hard-code raw colors. |
| `scenes/<slug>/scene.json` | Structured scene specification | Scaffold via `pnpm vanilla scaffold-scene` or edit and run `pnpm vanilla sync-guides <slug>`. |
| `scenes/<slug>/GUIDE.md`, `AGENTS.md`, `prompts/` | Generated scene guide & prompt files | Re-rendered via `pnpm vanilla sync-guides <slug>`. Preserve markers. |
| `scenes/<slug>/comments.json` | Per-scene user revision comments (`open` / `done`) | Read and resolve via `pnpm vanilla resolve <commentId>`. |
| `scenes/<slug>/src/` | Scene React/Three.js implementation (`@vanilla/runtime`) | Your primary implementation directory. Entry is `src/index.html`. |
| `scenes/<slug>/params/*.values.json` | User-tuned parameter values | Never overwrite without an explicit user request. |
| `scenes/<slug>/references/` | Style references & `analysis/` | Style analysis only; never copy or embed reference assets into deliverables. |
| `transitions/<name>.json` | Custom declarative scene transitions | Declarative keyframes JSON only (no scripts). |
| `.vanilla/resources/` | Offline copy of Vanilla Studio templates, Opus catalog, glossaries, palettes | Queried by `pnpm vanilla ...` or read directly. |

## Vanilla Studio ↔ Agent CLI Commands (`pnpm vanilla`)

Run these commands from the workspace root (`node scripts/vanilla-agent.mjs <cmd>` or `pnpm vanilla <cmd>`):

```bash
pnpm vanilla status                                              # Workspace, sequence, scenes & work-order summary
pnpm vanilla storyboard                                         # Storyboard stage, 3-doc summaries, data & assembly plan
pnpm vanilla init-storyboard [--intent web]                     # Scaffold storyboard/ (3 docs + storyboard.json + data)
pnpm vanilla taxonomy [--category layout] [--query <keyword>]    # Map intent to storyboard taxonomy IDs + hints
pnpm vanilla templates [--intent motion] [--type motion]         # Browse templates, Opus presets, palettes & preview URLs
pnpm vanilla inspect-template <id>                               # Inspect full template rules, defaults, hints & demo links
pnpm vanilla scaffold-scene <slug> --name "Intro" --type motion  # Create a new scene folder + draft code + add to sequence.json
pnpm vanilla sync-guides [<slug>]                                # Re-render GUIDE.md & scene AGENTS.md after editing scene.json
pnpm vanilla work-order                                          # View open user changes & comments from WORK_ORDER.md
pnpm vanilla resolve <id|--all>                                  # Mark a work-order item (chg_*) or comment (cmt_*) as done
pnpm check:scene                                                 # Verify runtime determinism & token contract across scenes
```

## Runtime Summary (`@vanilla/runtime`)

Scenes are built on `@vanilla/runtime` (`vanilla/runtime/`).
- Entry `scenes/<slug>/src/index.html` loads `src/main.tsx` which calls `mountVanilla(composition)` from `@vanilla/runtime/app`.
- **Motion & 3D scenes**: Animate strictly as a pure function of `useTime()` (seconds). Same `t` must produce the exact same frame (no `Date.now()`, `performance.now()`, unseeded `Math.random()`, `setInterval`, or manual `requestAnimationFrame` loops).
- **Static scenes**: Advance only on user input (`useSteps()` with `click`, `key:<Key>`, `choice:<label>`).
- **Canvas size & fps**: Read with `useFrame()`; never hard-code pixel dimensions.
- **Design tokens**: Use CSS `var(--color-canvas)`, `var(--color-ink)`, `var(--color-primary)`, `var(--color-accent)` or `useDesign()`.
- **Adjustable parameters**: Declare `params: { ... }` in `defineScene` using `param.color()`, `param.number()`, `param.text()`, `param.boolean()`, `param.select()` and read with `useParams()`.
<!-- vanilla:end:workspace -->
