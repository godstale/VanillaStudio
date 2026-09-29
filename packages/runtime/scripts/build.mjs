// Build the distributable runtime (T4.9): `node scripts/build.mjs [outDir]`, default `resources/runtime`.
// The app scaffolds it into every project as `vanilla/runtime/` (dependency `link:./vanilla/runtime`).
//
//   src/**        shipped as TypeScript source (Vite compiles it; agents can read the API). Tests excluded.
//   vite.js       the design-token Vite plugin bundled with the app's DESIGN.md parser (src/lib/design),
//                 so the project needs neither the app source nor yaml/culori.
//   package.json  exports point at the shipped files; version comes from this package.
// The output is deterministic: no timestamps, sorted copies.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(pkgDir, '../..');
const outDir = path.resolve(process.argv[2] ?? path.join(repoRoot, 'resources', 'runtime'));
const source = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const isTest = (name) => /\.test\.(ts|tsx)$/.test(name);
cpSync(path.join(pkgDir, 'src'), path.join(outDir, 'src'), {
  recursive: true,
  filter: (from) => statSync(from).isDirectory() || !isTest(path.basename(from)),
});

await build({
  configFile: false,
  root: pkgDir,
  logLevel: 'warn',
  build: {
    ssr: true,
    outDir,
    emptyOutDir: false,
    minify: false,
    target: 'node20',
    rollupOptions: {
      input: { vite: path.join(pkgDir, 'vite.ts') },
      external: ['vite', /^node:/],
      output: { format: 'es', entryFileNames: '[name].js' },
    },
  },
  // Bundle yaml, zod and culori into the plugin; only vite and Node built-ins stay external.
  ssr: { noExternal: true },
});

writeFileSync(
  path.join(outDir, 'vite.d.ts'),
  `import type { Plugin } from 'vite';

/** Serves the project's DESIGN.md as the virtual module \`virtual:vanilla/design\` (hot-updated). */
export declare function vanillaDesign(file?: string): Plugin;
`,
);

const deployed = {
  name: source.name,
  private: true,
  version: source.version,
  type: 'module',
  main: 'src/index.ts',
  exports: {
    '.': './src/index.ts',
    './app': './src/app.tsx',
    './design': './src/designFile.tsx',
    './vite': { types: './vite.d.ts', default: './vite.js' },
  },
  dependencies: source.dependencies,
  peerDependencies: Object.fromEntries(Object.entries(source.peerDependencies).filter(([k]) => k !== 'eslint')),
};
writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(deployed, null, 2) + '\n');

const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
console.log(`runtime ${source.version} -> ${outDir} (${files(outDir).length} files)`);
