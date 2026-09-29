import { describe, expect, it } from 'vitest';
import sample from '../__fixtures__/plan.sample.json';
import { parsePlan, planSchema } from './plan';

// Test-only loose JSON so cases can mutate arbitrary paths.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
const clone = () => JSON.parse(JSON.stringify(sample)) as Loose;

function errorsOf(mutate: (p: Loose) => void): string {
  const p = clone();
  mutate(p);
  const r = parsePlan(JSON.stringify(p));
  expect(r.ok).toBe(false);
  return r.ok ? '' : r.errors.join('\n');
}

describe('plan.json schema', () => {
  it('accepts the sample plan', () => {
    const r = parsePlan(JSON.stringify(sample));
    expect(r.ok).toBe(true);
  });

  it('applies defaults for optional collections and design', () => {
    const p = planSchema.parse({
      version: 1,
      outputType: 'web',
      format: { width: 1280, height: 720 },
      concept: { title: 'T' },
      scenes: [{ id: 's1', title: 'One' }],
    });
    expect(p.design.file).toBe('DESIGN.md');
    expect(p.assets).toEqual([]);
    expect(p.scenes[0].assets).toEqual([]);
  });

  it('rejects invalid JSON', () => {
    const r = parsePlan('{oops');
    expect(r.ok).toBe(false);
  });

  it('rejects unknown keys and wrong version', () => {
    expect(errorsOf((p) => (p.extra = 1))).toContain('extra');
    expect(errorsOf((p) => (p.version = 2))).toContain('version');
  });

  it('requires fps and durationSec for video', () => {
    expect(errorsOf((p) => delete p.format.fps)).toContain('format.fps');
  });

  it('rejects fields for the wrong output type', () => {
    expect(
      errorsOf((p) => {
        p.outputType = 'web';
        p.scenes.forEach((s: Record<string, unknown>) => {
          delete s.start;
          delete s.end;
        });
      }),
    ).toContain('only for video');
  });

  it('rejects dangling references', () => {
    expect(errorsOf((p) => p.scenes[0].assets.push('nope'))).toContain('unknown asset "nope"');
    expect(errorsOf((p) => p.scenes[0].animations.push('nope'))).toContain('unknown animation');
    expect(errorsOf((p) => (p.animations[0].target = 'ghost'))).toContain('unknown target');
    expect(errorsOf((p) => (p.params[0].scope = 'ghost'))).toContain('unknown scene');
    expect(errorsOf((p) => p.assets[0].params.push('ghost'))).toContain('unknown param');
  });

  it('rejects duplicate ids', () => {
    expect(errorsOf((p) => p.assets.push({ ...p.assets[0] }))).toContain('duplicate id "logo"');
  });

  it('checks scene timing', () => {
    expect(errorsOf((p) => (p.scenes[0].end = 0))).toContain('greater than start');
    expect(errorsOf((p) => (p.scenes[1].end = 99))).toContain('exceeds format.durationSec');
    expect(errorsOf((p) => delete p.scenes[0].end)).toContain('together');
  });

  it('validates parameter defaults per type', () => {
    expect(errorsOf((p) => (p.params[0].default = 'red'))).toContain('token reference');
    expect(errorsOf((p) => (p.params[2].default = 9))).toContain('out of min..max');
    expect(
      errorsOf((p) =>
        p.params.push({ id: 'mode', scope: 'global', type: 'select', default: 'x', options: ['a'], label: 'M' }),
      ),
    ).toContain('one of options');
  });

  it('accepts every parameter type', () => {
    const p = clone();
    p.params.push(
      { id: 'flag', scope: 'global', type: 'boolean', default: true, label: 'F' },
      { id: 'pos', scope: 'global', type: 'vec2', default: [0, 1], label: 'P' },
      { id: 'pos3', scope: 'global', type: 'vec3', default: [0, 1, 2], label: 'P3' },
      { id: 'mode', scope: 'global', type: 'select', default: 'a', options: ['a', 'b'], label: 'M' },
      { id: 'tint', scope: 'global', type: 'color', default: '#FF00AA', label: 'T' },
    );
    expect(parsePlan(JSON.stringify(p)).ok).toBe(true);
  });
});
