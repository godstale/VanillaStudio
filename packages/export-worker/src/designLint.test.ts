// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DESIGN_MD_CLI_VERSION, designLint, summarize } from './designLint';

const repo = path.resolve(__dirname, '../../..');
const defaultDesign = path.join(repo, 'resources/design/DESIGN.md');
const tmp = mkdtempSync(path.join(tmpdir(), 'vanilla-lint-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const write = (name: string, content: string) => {
  const p = path.join(tmp, name);
  writeFileSync(p, content);
  return p;
};

describe('designLint (real CLI)', () => {
  it('lints the default DESIGN.md: no errors, orphaned-tokens filtered (matches the sample result)', async () => {
    const r = await designLint(defaultDesign);
    expect(r).toEqual(JSON.parse(readFileSync(path.join(__dirname, '__fixtures__/design-lint.sample.json'), 'utf8')));
    expect(r.status === 'ok' && r.cliVersion).toBe(DESIGN_MD_CLI_VERSION);
  }, 30_000);

  it('reports errors for an invalid color (CLI exits 1 but still prints the report)', async () => {
    const r = await designLint(write('bad.md', '---\nname: x\ncolors:\n  primary: "#zzz"\n---\n# x\n'));
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.passed).toBe(false);
    expect(r.summary.errors).toBe(1);
    expect(r.findings[0].path).toBe('colors.primary');
  }, 30_000);

  it('the pinned CLI version matches package.json', () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@google/design.md']).toBe(DESIGN_MD_CLI_VERSION);
  });

  it('degrades to "unavailable" for a missing file', async () => {
    const r = await designLint(path.join(tmp, 'nope.md'));
    expect(r.status).toBe('unavailable');
  }, 30_000);

  it('rejects relative paths (including "-", which would make the CLI read stdin)', async () => {
    expect((await designLint('-')).status).toBe('unavailable');
    expect((await designLint('DESIGN.md')).status).toBe('unavailable');
  });
});

describe('designLint (fake CLI)', () => {
  const cli = (name: string, body: string) => write(name, body);

  it('closes stdin so a CLI waiting for input cannot hang', async () => {
    const script = cli('stdin.mjs', "process.stdin.on('end', () => console.log(JSON.stringify({ findings: [] }))); process.stdin.resume();");
    const r = await designLint(defaultDesign, { cliPath: script, timeoutMs: 5000 });
    expect(r.status).toBe('ok');
  });

  it('kills a CLI that never finishes', async () => {
    const script = cli('hang.mjs', 'setInterval(() => {}, 1000);');
    const r = await designLint(defaultDesign, { cliPath: script, timeoutMs: 300 });
    expect(r).toMatchObject({ status: 'unavailable' });
    expect(r.status === 'unavailable' && r.reason).toMatch(/timed out/);
  });

  it('treats garbage output as unavailable', async () => {
    const script = cli('garbage.mjs', "console.log('not json'); process.exit(3);");
    const r = await designLint(defaultDesign, { cliPath: script });
    expect(r.status === 'unavailable' && r.reason).toMatch(/no usable report \(exit 3\)/);
  });

  it('filters ignored rules, counts them, and does not pass API keys or tracking on', async () => {
    const script = cli(
      'env.mjs',
      `const leaked = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY'].filter((k) => process.env[k]);
console.log(JSON.stringify({ findings: [
  { severity: 'warning', message: 'orphan', rule: 'orphaned-tokens', path: 'colors.a' },
  { severity: 'warning', message: 'leaked:' + leaked.join(',') + ' dnt:' + process.env.DO_NOT_TRACK },
  { severity: 'error', message: 'boom' },
] }));`,
    );
    const r = await designLint(defaultDesign, { cliPath: script, env: { ...process.env, GEMINI_API_KEY: 'secret', ANTHROPIC_API_KEY: 'secret' } });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.filtered).toBe(1);
    expect(r.passed).toBe(false);
    expect(r.summary).toEqual({ errors: 1, warnings: 1, infos: 0 });
    expect(r.findings[0].message).toBe('leaked: dnt:1');
  });
});

describe('summarize', () => {
  it('counts by severity', () => {
    expect(summarize([{ severity: 'error', message: 'a' }, { severity: 'info', message: 'b' }, { severity: 'info', message: 'c' }])).toEqual({ errors: 1, warnings: 0, infos: 2 });
  });
});
