import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import plugin, { colorLiterals, findHardcodedColors } from './index';
import { noForbiddenTimeApi } from './rules/noForbiddenTimeApi';
import { noHardcodedColors } from './rules/noHardcodedColors';
import { requireDefineScene } from './rules/requireDefineScene';

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

const free = { vanilla: { sceneType: 'web' } };
const clock = { vanilla: { sceneType: 'video' } };

tester.run('no-forbidden-time-api', noForbiddenTimeApi, {
  valid: [
    { code: 'const t = useTime();' },
    { code: 'const r = useSeededRandom(3).at(0);' },
    { code: 'const d = new Date(1700000000000);' },
    { code: 'const x = Foo.now();' },
    { code: 'const m = obj.performance.mark();' },
    // free-mode types are allowed to use real time, rAF and intervals
    { code: 'const n = Date.now(); const r = Math.random(); requestAnimationFrame(f); setInterval(g, 10); performance.now();', settings: free },
    { code: 'requestAnimationFrame(f);', settings: { vanilla: { sceneType: 'interactive' } } },
  ],
  invalid: [
    { code: 'const n = Date.now();', errors: [{ messageId: 'forbidden' }] },
    { code: 'const n = performance.now();', settings: clock, errors: [{ messageId: 'forbidden' }] },
    { code: 'const n = window.performance.now();', errors: [{ messageId: 'forbidden' }] },
    { code: 'const n = globalThis.Date.now();', errors: [{ messageId: 'forbidden' }] },
    { code: 'const r = Math.random();', errors: [{ messageId: 'forbidden' }] },
    { code: 'const f = Math.random;', errors: [{ messageId: 'forbidden' }] },
    { code: 'requestAnimationFrame(loop);', errors: [{ messageId: 'forbidden' }] },
    { code: 'window.requestAnimationFrame(loop);', settings: { vanilla: { sceneType: 'slides' } }, errors: [{ messageId: 'forbidden' }] },
    { code: 'setInterval(tick, 16);', errors: [{ messageId: 'forbidden' }] },
    { code: 'const d = new Date();', errors: [{ messageId: 'bareDate' }] },
    { code: 'const d = Date();', errors: [{ messageId: 'bareDate' }] },
    // unknown scene type is treated as the strict clock contract
    { code: 'Math.random();', settings: { vanilla: { sceneType: 'mystery' } }, errors: [{ messageId: 'forbidden' }] },
    { code: 'const a = Date.now() + Math.random();', errors: [{ messageId: 'forbidden' }, { messageId: 'forbidden' }] },
  ],
});

tester.run('no-hardcoded-colors', noHardcodedColors, {
  valid: [
    { code: 'const s = { background: "var(--color-canvas)" };' },
    { code: 'const c = useDesign().colors.primary;' },
    { code: 'const s = "rgb(var(--ink-rgb) / 50%)";' },
    { code: 'const x = `${a}px #${id}`;' },
    { code: 'const anchor = "#section-title";' },
    { code: 'import x from "#abc123";' },
    { code: 'const c = "#ff0000"; // ds-ignore shader constant' },
    { code: '// ds-ignore\nconst c = "#ff0000";' },
    { code: 'const a = 1;\nconst c = "rgba(0, 0, 0, 0.5)"; /* ds-ignore alpha overlay */' },
    { code: 'const n = 1234567;' },
  ],
  invalid: [
    { code: 'const c = "#ff0000";', errors: [{ messageId: 'hardcoded', data: { value: '#ff0000' } }] },
    { code: 'const c = "#FFF";', errors: [{ messageId: 'hardcoded' }] },
    { code: 'const c = "#ff000080";', errors: [{ messageId: 'hardcoded' }] },
    { code: 'const c = "rgb(0, 0, 0)";', errors: [{ messageId: 'hardcoded' }] },
    { code: 'const c = "hsl(200 50% 40%)";', errors: [{ messageId: 'hardcoded' }] },
    { code: 'const c = "oklch(0.7 0.1 200)";', errors: [{ messageId: 'hardcoded' }] },
    { code: 'const s = `border: 1px solid #333`;', errors: [{ messageId: 'hardcoded' }] },
    { code: 'const el = <div style={{ color: "#123456" }} />;', errors: [{ messageId: 'hardcoded' }] },
    { code: 'const el = <meshStandardMaterial color="#f2c230" />;', errors: [{ messageId: 'hardcoded' }] },
    { code: 'const s = "a #fff b #000";', errors: [{ messageId: 'hardcoded' }, { messageId: 'hardcoded' }] },
    // the marker only reaches the next line
    { code: '// ds-ignore\nconst a = 1;\nconst c = "#ff0000";', errors: [{ messageId: 'hardcoded' }] },
  ],
});

tester.run('require-define-scene', requireDefineScene, {
  valid: [
    { code: 'export default defineScene({ id: "a", Component });' },
    { code: 'const scene = defineScene({ id: "a", Component });\nexport default scene;' },
    { code: 'import { defineScene } from "@vanilla/runtime";\nexport const params = {};\nexport default defineScene({ id: "a", params, Component });' },
  ],
  invalid: [
    { code: 'export default function Scene() { return null; }', errors: [{ messageId: 'missing' }] },
    { code: 'const x = 1;', errors: [{ messageId: 'missing' }] },
    { code: 'defineScene({ id: "a", Component });', errors: [{ messageId: 'notDefault' }] },
    { code: 'const scene = defineScene({ id: "a", Component });\nexport default function Other() {}', errors: [{ messageId: 'notDefault' }] },
    { code: 'const scene = defineScene({ id: "a", Component });\nconst other = 1;\nexport default other;', errors: [{ messageId: 'notDefault' }] },
  ],
});

describe('color scanning', () => {
  it('finds hex and functional literals with positions, skipping variables', () => {
    expect(colorLiterals('a #fff b rgb(1,2,3) c rgb(var(--x) / 2) d #12345').map((m) => m.value)).toEqual(['#fff', 'rgb(1,2,3)']);
  });

  it('scans CSS: comments, url() and ds-ignore lines are exempt', () => {
    const css = [
      '.a { color: #ff0000; }',
      '.b { color: var(--color-ink); }',
      '/* #00ff00 in a comment */',
      '.c { background: url(#gradient); }',
      '.d { color: rgb(0 0 0 / 50%); /* ds-ignore */ }',
      '/* ds-ignore */',
      '.e { color: #123; }',
      '.f { border: 1px solid hsl(10 20% 30%); }',
      '.g { fill: url("data:image/svg+xml;utf8,<svg fill=\'#abc\'/>"); }',
    ].join('\n');
    expect(findHardcodedColors(css)).toEqual([
      { line: 1, column: 13, value: '#ff0000' },
      { line: 8, column: 24, value: 'hsl(10 20% 30%)' },
    ]);
  });
});

describe('plugin', () => {
  it('exposes the rules and a recommended config wired to them', () => {
    expect(Object.keys(plugin.rules ?? {}).sort()).toEqual(['no-forbidden-time-api', 'no-hardcoded-colors', 'require-define-scene']);
    const [config] = plugin.configs.recommended;
    expect(config.plugins?.vanilla).toBe(plugin);
    expect(config.rules).toMatchObject({ 'vanilla/no-forbidden-time-api': 'error', 'vanilla/no-hardcoded-colors': 'warn', 'vanilla/require-define-scene': 'error' });
  });
});
