// @vitest-environment node
// Bundle regression test (W1 fix): the Rust backend resolves
// `resources/workers/vanilla-export.mjs` and fails the job with
// `worker-not-found` when it is missing, so building the bundle and
// smoke-running its fixed argv is the contract test.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('export worker bundle (vanilla-export.mjs)', () => {
  it('builds into the Rust-expected path and answers the fixed argv', () => {
    const out = mkdtempSync(path.join(tmpdir(), 'vanilla-export-bundle-'));
    try {
      execFileSync(process.execPath, [path.join(pkgDir, 'scripts', 'build.mjs'), out], { stdio: 'pipe' });
      const bundle = path.join(out, 'vanilla-export.mjs');
      expect(existsSync(bundle)).toBe(true);
      // `node vanilla-export.mjs <job.json>`: --help exits 0 without a job file.
      execFileSync(process.execPath, [bundle, '--help'], { stdio: 'pipe' });
      // An invalid job exits 1 with an NDJSON error (never a crash).
      try {
        execFileSync(process.execPath, [bundle, 'no-such-job.json'], { stdio: 'pipe' });
        expect.unreachable('bundle should exit 1 for a missing job file');
      } catch (e) {
        expect((e as { status?: number }).status).toBe(1);
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 180_000);
});
