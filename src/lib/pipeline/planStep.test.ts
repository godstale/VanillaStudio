import { describe, expect, it, vi } from 'vitest';
import sample from './__fixtures__/plan.sample.json';
import designSample from '@/lib/design/__fixtures__/DESIGN.md?raw';
import type { StopReason } from '@/lib/agents/types';
import {
  PLAN_MAX_RETRIES,
  buildPlanRequest,
  buildPlanRetry,
  runPlanFlow,
  validatePlanArtifacts,
  type PlanArtifactSnapshot,
} from './planStep';

const VALID: PlanArtifactSnapshot = {
  planJson: JSON.stringify(sample),
  designMd: designSample,
  planMd: '# Plan\n\nConcept, mood, scenes.',
};

describe('validatePlanArtifacts', () => {
  it('accepts a valid triple', () => {
    const v = validatePlanArtifacts(VALID);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.plan?.concept.title).toBeTruthy();
  });

  it('reports missing files', () => {
    const v = validatePlanArtifacts({ planJson: null, designMd: null, planMd: null });
    expect(v.ok).toBe(false);
    expect(v.errors.join('\n')).toContain('plan/plan.json');
    expect(v.errors.join('\n')).toContain('DESIGN.md');
    expect(v.errors.join('\n')).toContain('plan/plan.md');
  });

  it('reports plan.json schema errors with the file prefix', () => {
    const v = validatePlanArtifacts({ ...VALID, planJson: '{"version": 1}' });
    expect(v.ok).toBe(false);
    expect(v.planErrors[0]).toContain('plan/plan.json:');
  });

  it('reports DESIGN.md issues with the file prefix', () => {
    const v = validatePlanArtifacts({ ...VALID, designMd: 'prose without front matter' });
    expect(v.ok).toBe(false);
    expect(v.designIssues[0]).toContain('DESIGN.md:');
  });
});

describe('plan prompts', () => {
  it('builds the initial request without errors', () => {
    const text = buildPlanRequest({ locale: 'ko', userInput: 'Warm launch video.' });
    expect(text).toContain('`brief/brief.md`');
    expect(text).toContain('in Korean');
    expect(text).not.toContain('Validation errors');
  });

  it('builds the retry request with the error list', () => {
    const text = buildPlanRetry({ locale: 'en', errors: ['plan/plan.json: scenes: required'] });
    expect(text).toContain('plan/plan.json: scenes: required');
    expect(text).toContain('in English');
  });
});

describe('runPlanFlow', () => {
  it('succeeds on the first attempt without a retry', async () => {
    const send = vi.fn<(text: string) => Promise<StopReason>>(async () => 'end_turn');
    const load = vi.fn(async () => VALID);
    const outcome = await runPlanFlow({ send, load }, { locale: 'ko' });
    expect(outcome.status).toBe('ready');
    expect(outcome.attempts).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries with the error list and then succeeds', async () => {
    const send = vi.fn<(text: string) => Promise<StopReason>>(async () => 'end_turn');
    const bad: PlanArtifactSnapshot = { ...VALID, planJson: '{"version": 1}' };
    const queue: PlanArtifactSnapshot[] = [bad, VALID];
    const load = vi.fn(async () => queue.shift() ?? VALID);
    const outcome = await runPlanFlow({ send, load }, { locale: 'en' });
    expect(outcome.status).toBe('ready');
    expect(outcome.attempts).toBe(2);
    expect(send.mock.calls[1]?.[0]).toContain('plan/plan.json:');
  });

  it(`gives up after ${PLAN_MAX_RETRIES} retries`, async () => {
    const send = vi.fn<(text: string) => Promise<StopReason>>(async () => 'end_turn');
    const load = vi.fn(async () => ({ ...VALID, planJson: '{"version": 1}' }));
    const outcome = await runPlanFlow({ send, load }, { locale: 'en' });
    expect(outcome.status).toBe('invalid');
    expect(outcome.attempts).toBe(1 + PLAN_MAX_RETRIES);
    expect(outcome.errors.length).toBeGreaterThan(0);
  });

  it('stops immediately when the user cancels', async () => {
    const send = vi.fn<(text: string) => Promise<StopReason>>(async () => 'cancelled');
    const load = vi.fn(async () => VALID);
    const outcome = await runPlanFlow({ send, load }, { locale: 'ko' });
    expect(outcome.status).toBe('stopped');
    expect(outcome.attempts).toBe(1);
  });

  it('reports a send failure', async () => {
    const send = vi.fn<(text: string) => Promise<StopReason>>(async () => {
      throw new Error('no-session');
    });
    const load = vi.fn(async () => VALID);
    const outcome = await runPlanFlow({ send, load }, { locale: 'ko' });
    expect(outcome.status).toBe('send-failed');
    expect(outcome.sendError).toBe('no-session');
  });
});
