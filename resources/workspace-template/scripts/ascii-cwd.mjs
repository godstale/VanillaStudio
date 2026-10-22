// `node scripts/ascii-cwd.mjs <cmd> [args...]` — ASCII-cwd launcher (D-043).
//
// On Windows + Node 22, requiring/importing certain files crashes the process
// (exit 3221225477) when a related path contains certain non-ASCII characters
// (e.g. 한글 `숲`; `가`/`관`/`글`/`검` are fine, most other syllables crash).
// The crash is inside Node's resolver/loader native code: no in-JS workaround
// exists, and alias tricks (junction, subst, --preserve-symlinks) do not help
// because resolution canonicalizes to the Korean real path anyway.
// What the launcher does when cwd is non-ASCII (Windows only):
// - pure-JS workspace scripts (`node scripts/*.mjs`: check:scene, vanilla-agent,
//   pack-workspace) run from an ASCII junction alias pointing at the workspace
//   (same files, ASCII cwd) — verified working on 한글 paths;
// - `vite` (dev/play/build/preview) cannot run: it exits here with the
//   move-to-ASCII-path message instead of a raw segfault.
//
// This file uses core modules only (`node:fs/os/path/crypto/child_process`),
// which resolve fine under a non-ASCII cwd, so the launcher itself never crashes.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readlinkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** True when every character is ASCII (printable range check is unnecessary here). */
export function isAscii(value) {
  return /^[\x00-\x7F]*$/.test(value);
}

/** Stable ASCII junction name for a workspace path (hex hash, concurrency-safe reuse). */
export function aliasNameFor(cwd) {
  return `vanilla-ws-${createHash('sha1').update(cwd).digest('hex').slice(0, 12)}`;
}

/** First ASCII-only base from candidates, or null when none qualifies. */
export function pickAsciiBase(bases) {
  return bases.find((b) => typeof b === 'string' && b !== '' && isAscii(b)) ?? null;
}

function candidateBases(cwd) {
  const bases = [tmpdir()];
  if (process.platform === 'win32') {
    if (process.env.SystemRoot) bases.push(join(process.env.SystemRoot, 'Temp'));
    bases.push(join(parse(cwd).root, 'vanilla-alias'));
  }
  return bases;
}

function stripNtPrefix(p) {
  return p.replace(/^\\\\\?\\/, '');
}

function sameDir(a, b) {
  return stripNtPrefix(resolve(a)).toLowerCase() === stripNtPrefix(resolve(b)).toLowerCase();
}

/** Ensure an ASCII junction alias for a non-ASCII cwd. Returns the alias or null. */
export function ensureAsciiAlias(cwd) {
  for (const base of candidateBases(cwd)) {
    if (!isAscii(base)) continue;
    for (let n = 0; n < 4; n++) {
      const alias = join(base, n === 0 ? aliasNameFor(cwd) : `${aliasNameFor(cwd)}-${n}`);
      try {
        mkdirSync(base, { recursive: true });
        let st = null;
        try {
          st = lstatSync(alias);
        } catch {
          st = null;
        }
        if (st !== null) {
          if (sameDir(readlinkSync(alias), cwd)) return alias;
          continue; // occupied by something else: try the next suffix
        }
        // 'junction' needs no elevation (unlike 'dir' symlinks) and handles
        // non-ASCII targets; core fs only, so this never crashes (D-043).
        symlinkSync(cwd, alias, 'junction');
        return alias;
      } catch {
        // base not writable: try the next candidate
      }
    }
  }
  return null;
}

/** True when the command needs Vite (bundler + native deps crash on non-ASCII paths). */
export function needsVite(cmd, rest) {
  return `${cmd} ${rest[0] ?? ''}`.includes('vite');
}

function asciiAdvice(cwd) {
  console.error('[vanilla] Non-ASCII path: Vite cannot run here (upstream Node crash, exit 3221225477).');
  console.error(`Move this folder to an ASCII-only path and run again (e.g. C:/class/my-work). Cwd: ${cwd}`);
  console.error('Pure-JS commands (pnpm check:scene, pnpm vanilla, pnpm dist) work on this path.');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd) {
    console.error('Usage: node scripts/ascii-cwd.mjs <cmd> [args...]');
    process.exit(2);
  }
  const cwd = process.cwd();
  let runCwd = cwd;
  if (process.platform === 'win32' && !isAscii(cwd)) {
    if (needsVite(cmd, rest)) {
      asciiAdvice(cwd);
      process.exit(1);
    }
    const alias = ensureAsciiAlias(cwd);
    if (!alias) {
      asciiAdvice(cwd);
      process.exit(1);
    }
    runCwd = alias;
  }
  const result = spawnSync(cmd, rest, { cwd: runCwd, stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(result.status ?? 1);
}
