import { describe, expect, it } from 'vitest';
import {
  applyWorkerEvent,
  isTerminalStatus,
  newJobRecord,
  parseWorkerLine,
  statusFromExit,
} from './types';

describe('parseWorkerLine', () => {
  it('parses progress, log, done and error events', () => {
    expect(parseWorkerLine('{"type":"progress","percent":50,"step":"build","message":"vite"}')).toEqual({
      type: 'progress',
      percent: 50,
      step: 'build',
      message: 'vite',
    });
    expect(parseWorkerLine('{"type":"log","stream":"stderr","line":"x"}')).toEqual({
      type: 'log',
      stream: 'stderr',
      line: 'x',
    });
    expect(parseWorkerLine('{"type":"done","outDir":"o","files":["a.png"]}')).toEqual({
      type: 'done',
      outDir: 'o',
      files: ['a.png'],
    });
    expect(parseWorkerLine('{"type":"error","message":"boom"}')).toEqual({ type: 'error', message: 'boom' });
  });

  it('returns null for noise and malformed events', () => {
    expect(parseWorkerLine('vite noise')).toBeNull();
    expect(parseWorkerLine('')).toBeNull();
    expect(parseWorkerLine('{"type":"progress"}')).toBeNull();
    expect(parseWorkerLine('{"type":"unknown"}')).toBeNull();
    expect(parseWorkerLine('{"type":"done","outDir":"o","files":"nope"}')).toBeNull();
  });
});

describe('statusFromExit', () => {
  it('maps the worker exit codes (cli.ts: 0 done, 2 cancelled, 1 failed)', () => {
    expect(statusFromExit(0)).toBe('done');
    expect(statusFromExit(2)).toBe('cancelled');
    expect(statusFromExit(1)).toBe('failed');
    expect(statusFromExit(null)).toBe('failed');
  });
});

describe('applyWorkerEvent', () => {
  it('folds progress, logs and done into the record', () => {
    let job = newJobRecord('j1', 'web', 'Web');
    job = applyWorkerEvent(job, { type: 'progress', percent: 150, step: 'build', message: 'vite' });
    expect(job).toMatchObject({ status: 'running', percent: 100, step: 'build: vite' });
    job = applyWorkerEvent(job, { type: 'log', stream: 'stdout', line: 'hi' });
    expect(job.logs).toEqual([{ stream: 'stdout', line: 'hi' }]);
    job = applyWorkerEvent(job, { type: 'done', outDir: 'o', files: ['a.zip'] });
    expect(job).toMatchObject({ status: 'done', percent: 100, outDir: 'o', files: ['a.zip'] });
    expect(isTerminalStatus(job.status)).toBe(true);
    expect(isTerminalStatus('running')).toBe(false);
  });

  it('marks the error message on failure', () => {
    const job = applyWorkerEvent(newJobRecord('j1', 'video', 'V'), { type: 'error', message: 'nope' });
    expect(job).toMatchObject({ status: 'failed', error: 'nope' });
  });
});
