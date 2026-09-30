import { describe, expect, it } from 'vitest';
import { reduceServerState, type PreviewServerState } from './previewServer';

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
