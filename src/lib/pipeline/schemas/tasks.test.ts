import { describe, expect, it } from 'vitest';
import { findCycle, topoSort } from '../topo';
import { parseTasks } from './tasks';

const task = (id: string, dependsOn: string[] = [], extra: Record<string, unknown> = {}) => ({
  id,
  kind: 'asset',
  target: `${id}-target`,
  prompt: `prompts/assets/${id}.md`,
  dependsOn,
  ...extra,
});
const text = (tasks: unknown[]) => JSON.stringify({ tasks });

describe('topoSort', () => {
  it('orders dependencies first and keeps declaration order for ties', () => {
    const r = topoSort([
      { id: 'c', dependsOn: ['a', 'b'] },
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: [] },
      { id: 'd', dependsOn: ['c'] },
    ]);
    expect(r).toEqual({ ok: true, order: ['a', 'b', 'c', 'd'] });
  });

  it('is deterministic', () => {
    const nodes = [
      { id: 'x', dependsOn: [] },
      { id: 'y', dependsOn: [] },
      { id: 'z', dependsOn: ['y'] },
    ];
    expect(topoSort(nodes)).toEqual(topoSort([...nodes]));
  });

  it('reports a cycle path', () => {
    const r = topoSort([
      { id: 'a', dependsOn: ['c'] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['b'] },
      { id: 'ok', dependsOn: [] },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.cycle[0]).toBe(r.cycle[r.cycle.length - 1]);
      expect(new Set(r.cycle)).toEqual(new Set(['a', 'b', 'c']));
    }
  });

  it('detects a self loop and returns no cycle for a DAG', () => {
    expect(findCycle([{ id: 'a', dependsOn: ['a'] }])).toEqual(['a', 'a']);
    expect(
      findCycle([
        { id: 'a', dependsOn: [] },
        { id: 'b', dependsOn: ['a'] },
      ]),
    ).toEqual([]);
  });

  it('handles an empty list', () => {
    expect(topoSort([])).toEqual({ ok: true, order: [] });
  });
});

describe('tasks.json schema', () => {
  it('accepts a valid file and returns execution order', () => {
    const r = parseTasks(
      text([
        task('T03', ['T01', 'T02'], { kind: 'scene' }),
        task('T01'),
        task('T02', ['T01'], { kind: 'animation' }),
        { id: 'T04', kind: 'compose', prompt: 'prompts/00-master.md', dependsOn: ['T03'] },
      ]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order).toEqual(['T01', 'T02', 'T03', 'T04']);
  });

  it('rejects invalid JSON, unknown keys, unknown kind', () => {
    expect(parseTasks('nope').ok).toBe(false);
    expect(parseTasks(text([task('T01', [], { extra: 1 })])).ok).toBe(false);
    expect(parseTasks(text([task('T01', [], { kind: 'bogus' })])).ok).toBe(false);
  });

  it('rejects duplicate ids, unknown and self dependencies', () => {
    const dup = parseTasks(text([task('T01'), task('T01')]));
    expect(!dup.ok && dup.errors.join()).toContain('duplicate id');
    const unknown = parseTasks(text([task('T01', ['T99'])]));
    expect(!unknown.ok && unknown.errors.join()).toContain('unknown task "T99"');
    const self = parseTasks(text([task('T01', ['T01'])]));
    expect(!self.ok && self.errors.join()).toContain('itself');
  });

  it('rejects cycles', () => {
    const r = parseTasks(text([task('T01', ['T02']), task('T02', ['T01'])]));
    expect(!r.ok && r.errors.join()).toContain('dependency cycle');
  });

  it('rejects unsafe or non-markdown prompt paths', () => {
    for (const prompt of ['../x.md', 'C:/x.md', '/abs.md', 'prompts/a.txt']) {
      expect(parseTasks(text([task('T01', [], { prompt })])).ok).toBe(false);
    }
  });

  it('requires a target except for compose', () => {
    const r = parseTasks(text([{ id: 'T01', kind: 'scene', prompt: 'prompts/scenes/a.md' }]));
    expect(!r.ok && r.errors.join()).toContain('required for scene');
  });
});
