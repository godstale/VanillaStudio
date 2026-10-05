import { afterEach, describe, expect, it, vi } from 'vitest';
import { newScene, type Scene } from '@/lib/scene/schema';
import { defaultTemplateFor } from '@/lib/guides/template';
import { copyToClipboard, promptForScene } from './clipboard';

const ctx = (over: Partial<Scene> = {}) => ({
  workspace: { id: 'ws_1', name: 'W' },
  scene: { ...newScene({ id: 'scn_A', name: 'Intro', type: 'motion', template: 'commercial@1' }), ...over } as Scene,
  template: defaultTemplateFor('motion'),
});

afterEach(() => vi.unstubAllGlobals());

describe('promptForScene', () => {
  it('uses generate normally and revise when the scene needs revision', () => {
    expect(promptForScene(ctx()).kind).toBe('generate');
    const r = promptForScene(ctx({ status: 'needs-revision' }), ['beats']);
    expect(r.kind).toBe('revise');
    expect(r.text).toContain('`beats`');
  });

  it('starts with the identity header and includes the user prompt and language', () => {
    const { text } = promptForScene(ctx({ userPrompt: 'Make it punchy' }));
    expect(text.startsWith('[workspace: W / scene: Intro]')).toBe(true);
    expect(text).toContain('Make it punchy');
    expect(text).toContain('Korean');
  });
});

describe('copyToClipboard', () => {
  it('writes through the async clipboard API', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyToClipboard('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when the API rejects', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) } });
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    expect(await copyToClipboard('hello')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull(); // the temporary element is removed
  });

  it('reports failure when nothing works', async () => {
    vi.stubGlobal('navigator', {});
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    expect(await copyToClipboard('x')).toBe(false);
  });
});
