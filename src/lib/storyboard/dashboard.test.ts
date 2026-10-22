import { describe, expect, it } from 'vitest';
import { sceneEdges, sceneOrder, stepCountOf, summarizeValues, transitionSummary, triggerSummary } from './dashboard';
import type { Scene } from '@/lib/scene/schema';
import { addNode, newSequence } from '@/lib/sequence/schema';

const TR = { type: 'crossfade', durationMs: 600, easing: 'ease-in-out', params: {} };
const SLIDE = { type: 'slide-left', durationMs: 800, easing: 'ease-in-out', params: {} };

function seq() {
  let s = newSequence('ws_1');
  for (const id of ['a', 'b', 'c']) s = addNode(s, id, { x: 0, y: 0 });
  return {
    ...s,
    start: 'a',
    edges: [
      { from: 'a', to: 'b', trigger: 'key:ArrowRight', transition: { ...TR } },
      { from: 'b', to: 'c', trigger: 'key:ArrowRight', transition: { ...SLIDE } },
      { from: 'a', to: 'c', trigger: 'click', transition: { ...TR } },
    ],
  };
}

describe('storyboard dashboard', () => {
  it('summarizes repeated values with counts', () => {
    expect(summarizeValues(['key:ArrowRight', 'key:ArrowRight', 'click'])).toBe('key:ArrowRight ×2 · click');
    expect(summarizeValues([])).toBe('');
  });

  it('summarizes triggers and transitions of a sequence', () => {
    const s = seq();
    expect(triggerSummary(s)).toBe('key:ArrowRight ×2 · click');
    expect(transitionSummary(s)).toBe('crossfade ×2 · slide-left');
    expect(triggerSummary(null)).toBe('');
    expect(transitionSummary({ ...s, edges: [] })).toBe('');
  });

  it('reports node order and per-scene edges', () => {
    const s = seq();
    expect(sceneOrder(s, 'b')).toBe(1);
    expect(sceneOrder(s, 'zzz')).toBe(-1);
    expect(sceneOrder(null, 'a')).toBe(-1);
    const mid = sceneEdges(s, 'b');
    expect(mid).toEqual({ order: 1, incoming: ['crossfade · key:ArrowRight'], outgoing: ['slide-left · key:ArrowRight'] });
    expect(sceneEdges(s, 'a').incoming).toEqual([]);
    expect(sceneEdges(s, 'c').outgoing).toEqual([]);
    expect(sceneEdges(null, 'a')).toEqual({ order: -1, incoming: [], outgoing: [] });
  });

  it('counts steps for static scenes and beats for timed scenes', () => {
    const steps = { type: 'static', mode: 'steps', steps: [{ id: 'p1' }] } as unknown as Scene;
    const scroll = { type: 'static', mode: 'scroll', steps: [] } as unknown as Scene;
    const motion = { type: 'motion', beats: [{ id: 'b1' }, { id: 'b2' }] } as unknown as Scene;
    expect(stepCountOf(steps)).toBe(1);
    expect(stepCountOf(scroll)).toBe(1);
    expect(stepCountOf(motion)).toBe(2);
  });
});
