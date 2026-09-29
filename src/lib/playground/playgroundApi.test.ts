import { describe, expect, it, vi } from 'vitest';
import { joinPath, listPlaygroundFiles, revealPlaygroundPath } from './playgroundApi';

describe('playgroundApi', () => {
  it('lists files only', async () => {
    const invoke = vi.fn(async () => [
      { name: 'a.mp4', is_dir: false },
      { name: 'sub', is_dir: true },
    ]);
    await expect(listPlaygroundFiles('C:/o', 'C:/p', invoke)).resolves.toEqual(['a.mp4']);
    expect(invoke).toHaveBeenCalledWith('list_dir', { path: 'C:/o', workspaceRoot: 'C:/p' });
  });

  it('reveals the folder in the explorer', async () => {
    const invoke = vi.fn(async () => undefined);
    await revealPlaygroundPath('C:/o', 'C:/p', invoke);
    expect(invoke).toHaveBeenCalledWith('reveal_in_explorer', { path: 'C:/o', workspaceRoot: 'C:/p' });
  });

  it('joins paths without doubling slashes', () => {
    expect(joinPath('C:\\o\\', 'a.mp4')).toBe('C:\\o/a.mp4');
  });
});
