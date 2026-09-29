import { describe, expect, it } from 'vitest';
import {
  changedStages,
  currentStage,
  initialStates,
  stageAvailability,
  transitionStage,
} from './pipelineModel';
import type { PipelineStates, StageId } from './stages';

function must(r: ReturnType<typeof transitionStage>): PipelineStates {
  if (!r.ok) throw new Error(`transition rejected: ${r.reason}`);
  return r.states;
}

const NOW = '2026-01-01T00:00:00.000Z';

describe('pipeline model', () => {
  it('starts with brief open and the rest locked', () => {
    const s = initialStates();
    expect(currentStage(s)).toBe('brief');
    expect(stageAvailability(s, 'brief')).toBe('open');
    for (const id of ['plan', 'prompts', 'build', 'review', 'export'] as StageId[]) {
      expect(stageAvailability(s, id)).toBe('locked');
    }
  });

  it('advances through the stages in order', () => {
    let s = initialStates();
    s = must(transitionStage(s, 'brief', 'done', { now: NOW }));
    expect(currentStage(s)).toBe('plan');
    expect(stageAvailability(s, 'plan')).toBe('open');
    s = must(transitionStage(s, 'plan', 'approved', { now: NOW, checkpoint: 'abc123' }));
    expect(s.plan).toMatchObject({ status: 'approved', approvedAt: NOW, checkpoint: 'abc123' });
    expect(currentStage(s)).toBe('prompts');
    s = must(transitionStage(s, 'prompts', 'approved', { now: NOW }));
    s = must(transitionStage(s, 'build', 'done', { now: NOW }));
    s = must(transitionStage(s, 'review', 'done', { now: NOW }));
    s = must(transitionStage(s, 'export', 'done', { now: NOW }));
    expect(currentStage(s)).toBeNull();
  });

  it('rejects skipping ahead, wrong verbs and no-ops', () => {
    const s = initialStates();
    expect(transitionStage(s, 'plan', 'approved')).toEqual({ ok: false, reason: 'locked' });
    expect(transitionStage(s, 'brief', 'approved')).toEqual({ ok: false, reason: 'not-approvable' });
    expect(transitionStage(s, 'brief', 'draft')).toEqual({ ok: false, reason: 'no-change' });
    const afterBrief = must(transitionStage(s, 'brief', 'done'));
    expect(transitionStage(afterBrief, 'plan', 'done')).toEqual({ ok: false, reason: 'not-completable' });
  });

  it('reopening a stage invalidates the finished stages after it', () => {
    let s = initialStates();
    s = must(transitionStage(s, 'brief', 'done', { now: NOW }));
    s = must(transitionStage(s, 'plan', 'approved', { now: NOW }));
    s = must(transitionStage(s, 'prompts', 'approved', { now: NOW }));
    const reopened = must(transitionStage(s, 'plan', 'draft', { now: NOW }));
    expect(reopened.brief.status).toBe('done');
    expect(reopened.plan).toMatchObject({ status: 'draft', approvedAt: null, checkpoint: null });
    expect(reopened.prompts.status).toBe('draft');
    expect(currentStage(reopened)).toBe('plan');
    expect(changedStages(s, reopened).map((x) => x.stage)).toEqual(['plan', 'prompts']);
  });

  it('cannot reopen a stage that was never reachable', () => {
    expect(transitionStage(initialStates(), 'review', 'draft')).toEqual({ ok: false, reason: 'no-change' });
    const s = initialStates();
    s.review = { ...s.review, status: 'done' };
    expect(transitionStage(s, 'review', 'draft').ok).toBe(true);
  });
});
