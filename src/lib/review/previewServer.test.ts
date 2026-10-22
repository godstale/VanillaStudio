import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reduceServerState, usePreviewServer, type PreviewApi, type PreviewServerState } from './previewServer';

const starting: PreviewServerState = { phase: 'starting' };

describe('reduceServerState', () => {
  it('goes running on listening', () => {
    expect(reduceServerState(starting, { kind: 'listening', port: 5173, url: 'http://127.0.0.1:5173' })).toEqual({
      phase: 'running',
      url: 'http://127.0.0.1:5173',
    });
  });

  it('goes restarting only when the backend will restart', () => {
    expect(reduceServerState(starting, { kind: 'exited', exitCode: 1, willRestart: true })).toEqual({
      phase: 'restarting',
    });
    expect(
      reduceServerState({ phase: 'running', url: 'http://127.0.0.1:5173' }, { kind: 'exited', exitCode: 0, willRestart: false }),
    ).toEqual({ phase: 'running', url: 'http://127.0.0.1:5173' });
  });

  it('goes failed on failure and ignores logs', () => {
    expect(reduceServerState(starting, { kind: 'failed', message: 'timeout' })).toEqual({
      phase: 'failed',
      error: 'timeout',
    });
    expect(reduceServerState(starting, { kind: 'log', stream: 'stdout', line: 'vite…' })).toBe(starting);
  });
});

describe('usePreviewServer auto install', () => {
  const info = { port: 5173, url: 'http://127.0.0.1:5173' };
  const makeApi = (install: PreviewApi['install']): PreviewApi => ({
    start: vi.fn().mockRejectedValueOnce('not-installed').mockResolvedValue(info),
    stop: vi.fn(async () => undefined),
    install,
  });

  it('installs once when dependencies are missing, then starts', async () => {
    const api = makeApi(vi.fn(async () => 0));
    const { result } = renderHook(() => usePreviewServer('/p/auto-install-ok', { api }));
    await waitFor(() => expect(result.current.state).toEqual({ phase: 'running', url: info.url }));
    expect(api.install).toHaveBeenCalledTimes(1);
    expect(api.start).toHaveBeenCalledTimes(2);
  });

  it('fails without retrying the server when the install fails', async () => {
    const api = makeApi(vi.fn(async () => 1));
    const { result } = renderHook(() => usePreviewServer('/p/auto-install-bad', { api }));
    await waitFor(() => expect(result.current.state.phase).toBe('failed'));
    expect(api.start).toHaveBeenCalledTimes(1);
  });
});
