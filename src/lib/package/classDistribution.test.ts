import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import {
  collectWorkspaceFiles,
  ensureReleaseAgePolicy,
  resolveProjectName,
  writeZip,
} from '../../../resources/workspace-template/scripts/pack-workspace.mjs';

function makeWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'vanilla-pack-'));
  const write = (rel: string, content: string) => {
    const abs = join(root, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
  };
  write('workspace.json', '{"version":1}');
  write('package.json', '{"name":"demo"}');
  write('pnpm-lock.yaml', 'lockfileVersion: 9.0');
  write('scenes/intro/scene.json', '{"id":"scn_x"}');
  write('node_modules/foo/index.js', 'excluded');
  write('dist/play.html', 'excluded');
  write('.vanilla/work-order.json', 'excluded');
  write('scenes/intro/.vanilla/thumb.png', 'excluded');
  write('scenes/intro/node_modules/x/index.js', 'excluded');
  write('.git/HEAD', 'excluded');
  write('debug.log', 'excluded');
  write('.env', 'excluded');
  write('.env.local', 'excluded');
  return root;
}

/** Minimal zip reader: parse central directory, return Map<name, inflated bytes>. */
function readZip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd).toBeGreaterThanOrEqual(0);
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    expect(buf.readUInt32LE(off)).toBe(0x02014b50);
    const method = buf.readUInt16LE(off + 10);
    const comp = buf.readUInt32LE(off + 20);
    const uncomp = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
    off += 46 + nameLen + extraLen + commentLen;
    expect(buf.readUInt32LE(localOff)).toBe(0x04034b50);
    const localNameLen = buf.readUInt16LE(localOff + 26);
    const localExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtraLen;
    const data = buf.subarray(dataStart, dataStart + comp);
    const raw = method === 8 ? inflateRawSync(data) : data;
    expect(raw.length).toBe(uncomp);
    if (!name.endsWith('/')) out.set(name, Buffer.from(raw));
  }
  return out;
}

describe('class-distribution pack (D-041)', () => {
  it('excludes machine-specific output but keeps the lockfile', () => {
    const root = makeWorkspace();
    const rels = collectWorkspaceFiles(root, join(root, 'out.zip')).map((f) => f.rel);
    expect(rels).toEqual(['package.json', 'pnpm-lock.yaml', 'scenes/intro/scene.json', 'workspace.json']);
  });

  it('keeps nested dist/ content but drops nested app-state dirs', () => {
    const root = makeWorkspace();
    mkdirSync(join(root, 'assets/dist'), { recursive: true });
    writeFileSync(join(root, 'assets/dist/logo.svg'), '<svg/>');
    const rels = collectWorkspaceFiles(root, join(root, 'out.zip')).map((f) => f.rel);
    expect(rels).toContain('assets/dist/logo.svg');
    expect(rels.some((r) => r.includes('.vanilla') || r.includes('node_modules'))).toBe(false);
  });

  it('writes a readable zip with exact bytes', () => {
    const root = makeWorkspace();
    const out = join(root, 'dist-check.zip');
    const entries = collectWorkspaceFiles(root, out).map((f) => ({ ...f, mtimeMs: 1_700_000_000_000 }));
    const report = writeZip(entries, out);
    expect(report.files).toBe(4);
    const back = readZip(readFileSync(out));
    expect([...back.keys()].sort()).toEqual([
      'package.json',
      'pnpm-lock.yaml',
      'scenes/intro/scene.json',
      'workspace.json',
    ]);
    expect(back.get('workspace.json')?.toString('utf8')).toBe('{"version":1}');
  });

  it('backfills pnpm-workspace.yaml once and never overwrites it', () => {
    const root = makeWorkspace();
    expect(ensureReleaseAgePolicy(root)).toBe(true);
    expect(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')).toContain('minimumReleaseAge: 0');
    expect(ensureReleaseAgePolicy(root)).toBe(false);
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'minimumReleaseAge: 10080\n');
    expect(ensureReleaseAgePolicy(root)).toBe(false);
    expect(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')).toBe('minimumReleaseAge: 10080\n');
  });

  it('template ships the policy file and dist script wiring', () => {
    const tpl = join(__dirname, '../../../resources/workspace-template');
    const policy = readFileSync(join(tpl, 'pnpm-workspace.yaml'), 'utf8');
    expect(policy).toContain('minimumReleaseAge: 0');
    expect(policy).not.toMatch(/allowBuilds:/);
    const pkg = JSON.parse(readFileSync(join(tpl, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts.dist).toBe('node scripts/pack-workspace.mjs');
    expect(pkg.scripts.pack).toBeUndefined();
    expect(pkg.scripts['guard:path']).toBeUndefined();
    for (const cmd of ['dev', 'play', 'preview', 'build', 'check:scene', 'vanilla']) {
      expect(pkg.scripts[cmd].startsWith('node scripts/ascii-cwd.mjs ')).toBe(true);
    }
    expect(existsSync(join(tpl, 'scripts', 'ascii-cwd.mjs'))).toBe(true);
  });

  it('resolves the zip top folder from package.json name', () => {
    const root = makeWorkspace();
    writeFileSync(join(root, 'package.json'), '{"name":"my-scene","version":"0.0.0"}');
    expect(resolveProjectName(root)).toBe('my-scene');
    expect(resolveProjectName(join(root, 'missing-dir'))).not.toBe('');
  });

  it('packs a rooted zip via the CLI (no package/ top folder)', () => {
    const root = makeWorkspace();
    writeFileSync(join(root, 'package.json'), '{"name":"demo-proj","version":"0.0.0"}');
    const out = join(root, 'out.zip');
    execFileSync(process.execPath, [resolve(__dirname, '../../../resources/workspace-template/scripts/pack-workspace.mjs'), '--out', out], {
      cwd: root,
      env: { ...process.env, VANILLA_WORKSPACE_ROOT: root },
    });
    const back = readZip(readFileSync(out));
    const names = [...back.keys()].sort();
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n.startsWith('demo-proj/')).toBe(true);
    expect(names).toContain('demo-proj/workspace.json');
    expect(names).toContain('demo-proj/pnpm-workspace.yaml');
    expect(names.some((n) => n.includes('node_modules') || n.includes('.vanilla'))).toBe(false);
  });
});
