// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { main } from './cli';

const webJob = { version: 1, kind: 'web', format: 'web', projectDir: 'C:/p', outDir: 'C:/o' };

describe('cli (T5.1)', () => {
  it('runs a job file and prints NDJSON', async () => {
    const out: string[] = [];
    const code = await main(['job.json'], {
      readJobFile: () => JSON.stringify(webJob),
      steps: {
        web: () => Promise.resolve(['C:/o/site.zip']),
        image: () => Promise.resolve([]),
        slides: () => Promise.resolve([]),
        video: () => Promise.resolve([]),
      },
      stdout: (l) => out.push(l),
      stderr: () => {},
    });
    expect(code).toBe(0);
    expect(out.map((l) => JSON.parse(l))).toEqual([{ type: 'done', outDir: 'C:/o', files: ['C:/o/site.zip'] }]);
  });

  it('prints an error event for an invalid job file', async () => {
    const out: string[] = [];
    const code = await main(['job.json'], { readJobFile: () => 'nope', stdout: (l) => out.push(l), stderr: () => {} });
    expect(code).toBe(1);
    expect(JSON.parse(out[0]).type).toBe('error');
  });

  it('returns 1 for step failures and 0 for --help', async () => {
    const err: string[] = [];
    const fail = await main(['job.json'], {
      readJobFile: () => JSON.stringify(webJob),
      steps: {
        web: () => Promise.reject(new Error('boom')),
        image: () => Promise.resolve([]),
        slides: () => Promise.resolve([]),
        video: () => Promise.resolve([]),
      },
      stdout: () => {},
      stderr: (l) => err.push(l),
    });
    expect(fail).toBe(1);
    expect(await main(['--help'], { stdout: () => {}, stderr: (l) => err.push(l) })).toBe(0);
  });
});
