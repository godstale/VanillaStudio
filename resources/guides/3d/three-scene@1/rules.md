# Rules: 3D animation scene (three.js / React Three Fiber)

You implement a 3D animated scene as code under `src/` (entry `src/index.html`) from `scene.json`. The animation is **deterministic**: the same time `t` always renders the same frame.

## 0. Runtime contract

- Drive everything from `t` given by `useTime()`: object transforms, material parameters, light intensities, camera. No `Date.now()`, no `performance.now()` for animation, no `clock.getDelta()`, no unseeded `Math.random()` (derive any randomness from an index and a fixed seed), no physics engine that integrates over real time. Where simulation-like motion is needed, compute it analytically from `t` (closed forms, keyframe tables, or a fixed-step loop recomputed from 0 to `t`).
- Rendering is on-demand: render a frame for a given `t` and finish it (textures loaded, shaders compiled) before reporting ready. Do not rely on `requestAnimationFrame` accumulation.
- Canvas size and fps come from `workspace.json`. Total length is `duration.seconds`.
- Colors come from `DESIGN.md` tokens (`useDesign()`); do not hard-code color values in materials or lights.
- No network or CDN dependencies at runtime. Record every external model, texture, HDRI and font in `CREDITS.md` with source and open license. Prefer procedural geometry and textures.

## 1. Scene composition

- Field: `composition`. Describe the scene graph: ground or backdrop, hero object(s), supporting objects, scale relationships and the focal point. Keep units consistent (1 unit = 1 meter unless stated).
- One clear focal point per beat. Prefer simple, readable silhouettes over detail the viewer cannot see.

## 2. Materials

- Field: `materials`. Name every material and its behavior: base color from tokens, roughness, metalness, transmission, emissive, texture use. Use physically plausible values (`MeshStandardMaterial` / `MeshPhysicalMaterial`). Avoid more materials than the scene needs.
- Glass and transmission are expensive; use them only on hero objects and cap the number of transmissive layers.

## 3. Lighting

- Field: `lighting`. Define key, fill and rim light or an environment, with direction, intensity and color temperature. Shadows only where they help; set shadow map size and bias explicitly. Any lighting change over time is a function of `t`.

## 4. Camera path

- Field: `cameraPath`. Describe the path as keyframes (time, position, look-at, field of view) with easing between them, computed from `t`. Keep the focal subject in frame, avoid sudden direction reversals, and keep motion smooth (ease-in-out) unless the style asks otherwise.
- Hold the camera still for the last 0.7 seconds when the scene ends on a hero composition.

## 5. Beats and timing

- Fields: `beats[]`, `duration.seconds`. Beats start at 0, are contiguous, and the last `end` equals the duration. Each beat has a role, a camera move, object motion and a transition out. Match density to length: about one visual beat per 2–3 seconds.

## 6. Post-processing

- Use post effects (bloom, depth of field, vignette, tone mapping) sparingly and only when they serve the style; each one must be deterministic and affordable. Prefer a single tone-mapping choice for the whole scene.

## 7. Performance budget

- Field: `performanceBudget`. Respect it. Defaults when empty: at most 100k triangles in view, at most 3 real-time lights, one shadow-casting light, texture sizes at most 2048, no per-frame allocations, instanced meshes for repeated objects, dispose of unused geometry and textures.
- A frame must render in well under the frame time of the workspace fps on a mid-range GPU; if a feature threatens that, simplify it.

## 8. Text and copy

- If the scene shows text, render it exactly as written in `copy.items` (immutable): no rewriting, translating or spelling fixes; Hangul syllable blocks stay whole. Prefer HTML/CSS overlay text for sharpness.

## 9. References and identity

- References are style references only; never copy or embed them. Keep a product's identifying traits (silhouette, proportions, materials, logo placement) when `identity` asks for it.

## 10. End

- Hold the final composition for at least 0.7 seconds (`endCard.holdSeconds`); nothing new appears in the hold.

## 11. Write-back

- You may fill empty fields on the write-back whitelist (`composition`, `materials`, `lighting`, `cameraPath`, `performanceBudget`, `beats`, and the shared timed fields). Never overwrite what the user filled.

## 12. Output

- Deliver working code under `src/` and the filled `scene.json` fields. No commentary, alternatives or summaries unless the user asked.
