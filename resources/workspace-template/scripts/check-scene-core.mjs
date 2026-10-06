// Scene contract checks (T4.9, Technical-Design §4.3). Pure: no Node imports, so the app (Vite) and the
// workspace CLI (`pnpm check:scene`) run exactly the same rules.
//
// Static only. The dynamic check (same `t` rendered twice) and DOM-level Text Fidelity need a browser and are
// not run here: Text Fidelity compares `copy.items` with the source text instead of the rendered DOM.

export const MIN_END_CARD_HOLD_SECONDS = 0.7;
const TIME_EPSILON = 0.001;
const IGNORE_MARKER = 'ds-ignore';
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?|html|css)$/i;

/** @typedef {{ severity: 'error' | 'warning', rule: string, message: string, file?: string, line?: number }} Finding */

const FORBIDDEN_TIME = [
  [/\bDate\.now\s*\(/, 'Date.now() differs on every render. Use useTime().'],
  [/\bperformance\.now\s*\(/, 'performance.now() differs on every render. Use useTime().'],
  [/\bMath\.random\s*\(/, 'Math.random() is not repeatable. Use useSeededRandom(seed) or noise2D/noise3D.'],
  [/\brequestAnimationFrame\s*\(/, 'Own requestAnimationFrame loops are not driven by the Vanilla clock. Derive animation from useTime().'],
  [/\bsetInterval\s*\(/, 'setInterval is not driven by the Vanilla clock. Derive animation from useTime().'],
  [/\bnew\s+Date\s*\(\s*\)/, 'new Date() without arguments reads the wall clock. Pass an explicit timestamp.'],
];

const HEX = /(?<![\w&#/-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z_-])/gi;
const FUNC = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(([^)]*)\)?/gi;

const blank = (s) => s.replace(/[^\n]/g, ' ');
/** Comments and url(...) are not scanned; offsets and line numbers are kept. */
const maskNonCode = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)))
    .replace(/url\([^)]*\)/gi, blank);

const norm = (s) => s.replace(/\s+/g, ' ').trim();

function timeFindings(files) {
  const out = [];
  for (const [file, text] of Object.entries(files)) {
    maskNonCode(text)
      .split('\n')
      .forEach((line, i) => {
        for (const [re, message] of FORBIDDEN_TIME) if (re.test(line)) out.push({ severity: 'error', rule: 'no-forbidden-time-api', message, file, line: i + 1 });
      });
  }
  return out;
}

function colorFindings(files) {
  const out = [];
  for (const [file, text] of Object.entries(files)) {
    const raw = text.split('\n');
    maskNonCode(text)
      .split('\n')
      .forEach((line, i) => {
        if (raw[i].includes(IGNORE_MARKER) || (i > 0 && raw[i - 1].includes(IGNORE_MARKER))) return;
        const hits = [...line.matchAll(HEX)].map((m) => m[0]);
        for (const m of line.matchAll(FUNC)) if (!/var\(/i.test(m[1])) hits.push(m[0]);
        for (const value of hits) {
          out.push({
            severity: 'warning',
            rule: 'no-hardcoded-colors',
            message: `Hard-coded color ${value}. Use DESIGN.md tokens (var(--color-*) / useDesign()), or mark a deliberate exception with ds-ignore.`,
            file,
            line: i + 1,
          });
        }
      });
  }
  return out;
}

function defineSceneFindings(files) {
  const scripts = Object.entries(files).filter(([f]) => /\.[cm]?[jt]sx?$/i.test(f));
  const called = scripts.some(([, t]) => /\bdefineScene\s*\(/.test(maskNonCode(t)));
  if (!called) return [{ severity: 'error', rule: 'require-define-scene', message: 'No defineScene(...) call found in src/. A motion or 3d scene must default-export defineScene({...}).' }];
  const exported = scripts.some(([, t]) => /export\s+default\s+defineScene\s*\(/.test(t) || (/\bdefineScene\s*\(/.test(t) && /export\s+default\s+[A-Za-z_$][\w$]*\s*;?/.test(t)));
  return exported ? [] : [{ severity: 'error', rule: 'require-define-scene', message: 'defineScene(...) must be the default export of the scene module.' }];
}

function beatFindings(scene) {
  const out = [];
  const err = (rule, message) => out.push({ severity: 'error', rule, message });
  const beats = Array.isArray(scene.beats) ? scene.beats : [];
  const seconds = scene.duration?.seconds;
  if (beats.length > 0) {
    const ids = new Set();
    beats.forEach((b, i) => {
      if (ids.has(b.id)) err('beats', `duplicate beat id ${b.id}`);
      ids.add(b.id);
      if (!(b.end > b.start)) err('beats', `beats[${i}] end must be after start`);
    });
    if (Math.abs(beats[0].start) > TIME_EPSILON) err('beats', 'first beat must start at 0');
    for (let i = 1; i < beats.length; i++) {
      if (Math.abs(beats[i].start - beats[i - 1].end) > TIME_EPSILON) err('beats', `beats[${i}] must start where the previous beat ends`);
    }
    if (typeof seconds === 'number' && Math.abs(beats[beats.length - 1].end - seconds) > TIME_EPSILON) err('beats', 'beats must add up to duration.seconds');
  }
  const hold = scene.endCard?.holdSeconds;
  if (typeof hold !== 'number' || hold < MIN_END_CARD_HOLD_SECONDS) err('end-card', `endCard.holdSeconds must be >= ${MIN_END_CARD_HOLD_SECONDS}`);
  return out;
}

function textFidelityFindings(scene, files) {
  if (scene.copy?.textFidelity !== 'exact') return [];
  const items = Array.isArray(scene.copy.items) ? scene.copy.items : [];
  const haystack = norm(Object.values(files).join('\n'));
  return items
    .filter((item) => typeof item === 'string' && item.trim())
    // A string literal in code escapes quotes and newlines, so the JSON-escaped form counts as a match too.
    .filter((item) => !haystack.includes(norm(item)) && !haystack.includes(norm(JSON.stringify(item).slice(1, -1))))
    .map((item) => ({ severity: 'error', rule: 'text-fidelity', message: `copy.items text not found verbatim in src/: "${item}"` }));
}

/**
 * @param {{ scene: Record<string, any>, files: Record<string, string> }} input `files`: path -> text, src/** only.
 * @returns {Finding[]}
 */
export function checkScene({ scene, files }) {
  const src = Object.fromEntries(Object.entries(files).filter(([f]) => SOURCE_EXT.test(f)));
  const out = colorFindings(src);
  if (Object.keys(src).length === 0) out.push({ severity: 'error', rule: 'entry', message: 'src/ has no source files.' });
  if (scene.type === 'motion' || scene.type === '3d') {
    out.push(...timeFindings(src), ...defineSceneFindings(src), ...beatFindings(scene), ...textFidelityFindings(scene, src));
  }
  return out;
}

/** `.vanilla/self-check.md` body. Deterministic: no timestamps. */
export function renderSelfCheck(sceneName, findings) {
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const result = errors.length === 0 ? `Result: PASS (${plural(warnings.length, 'warning')})` : `Result: FAIL (${plural(errors.length, 'error')}, ${plural(warnings.length, 'warning')})`;
  const lines = [`# Self-check: ${sceneName}`, '', result, ''];
  for (const f of [...errors, ...warnings]) lines.push(`- [${f.severity}] ${f.rule}: ${f.message}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : ''}`);
  return `${lines.join('\n')}\n`;
}
