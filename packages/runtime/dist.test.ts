// T4.9: the committed `resources/runtime` is what the build produces, and the project template wires it up.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseProjectManifest } from '../../src/lib/migrate/legacy-schema';

const repo = path.resolve(__dirname, '../..');
const shipped = path.join(repo, 'resources/runtime');
const template = path.join(repo, 'resources/project-template');
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, Record<string, string> & { version?: string }>;

const listFiles = (dir: string, base = dir): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')]))
    .sort();
// Git may check text files out with CRLF; compare content, not line endings.
const text = (p: string) => readFileSync(p, 'utf8').split('\r\n').join('\n');

describe('resources/runtime (T4.9)', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'vanilla-runtime-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('is up to date with packages/runtime (run `pnpm --filter @vanilla/runtime build`)', () => {
    execFileSync(process.execPath, [path.join(__dirname, 'scripts/build.mjs'), tmp], { cwd: __dirname, stdio: 'pipe' });
    const built = listFiles(tmp);
    expect(listFiles(shipped)).toEqual(built);
    for (const f of built) expect(text(path.join(shipped, f)), f).toBe(text(path.join(tmp, f)));
  }, 60_000);

  it('ships no tests and every export target exists', () => {
    expect(listFiles(shipped).filter((f) => /\.test\./.test(f))).toEqual([]);
    const pkg = json(path.join(shipped, 'package.json'));
    const targets = Object.values(pkg.exports).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v as unknown as Record<string, string>)));
    for (const t of targets) expect(existsSync(path.join(shipped, t)), t).toBe(true);
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', './app', './design', './vite']);
  });

  it('bundles the DESIGN.md parser into vite.js (no reach into the app source)', () => {
    const bundle = readFileSync(path.join(shipped, 'vite.js'), 'utf8');
    expect(bundle).not.toMatch(/from ["']\.\.?\//);
    expect(bundle).not.toMatch(/from ["'](yaml|zod|culori)/);
  });
});

describe('project template runtime wiring', () => {
  const version = json(path.join(__dirname, 'package.json')).version as unknown as string;

  it('vanilla.json records the shipped runtime version and stays valid', () => {
    const manifest = readFileSync(path.join(template, 'vanilla.json'), 'utf8').replace('{{projectName}}', 'demo').replace('{{createdAt}}', '2026-09-29T00:00:00.000Z');
    const r = parseProjectManifest(manifest);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    expect(r.ok && r.manifest.runtime.version).toBe(version);
    expect(json(path.join(shipped, 'package.json')).version).toBe(version as never);
  });

  it('package.json links the runtime and provides its dependencies and peers', () => {
    const deps = json(path.join(template, 'package.json')).dependencies;
    expect(deps['@vanilla/runtime']).toBe('link:./vanilla/runtime');
    const runtime = json(path.join(shipped, 'package.json'));
    for (const name of [...Object.keys(runtime.dependencies), ...Object.keys(runtime.peerDependencies)]) expect(deps[name], name).toBeTruthy();
  });

  it('vite.config.ts loads the design plugin and main.tsx mounts the composition', () => {
    expect(text(path.join(template, 'vite.config.ts'))).toContain("from '@vanilla/runtime/vite'");
    const main = text(path.join(template, 'src/main.tsx'));
    expect(main).toContain("from '@vanilla/runtime/app'");
    expect(main).toContain("from './composition'");
    expect(existsSync(path.join(template, 'src/composition.tsx'))).toBe(true);
  });
});
