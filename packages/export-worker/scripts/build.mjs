// Build the distributable export worker (W1 fix): `node scripts/build.mjs [outDir]`,
// default `resources/workers`. Mirrors `packages/runtime/scripts/build.mjs`.
//
// The Rust backend spawns exactly `node <app>/workers/vanilla-export.mjs <job.json>`
// (`src-tauri/src/commands/export_commands.rs`), so the bundle file name is part
// of the backend contract and covered by `scripts/build.test.ts`.
//
//   vanilla-export.mjs  all of `src/` (minus tests) plus every npm dependency,
//                       bundled — `resources/workers` ships no `node_modules`.
//                       `vendor/dom-to-pptx.bundle.js` and `vite-runner.mjs`
//                       already live here, so the output dir is never wiped.
// `tauri.conf.json` `bundle.resources` already maps `../resources/workers`,
// so the new file ships in the installer with no T7.1 change needed.
import { builtinModules } from 'node:module';
import { mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The shipped bundle is always a production bundle: Vitest (and other test
// runners) set NODE_ENV=test, which flips Vite's export-condition resolution
// and produced a bundle that crashed on load (unguarded `bufferutil` stub
// from `ws`). Forced (not `??=`): the caller's test env must never leak into
// the shipped artifact. Set before Vite is imported (static imports hoist).
process.env.NODE_ENV = 'production';
const { build } = await import('vite');

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(pkgDir, '../..');
const outDir = path.resolve(process.argv[2] ?? path.join(repoRoot, 'resources', 'workers'));

mkdirSync(outDir, { recursive: true });

await build({
  configFile: false,
  root: pkgDir,
  logLevel: 'warn',
  build: {
    ssr: true,
    outDir,
    // vite-runner.mjs + vendor/ live here; never wipe them.
    emptyOutDir: false,
    minify: false,
    target: 'node20',
    rollupOptions: {
      input: path.join(pkgDir, 'src', 'cli-entry.ts'),
      external: [...builtinModules, /^node:/],
      // Single file: the backend resolves exactly one script path, and the
      // install dir ships no chunk graph to keep in sync.
      output: { format: 'es', entryFileNames: 'vanilla-export.mjs', inlineDynamicImports: true },
    },
  },
  // Bundle every npm dependency (jszip, pptxgenjs, pdf-lib, puppeteer-core,
  // zod, @google/design.md); only Node built-ins stay external.
  ssr: { noExternal: true },
});

const files = readdirSync(outDir);
console.log(`export worker -> ${outDir} (vanilla-export.mjs; ${files.length} entries in dir)`);
