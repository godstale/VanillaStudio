import { describe, expect, it } from 'vitest';
import notice from '../../../NOTICE.md?raw';

// T7.4: NOTICE.md must stay in sync with Feasibility-Risks §2.9.
describe('NOTICE.md license coverage', () => {
  it.each([
    'HyperFrames',
    'Apache-2.0',
    'dom-to-pptx',
    'pptxgenjs',
    'FFmpeg',
    'GPL',
    'BtbN/FFmpeg-Builds',
    'OFL',
    'CC0',
    'CREDITS.md',
    'Feasibility-Risks',
  ])('mentions %s', (keyword) => {
    expect(notice).toContain(keyword);
  });

  it('states FFmpeg is not bundled', () => {
    expect(notice).toMatch(/not bundled/i);
  });
});

// T7.7: the dependency table must match what the app actually depends on (v2).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const deps = (rel: string): string[] => Object.keys((JSON.parse(readFileSync(resolve(root, rel), 'utf8')) as { dependencies?: Record<string, string> }).dependencies ?? {});

/** A dependency counts as covered when the notice names it or its scope/family. */
const covered = (name: string): boolean => {
  if (notice.includes(name)) return true;
  const scope = name.startsWith('@') ? name.split('/')[0] : null; // `@radix-ui`, `@codemirror`, ...
  if (scope && notice.includes(`${scope}/`)) return true;
  return false;
};

describe('NOTICE.md covers every direct dependency', () => {
  it.each([
    ['package.json', deps('package.json')],
    ['packages/export-worker/package.json', deps('packages/export-worker/package.json')],
    ['packages/runtime/package.json', deps('packages/runtime/package.json')],
  ])('%s', (_file, names) => {
    const missing = names.filter((n) => !covered(n));
    expect(missing).toEqual([]);
  });

  it('names the v2 additions and the removals', () => {
    for (const k of ['@xyflow/react', 'xterm', 'portable-pty', 'CodeMirror', 'notify', '.vsx', 'Removed in v2']) expect(notice).toContain(k);
  });

  it('Rust crates that ship are covered (names from Cargo.toml)', () => {
    const lines = readFileSync(resolve(root, 'src-tauri/Cargo.toml'), 'utf8').split('\n');
    const start = lines.findIndex((l) => l.trim() === '[dependencies]');
    const crates: string[] = [];
    for (const l of lines.slice(start + 1)) {
      if (l.trim().startsWith('[')) break;
      if (l.includes('=') && !l.trim().startsWith('#')) crates.push(l.split('=')[0].trim());
    }
    const ignored = new Set(['serde_json', 'serde', 'log', 'ignore', 'regex', 'globset', 'rand', 'tokio', 'base64', 'reqwest', 'tauri-plugin-log', 'tauri-plugin-dialog', 'tauri-plugin-sql']);
    const missing = crates.filter((c) => !ignored.has(c) && !notice.includes(c));
    expect(missing).toEqual([]);
  });
});
