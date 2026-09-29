import { describe, expect, it, vi } from 'vitest';
import type { StopReason } from '@/lib/agents/types';
import { buildPromptTree } from './promptsFiles';
import {
  PROMPTS_MAX_RETRIES,
  buildPromptsRequest,
  buildPromptsRetry,
  runPromptsFlow,
  validatePromptsArtifacts,
} from './promptsFlow';

const VALID_TASKS = JSON.stringify({
  version: 1,
  tasks: [
    { id: 'T01', kind: 'asset', target: 'logo', prompt: 'prompts/assets/logo.md', dependsOn: [] },
    { id: 'T02', kind: 'scene', target: 's1', prompt: 'prompts/scenes/s1.md', dependsOn: ['T01'] },
    { id: 'T03', kind: 'compose', target: '', prompt: 'prompts/00-master.md', dependsOn: ['T02'] },
  ],
});

const sendOk = () =>
  vi.fn<(text: string) => Promise<StopReason>>(async () => 'end_turn');

describe('buildPromptTree', () => {
  it('groups files by directory with the prompts root first', () => {
    const tree = buildPromptTree([
      'prompts/scenes/s1.md',
      'prompts/00-master.md',
      'prompts/assets/logo.md',
      'prompts/tasks.json',
      'prompts/animations/a1.md',
    ]);
    expect(tree.map((g) => g.dir)).toEqual([
      'prompts',
      'prompts/animations',
      'prompts/assets',
      'prompts/scenes',
    ]);
    expect(tree[0].files).toEqual(['prompts/00-master.md', 'prompts/tasks.json']);
  });

  it('returns an empty tree for no files', () => {
    expect(buildPromptTree([])).toEqual([]);
  });
});

describe('validatePromptsArtifacts', () => {
  it('accepts valid tasks.json with the execution order', () => {
    const v = validatePromptsArtifacts({ tasksJson: VALID_TASKS });
    expect(v.ok).toBe(true);
    expect(v.order).toEqual(['T01', 'T02', 'T03']);
    expect(v.tasks).toHaveLength(3);
  });

  it('reports a missing tasks.json', () => {
    const v = validatePromptsArtifacts({ tasksJson: null });
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain('prompts/tasks.json');
  });

  it('prefixes schema errors with the file path', () => {
    const v = validatePromptsArtifacts({ tasksJson: '{"tasks": []}' });
    // Empty lists pass the schema; break one prompt path instead.
    expect(v.ok).toBe(true);
    const broken = validatePromptsArtifacts({
      tasksJson: JSON.stringify({
        tasks: [{ id: 'T01', kind: 'asset', target: 'logo', prompt: 'nope.txt', dependsOn: [] }],
      }),
    });
    expect(broken.ok).toBe(false);
    expect(broken.errors[0]).toContain('prompts/tasks.json:');
  });

  it('reports dependency cycles', () => {
    const v = validatePromptsArtifacts({
      tasksJson: JSON.stringify({
        tasks: [
          { id: 'T01', kind: 'asset', target: 'a', prompt: 'prompts/assets/a.md', dependsOn: ['T02'] },
          { id: 'T02', kind: 'asset', target: 'b', prompt: 'prompts/assets/b.md', dependsOn: ['T01'] },
        ],
      }),
    });
    expect(v.ok).toBe(false);
    expect(v.errors.join('\n')).toContain('cycle');
  });
});

describe('prompts request prompts', () => {
  it('builds the initial request without errors', () => {
    const text = buildPromptsRequest({ locale: 'ko' });
    expect(text).toContain('`plan/plan.json`');
    expect(text).toContain('in Korean');
  });

  it('builds the retry request with the error list', () => {
    const text = buildPromptsRetry({ locale: 'en', errors: ['prompts/tasks.json: boom'] });
    expect(text).toContain('prompts/tasks.json: boom');
  });
});

describe('runPromptsFlow', () => {
  it('succeeds on the first attempt', async () => {
    const send = sendOk();
    const load = vi.fn(async () => ({ tasksJson: VALID_TASKS }));
    const outcome = await runPromptsFlow({ send, load }, { locale: 'ko' });
    expect(outcome.status).toBe('ready');
    expect(outcome.attempts).toBe(1);
    expect(outcome.validation?.order).toEqual(['T01', 'T02', 'T03']);
  });

  it('retries with the error list and then succeeds', async () => {
    const send = sendOk();
    const queue: ({ tasksJson: string | null })[] = [
      { tasksJson: '{"tasks": "nope"}' },
      { tasksJson: VALID_TASKS },
    ];
    const load = vi.fn(async () => queue.shift() ?? { tasksJson: VALID_TASKS });
    const outcome = await runPromptsFlow({ send, load }, { locale: 'en' });
    expect(outcome.status).toBe('ready');
    expect(outcome.attempts).toBe(2);
    expect(send.mock.calls[1]?.[0]).toContain('prompts/tasks.json:');
  });

  it(`gives up after ${PROMPTS_MAX_RETRIES} retries`, async () => {
    const send = sendOk();
    const load = vi.fn(async () => ({ tasksJson: null }));
    const outcome = await runPromptsFlow({ send, load }, { locale: 'en' });
    expect(outcome.status).toBe('invalid');
    expect(outcome.attempts).toBe(1 + PROMPTS_MAX_RETRIES);
  });

  it('stops immediately when the user cancels', async () => {
    const send = vi.fn<(text: string) => Promise<StopReason>>(async () => 'cancelled');
    const load = vi.fn(async () => ({ tasksJson: VALID_TASKS }));
    const outcome = await runPromptsFlow({ send, load }, { locale: 'ko' });
    expect(outcome.status).toBe('stopped');
  });
});
