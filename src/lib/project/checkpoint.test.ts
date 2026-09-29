import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: state.invoke }));

import {
  checkpointCommit,
  checkpointHistory,
  checkpointInit,
  checkpointStatus,
  shortCheckpointId,
} from '@/lib/project/checkpoint';

beforeEach(() => {
  state.invoke.mockReset();
});

describe('checkpoint host API', () => {
  it('asks for status with the project path', async () => {
    state.invoke.mockResolvedValue({ backend: 'git', gitAvailable: true, isRepo: true, head: 'abc' });
    await expect(checkpointStatus('C:/proj')).resolves.toMatchObject({ backend: 'git' });
    expect(state.invoke).toHaveBeenCalledWith('checkpoint_status', { projectPath: 'C:/proj' });
  });

  it('initializes and commits with a message', async () => {
    state.invoke.mockResolvedValue({ backend: 'snapshot', gitAvailable: false, isRepo: false, head: null });
    await checkpointInit('C:/proj');
    expect(state.invoke).toHaveBeenCalledWith('checkpoint_init', { projectPath: 'C:/proj' });

    state.invoke.mockResolvedValue({ id: 'snap-1', backend: 'snapshot' });
    await expect(checkpointCommit('C:/proj', 'plan approved')).resolves.toMatchObject({
      id: 'snap-1',
    });
    expect(state.invoke).toHaveBeenCalledWith('checkpoint_commit', {
      projectPath: 'C:/proj',
      message: 'plan approved',
    });
  });

  it('lists history with an optional limit', async () => {
    state.invoke.mockResolvedValue([]);
    await checkpointHistory('C:/proj', 10);
    expect(state.invoke).toHaveBeenCalledWith('checkpoint_history', {
      projectPath: 'C:/proj',
      limit: 10,
    });
  });
});

describe('shortCheckpointId', () => {
  it('shortens git hashes and keeps snapshot ids', () => {
    expect(shortCheckpointId('0123456789abcdef0123456789abcdef01234567')).toBe('0123456789ab');
    expect(shortCheckpointId('1700000000000')).toBe('1700000000000');
    expect(shortCheckpointId('1700000000000-2')).toBe('1700000000000-2');
  });
});
