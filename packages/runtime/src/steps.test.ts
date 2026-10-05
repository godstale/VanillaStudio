import { describe, expect, it, vi } from 'vitest';
import { createStepController, matchesAdvance, type StepSpec } from './steps';

const steps = (...advance: string[]): StepSpec[] => advance.map((a, i) => ({ id: `s${i + 1}`, advance: a }));

function setup(s: StepSpec[]) {
  const events = { onStep: vi.fn(), onDone: vi.fn(), onChoice: vi.fn() };
  return { c: createStepController(s, events), ...events };
}

describe('matchesAdvance', () => {
  it('matches only the declared input', () => {
    expect(matchesAdvance('click', { kind: 'click' })).toBe(true);
    expect(matchesAdvance('click', { kind: 'key', key: 'Enter' })).toBe(false);
    expect(matchesAdvance('key:ArrowRight', { kind: 'key', key: 'ArrowRight' })).toBe(true);
    expect(matchesAdvance('key:ArrowRight', { kind: 'key', key: 'ArrowLeft' })).toBe(false);
    expect(matchesAdvance('choice:Yes', { kind: 'choice', label: 'Yes' })).toBe(true);
    expect(matchesAdvance('choice:Yes', { kind: 'choice', label: 'No' })).toBe(false);
  });
});

describe('createStepController', () => {
  it('advances only on the matching user input and reports every step', () => {
    const { c, onStep } = setup(steps('click', 'key:ArrowRight', 'choice:Go'));
    expect(c.index).toBe(0);
    expect(c.input({ kind: 'key', key: 'ArrowRight' })).toBe(false); // wrong input for step 1
    expect(c.input({ kind: 'click' })).toBe(true);
    expect(c.index).toBe(1);
    expect(c.input({ kind: 'click' })).toBe(false); // step 2 wants a key
    expect(c.input({ kind: 'key', key: 'ArrowRight' })).toBe(true);
    expect(onStep.mock.calls).toEqual([
      [1, 3],
      [2, 3],
    ]);
  });

  it('input on the last step finishes the page exactly once (done) and a choice is reported', () => {
    const { c, onDone, onChoice } = setup(steps('click', 'choice:Go'));
    c.input({ kind: 'click' });
    expect(c.input({ kind: 'choice', label: 'Stop' })).toBe(false);
    expect(c.input({ kind: 'choice', label: 'Go' })).toBe(true);
    expect(onChoice).toHaveBeenCalledWith('Go');
    expect(onDone).toHaveBeenCalledOnce();
    expect(c.finished).toBe(true);
    expect(c.input({ kind: 'click' })).toBe(false);
    c.next();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('never advances by itself: no input, no progress', async () => {
    const { c, onStep, onDone } = setup(steps('click', 'click'));
    await new Promise((r) => setTimeout(r, 30));
    expect(c.index).toBe(0);
    expect(onStep).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('host-delegated next/prev move one step regardless of the input kind', () => {
    const { c, onStep } = setup(steps('key:ArrowRight', 'choice:Go', 'click'));
    c.next();
    expect(c.index).toBe(1);
    c.next();
    c.prev();
    expect(c.index).toBe(1);
    expect(onStep.mock.calls.map((x) => x[0])).toEqual([1, 2, 1]);
    c.prev();
    c.prev(); // at the first step: nothing happens
    expect(c.index).toBe(0);
  });

  it('a page without steps (scroll) is one step: click or Enter finishes it', () => {
    const a = setup([]);
    expect(a.c.total).toBe(1);
    expect(a.c.input({ kind: 'key', key: 'x' })).toBe(false);
    expect(a.c.input({ kind: 'click' })).toBe(true);
    expect(a.onDone).toHaveBeenCalledOnce();
    const b = setup([]);
    expect(b.c.input({ kind: 'key', key: 'Enter' })).toBe(true);
    expect(b.onDone).toHaveBeenCalledOnce();
  });

  it('prev does nothing once the page is finished', () => {
    const { c } = setup(steps('click', 'click'));
    c.input({ kind: 'click' });
    c.input({ kind: 'click' });
    expect(c.finished).toBe(true);
    c.prev();
    expect(c.index).toBe(1);
  });
});
