Read `AGENTS.md`, then `GUIDE.md`, `scene.json` and `../../DESIGN.md` in this folder, and implement the 3D scene described there as code under `src/` (entry `src/index.html`).
The animation must be a pure function of time `t`: no clock deltas, no unseeded randomness. Follow the composition, materials, lighting and camera path in `scene.json`, stay within the performance budget, take colors from `DESIGN.md` tokens, and hold the final composition for at least 0.7 seconds.
Fill empty fields of `scene.json` from the brief, but only those on the write-back whitelist, and never overwrite what the user already filled. Then run the self-check and record it in `.vanilla/self-check.md`.
Output only the working scene, with no commentary, alternatives or summaries.
