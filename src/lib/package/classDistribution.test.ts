import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import {
  collectWorkspaceFiles,
  ensureReleaseAgePolicy,
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

  it('template ships the policy file and pack script wiring', () => {
    const tpl = join(__dirname, '../../../resources/workspace-template');
    expect(readFileSync(join(tpl, 'pnpm-workspace.yaml'), 'utf8')).toContain('minimumReleaseAge: 0');
    const pkg = JSON.parse(readFileSync(join(tpl, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts.pack).toBe('node scripts/pack-workspace.mjs');
  });
});
