// `pnpm dist` — build a class-distribution zip of this workspace.
// Pure Node.js built-ins only (win/mac/linux, works even before `pnpm install`).
// Usage: `node scripts/pack-workspace.mjs [--out <file.zip>] [--root <folder>] [--flat]`
//
// NOTE: the npm script must be named `dist`, not `pack` — `pnpm pack` is a
// built-in (tarball with a `package/` top folder) and shadows any script.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.VANILLA_WORKSPACE_ROOT
  ? path.resolve(process.env.VANILLA_WORKSPACE_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Kept in sync with the template `.gitignore` (+ local-only / machine-specific).
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.vanilla', '.git']);
const EXCLUDE_BASENAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

function isExcludedFile(relPosix) {
  const base = relPosix.slice(relPosix.lastIndexOf('/') + 1);
  if (EXCLUDE_BASENAMES.has(base)) return true;
  if (base.endsWith('.log')) return true;
  if (base === '.env' || base.startsWith('.env.')) return true;
  return false;
}

/** Ensure plain `pnpm install` works on pnpm v11+ (D-041). Returns true when it wrote the file. */
export function ensureReleaseAgePolicy(root = ROOT) {
  const target = path.join(root, 'pnpm-workspace.yaml');
  if (fs.existsSync(target)) return false;
  fs.writeFileSync(
    target,
    `# pnpm v11+ supply-chain policy for class-distribution workspaces (D-041).\n` +
      `# Transitive DB packages (e.g. caniuse-lite via browserslist) are published every\n` +
      `# few days, so a fresh \`pnpm install\` often resolves a version younger than the\n` +
      `# default 24h gate and fails with ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION unless\n` +
      `# the recipient passes an extra flag. Class PCs must work with plain\n` +
      `# \`pnpm install\`, so the age gate is disabled here. No direct dependency is\n` +
      `# affected: this only controls how young a resolved version may be.\n` +
      `minimumReleaseAge: 0\n`,
    'utf8',
  );
  return true;
}

/** Walk the workspace and return sorted { abs, rel } entries (rel is posix, no prefix yet). */
export function collectWorkspaceFiles(root = ROOT, outAbs = null) {
  const outRel = outAbs ? path.relative(root, outAbs).split(path.sep).join('/') : null;
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    names.sort();
    for (const name of names) {
      const abs = path.join(dir, name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (rel === '' || rel.startsWith('..')) continue;
      if (outRel !== null && (rel === outRel || rel.startsWith(outRel + '/'))) continue;
      let st;
      try {
        st = fs.lstatSync(abs);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) {
        console.warn(`Warning: skipping symlink ${rel}`);
        continue;
      }
      if (st.isDirectory()) {
        const top = rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : rel;
        if (EXCLUDE_DIRS.has(top) || EXCLUDE_DIRS.has(rel)) continue;
        stack.push(abs);
        continue;
      }
      if (!st.isFile()) continue;
      if (isExcludedFile(rel)) continue;
      files.push({ abs, rel });
    }
  }
  files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return files;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(mtimeMs) {
  const d = new Date(mtimeMs);
  const year = d.getFullYear();
  const clamped = Number.isFinite(year) && year >= 1980 ? d : new Date('2020-01-01T00:00:00Z');
  const time =
    (clamped.getHours() << 11) | (clamped.getMinutes() << 5) | (Math.floor(clamped.getSeconds() / 2) & 0x1f);
  const date =
    ((clamped.getFullYear() - 1980) << 9) | ((clamped.getMonth() + 1) << 5) | clamped.getDate();
  return { time: time & 0xffff, date: date & 0xffff };
}

/** Project folder name inside the zip: package.json `name`, sanitized for paths. */
export function resolveProjectName(root = ROOT) {
  let name = '';
  try {
    name = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name ?? '';
  } catch {
    // fall back to the directory name below
  }
  const clean = String(name).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (clean) return clean;
  return path.basename(root) || 'workspace';
}

/** Minimal zip writer (deflate via built-in zlib). Returns { files, bytes }. */
export function writeZip(entries, outAbs) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const seenDirs = new Set();

  const pushDir = (dirRel, mtimeMs) => {
    if (dirRel === '' || seenDirs.has(dirRel)) return;
    seenDirs.add(dirRel);
    const name = Buffer.from(dirRel + '/', 'utf8');
    const { time, date } = dosDateTime(mtimeMs);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(0, 18);
    local.writeUInt32LE(0, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name);
    central.push({ name, crc: 0, comp: 0, uncomp: 0, method: 0, time, date, offset, dir: true });
    offset += local.length + name.length;
  };

  for (const e of entries) {
    const slash = e.rel.lastIndexOf('/');
    if (slash > 0) {
      const parts = e.rel.slice(0, slash).split('/');
      let acc = '';
      for (const p of parts) {
        acc = acc === '' ? p : `${acc}/${p}`;
        pushDir(acc, e.mtimeMs);
      }
    }
    const raw = fs.readFileSync(e.abs);
    const deflated = zlib.deflateRawSync(raw, { level: 9 });
    const useDeflate = deflated.length < raw.length;
    const data = useDeflate ? deflated : raw;
    const name = Buffer.from(e.rel, 'utf8');
    const { time, date } = dosDateTime(e.mtimeMs);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, data);
    central.push({
      name,
      crc,
      comp: data.length,
      uncomp: raw.length,
      method: useDeflate ? 8 : 0,
      time,
      date,
      offset,
      dir: false,
    });
    offset += local.length + name.length + data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) {
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(63, 4);
    head.writeUInt16LE(20, 6);
    head.writeUInt16LE(0x0800, 8);
    head.writeUInt16LE(c.method, 10);
    head.writeUInt16LE(c.time, 12);
    head.writeUInt16LE(c.date, 14);
    head.writeUInt32LE(c.crc, 16);
    head.writeUInt32LE(c.comp, 20);
    head.writeUInt32LE(c.uncomp, 24);
    head.writeUInt16LE(c.name.length, 28);
    head.writeUInt16LE(0, 30);
    head.writeUInt16LE(0, 32);
    head.writeUInt16LE(0, 34);
    head.writeUInt16LE(0, 36);
    head.writeUInt32LE(c.dir ? 0x10 | (0o40755 << 16) : 0x20 | (0o644 << 16), 38);
    head.writeUInt32LE(c.offset, 42);
    chunks.push(head, c.name);
    centralSize += head.length + c.name.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 8);
  end.writeUInt16LE(0, 10);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralStart, 16);
  chunks.push(end);

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const out = Buffer.concat(chunks);
  fs.writeFileSync(outAbs, out);
  return { files: entries.length, bytes: out.length };
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      flags.out = argv[++i];
    } else if (a === '--root' && argv[i + 1]) {
      flags.root = argv[++i];
    } else if (a === '--flat') {
      flags.flat = true;
    } else if (a === '--help' || a === '-h') {
      flags.help = true;
    }
  }
  return flags;
}

function defaultOutPath(root, folderName) {
  const stem = folderName || path.basename(root) || 'workspace';
  return path.resolve(root, '..', `${stem}.zip`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log('Usage: node scripts/pack-workspace.mjs [--out <file.zip>] [--root <folder>] [--flat]');
    console.log('');
    console.log('Builds a class-distribution zip: every entry lives under a top-level');
    console.log('folder (package.json `name` by default, `--root` to override, `--flat` for none).');
    console.log('Excludes node_modules/, dist/, .vanilla/, .git/, logs and .env files;');
    console.log('ensures pnpm-workspace.yaml (minimumReleaseAge: 0) so the recipient');
    console.log('runs plain `pnpm install`.');
    process.exit(0);
  }
  if (!fs.existsSync(path.join(ROOT, 'workspace.json'))) {
    console.error(`Error: workspace.json not found in ${ROOT}`);
    process.exit(1);
  }
  const folderName = flags.flat ? '' : flags.root || resolveProjectName(ROOT);
  const outAbs = flags.out ? path.resolve(flags.out) : defaultOutPath(ROOT, folderName);
  if (ensureReleaseAgePolicy(ROOT)) {
    console.log('Added missing pnpm-workspace.yaml (minimumReleaseAge: 0) so plain `pnpm install` works.');
  }
  if (!fs.existsSync(path.join(ROOT, 'pnpm-lock.yaml'))) {
    console.warn('Warning: pnpm-lock.yaml not found. Run `pnpm install` once before packing for reproducible installs.');
  }
  const found = collectWorkspaceFiles(ROOT, outAbs).map((f) => {
    let mtimeMs = Date.now();
    try {
      mtimeMs = fs.statSync(f.abs).mtimeMs;
    } catch {
      // fall back to now
    }
    return { ...f, rel: folderName ? `${folderName}/${f.rel}` : f.rel, mtimeMs };
  });
  if (found.length === 0) {
    console.error('Error: nothing to pack (workspace is empty or unreadable).');
    process.exit(1);
  }
  const report = writeZip(found, outAbs);
  console.log(`Packed ${report.files} files -> ${outAbs} (${report.bytes} bytes)`);
  console.log('Recipient steps: unzip, then `pnpm install`, then `pnpm dev`.');
}
