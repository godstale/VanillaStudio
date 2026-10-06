import { describe, expect, it } from 'vitest';
import { checkScene, renderSelfCheck } from '../../../resources/workspace-template/scripts/check-scene-core.mjs';

const motion = (over: Record<string, unknown> = {}) => ({
  type: 'motion',
  name: 'Intro',
  duration: { seconds: 4 },
  beats: [
    { id: 'a', start: 0, end: 2 },
    { id: 'b', start: 2, end: 4 },
  ],
  copy: { textFidelity: 'exact', items: ['Hello World'] },
  endCard: { holdSeconds: 0.85, elements: [] },
  ...over,
});
const goodSrc = {
  'src/index.html': '<div id="root"></div>',
  'src/main.tsx': "const title = 'Hello World';\nexport default defineScene({ title });\n",
};
const rules = (f: { rule: string }[]) => f.map((x) => x.rule);

describe('checkScene', () => {
  it('passes a clean motion scene', () => {
    expect(checkScene({ scene: motion(), files: goodSrc })).toEqual([]);
  });

  it.each([
    ['Date.now()', 'const t = Date.now();'],
    ['performance.now()', 'const t = performance.now();'],
    ['Math.random()', 'const r = Math.random();'],
    ['requestAnimationFrame', 'requestAnimationFrame(tick);'],
    ['setInterval', 'setInterval(f, 10);'],
    ['new Date()', 'const d = new Date();'],
  ])('rejects %s in a motion scene', (_n, code) => {
    const f = checkScene({ scene: motion(), files: { ...goodSrc, 'src/anim.ts': code } });
    expect(rules(f)).toContain('no-forbidden-time-api');
    expect(f.find((x) => x.rule === 'no-forbidden-time-api')).toMatchObject({ file: 'src/anim.ts', line: 1, severity: 'error' });
  });

  it('allows seeded dates and ignores commented-out calls', () => {
    const f = checkScene({ scene: motion(), files: { ...goodSrc, 'src/a.ts': 'const d = new Date(0);\n// Date.now()\n/* Math.random() */' } });
    expect(rules(f)).not.toContain('no-forbidden-time-api');
  });

  it('time rules do not apply to static scenes (free mode)', () => {
    const f = checkScene({ scene: { type: 'static', name: 'P' }, files: { 'src/main.tsx': 'setInterval(f, 1000);' } });
    expect(f).toEqual([]);
  });

  it('warns on hard-coded colors, accepts tokens and ds-ignore', () => {
    const f = checkScene({
      scene: { type: 'static', name: 'P' },
      files: {
        'src/a.css': '.a { color: #ff0000; background: rgb(0 0 0); }\n.b { color: var(--color-ink); }\n/* ds-ignore */\n.c { color: #00ff00; }\n.d { fill: rgb(var(--x) / 50%); }',
      },
    });
    expect(f.filter((x) => x.rule === 'no-hardcoded-colors').map((x) => x.line)).toEqual([1, 1]);
    expect(f.every((x) => x.severity === 'warning')).toBe(true);
  });

  it('requires a default-exported defineScene in motion/3d', () => {
    expect(rules(checkScene({ scene: motion(), files: { 'src/main.tsx': 'export default {}' } }))).toContain('require-define-scene');
    const named = "const s = defineScene({});\nexport default s;\nconst x = 'Hello World';";
    expect(rules(checkScene({ scene: motion(), files: { 'src/main.tsx': named } }))).not.toContain('require-define-scene');
    expect(rules(checkScene({ scene: motion(), files: { 'src/main.tsx': "defineScene({});const x='Hello World'" } }))).toContain('require-define-scene');
  });

  it('validates beats and the end card', () => {
    const gap = checkScene({ scene: motion({ beats: [{ id: 'a', start: 0, end: 1 }, { id: 'b', start: 2, end: 4 }] }), files: goodSrc });
    expect(gap.filter((x) => x.rule === 'beats').length).toBeGreaterThan(0);
    const short = checkScene({ scene: motion({ endCard: { holdSeconds: 0.5, elements: [] } }), files: goodSrc });
    expect(rules(short)).toContain('end-card');
    const sum = checkScene({ scene: motion({ duration: { seconds: 5 } }), files: goodSrc });
    expect(sum.some((x) => x.message.includes('add up'))).toBe(true);
  });

  it('text fidelity: exact copy must appear verbatim, adapt is skipped', () => {
    const missing = checkScene({ scene: motion({ copy: { textFidelity: 'exact', items: ['Hello World', 'Buy now'] } }), files: goodSrc });
    expect(missing.filter((x) => x.rule === 'text-fidelity').map((x) => x.message)).toEqual(['copy.items text not found verbatim in src/: "Buy now"']);
    const adapt = checkScene({ scene: motion({ copy: { textFidelity: 'adapt', items: ['Buy now'] } }), files: goodSrc });
    expect(rules(adapt)).not.toContain('text-fidelity');
    const escaped = checkScene({ scene: motion({ copy: { textFidelity: 'exact', items: ['Say "hi"'] } }), files: { ...goodSrc, 'src/t.ts': 'const s = "Say \\"hi\\"";' } });
    expect(rules(escaped)).not.toContain('text-fidelity');
  });

  it('reports an empty src/', () => {
    expect(rules(checkScene({ scene: { type: 'static', name: 'P' }, files: {} }))).toContain('entry');
  });
});

describe('renderSelfCheck', () => {
  it('is deterministic and lists errors before warnings', () => {
    const findings = [
      { severity: 'warning' as const, rule: 'no-hardcoded-colors', message: 'w', file: 'src/a.css', line: 2 },
      { severity: 'error' as const, rule: 'beats', message: 'e' },
    ];
    const a = renderSelfCheck('Intro', findings);
    expect(a).toBe(renderSelfCheck('Intro', findings));
    expect(a).toBe('# Self-check: Intro\n\nResult: FAIL (1 error, 1 warning)\n\n- [error] beats: e\n- [warning] no-hardcoded-colors: w (src/a.css:2)\n');
    expect(renderSelfCheck('X', [])).toContain('Result: PASS (0 warnings)');
  });
});
