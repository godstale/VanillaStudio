import { describe, expect, it } from 'vitest';
import { addNode, newSequence, type Sequence } from './schema';
import { hasErrors, isAutoTrigger, validateSequence, type SceneRef } from './validate';

const TR = { type: 'crossfade', durationMs: 600, easing: 'ease-in-out', params: {} };
const edge = (from: string, to: string, trigger: string) => ({ from, to, trigger, transition: TR });

const scenes = new Map<string, SceneRef>([
  ['scn_m', { type: 'motion', name: 'Intro' }],
  ['scn_s', { type: 'static', name: 'Page' }],
  ['scn_d', { type: '3d', name: 'Globe' }],
]);
const ctx = { workspaceId: 'ws_1', scenes };

function seq(edges: Sequence['edges'], mode: Sequence['mode'] = 'interactive', ids = ['scn_m', 'scn_s', 'scn_d']): Sequence {
  let s = newSequence('ws_1');
  for (const id of ids) s = addNode(s, id, { x: 0, y: 0 });
  return { ...s, mode, edges };
}
const codes = (issues: { code: string }[]) => issues.map((i) => i.code).sort();

describe('validateSequence', () => {
  it('a valid mixed sequence has no issues', () => {
    const s = seq([edge('scn_m', 'scn_s', 'end'), edge('scn_s', 'scn_d', 'click'), edge('scn_d', 'scn_m', 'timeout:3s')], 'linear');
    // d → m auto + m → s auto + s → d click: the loop contains an input edge, so it may repeat
    expect(validateSequence(s, ctx)).toEqual([]);
  });

  it('rejects another workspace and nodes without a scene', () => {
    expect(codes(validateSequence({ ...seq([]), workspaceId: 'ws_other' }, ctx).filter((i) => i.severity === 'error'))).toEqual(['workspace-mismatch']);
    const ghost = seq([], 'interactive', ['scn_m', 'scn_ghost']);
    const issues = validateSequence(ghost, ctx);
    expect(issues.find((i) => i.code === 'unknown-scene')?.scene).toBe('scn_ghost');
    expect(hasErrors(issues)).toBe(true);
  });

  it('static scenes only move on by user input (D-032)', () => {
    for (const trigger of ['end', 'timeout:2s']) {
      const issues = validateSequence(seq([edge('scn_s', 'scn_m', trigger)]), ctx);
      expect(issues.some((i) => i.code === 'static-auto-trigger' && i.edge === 0)).toBe(true);
    }
    for (const trigger of ['click', 'key:ArrowRight', 'choice:Next']) {
      expect(validateSequence(seq([edge('scn_s', 'scn_m', trigger)]), ctx).some((i) => i.code === 'static-auto-trigger')).toBe(false);
    }
    // motion and 3d may use any trigger
    expect(validateSequence(seq([edge('scn_m', 'scn_s', 'end'), edge('scn_d', 'scn_s', 'timeout:1s')]), ctx).some((i) => i.code === 'static-auto-trigger')).toBe(false);
  });

  it('two edges with the same trigger from one scene are ambiguous', () => {
    const issues = validateSequence(seq([edge('scn_m', 'scn_s', 'choice:Go'), edge('scn_m', 'scn_d', 'choice:Go')]), ctx);
    expect(issues.filter((i) => i.code === 'duplicate-trigger')).toHaveLength(1);
    expect(issues.find((i) => i.code === 'duplicate-trigger')?.edge).toBe(1);
    expect(validateSequence(seq([edge('scn_m', 'scn_s', 'choice:A'), edge('scn_m', 'scn_d', 'choice:B')]), ctx).some((i) => i.code === 'duplicate-trigger')).toBe(false);
  });

  it('a loop made only of automatic edges would play forever', () => {
    const issues = validateSequence(seq([edge('scn_m', 'scn_d', 'end'), edge('scn_d', 'scn_m', 'end')]), ctx);
    expect(issues.filter((i) => i.code === 'auto-cycle').map((i) => i.scene).sort()).toEqual(['scn_d', 'scn_m']);
    const self = validateSequence(seq([edge('scn_m', 'scn_m', 'timeout:1s')]), ctx);
    expect(self.some((i) => i.code === 'auto-cycle')).toBe(true);
    // the same loop with one input edge is fine
    expect(validateSequence(seq([edge('scn_m', 'scn_d', 'end'), edge('scn_d', 'scn_m', 'click')]), ctx).some((i) => i.code === 'auto-cycle')).toBe(false);
  });

  it('linear mode: one way out per scene and no choices', () => {
    const branch = validateSequence(seq([edge('scn_m', 'scn_s', 'end'), edge('scn_m', 'scn_d', 'click')], 'linear'), ctx);
    expect(branch.some((i) => i.code === 'linear-branch' && i.scene === 'scn_m')).toBe(true);
    const choice = validateSequence(seq([edge('scn_s', 'scn_d', 'choice:A')], 'linear'), ctx);
    expect(choice.some((i) => i.code === 'linear-choice')).toBe(true);
    expect(validateSequence(seq([edge('scn_m', 'scn_s', 'end'), edge('scn_m', 'scn_d', 'click')], 'interactive'), ctx).some((i) => i.code === 'linear-branch')).toBe(false);
  });

  it('start must exist and every scene should be reachable from it', () => {
    const noStart = { ...seq([]), start: null };
    expect(validateSequence(noStart, ctx).some((i) => i.code === 'no-start' && i.severity === 'error')).toBe(true);
    expect(validateSequence({ ...newSequence('ws_1') }, ctx)).toEqual([]); // empty sequence is fine
    const issues = validateSequence(seq([edge('scn_m', 'scn_s', 'click')]), ctx);
    const unreachable = issues.filter((i) => i.code === 'unreachable');
    expect(unreachable.map((i) => i.scene)).toEqual(['scn_d']);
    expect(unreachable[0].severity).toBe('warning');
    expect(hasErrors(issues)).toBe(false);
  });

  it('transitions must be builtin or a declared custom one', () => {
    const withType = (type: string) => seq([{ ...edge('scn_m', 'scn_s', 'end'), transition: { ...TR, type } }]);
    expect(validateSequence(withType('mask-wipe'), ctx).some((i) => i.code === 'unknown-transition')).toBe(false);
    expect(validateSequence(withType('match-cut'), ctx).some((i) => i.code === 'unknown-transition' && i.edge === 0)).toBe(true);
    expect(validateSequence(withType('custom:swirl'), ctx).some((i) => i.code === 'unknown-transition')).toBe(true);
    expect(validateSequence(withType('custom:swirl'), { ...ctx, customTransitions: new Set(['swirl']) }).some((i) => i.code === 'unknown-transition')).toBe(false);
  });

  it('classifies triggers', () => {
    expect(['end', 'timeout:3s', 'timeout:0.5s'].every(isAutoTrigger)).toBe(true);
    expect(['click', 'key:Enter', 'choice:Yes'].some(isAutoTrigger)).toBe(false);
  });
});
