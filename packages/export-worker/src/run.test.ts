// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CancelledError } from './job';
import { runExport, spawnFixed, type Steps } from './run';

const webJob = { version: 1, kind: 'web', format: 'web', projectDir: 'C:/p', outDir: 'C:/o' } as const;

const okSteps: Steps = {
  web: (job) => Promise.resolve([`${job.outDir}/site.zip`]),
  image: () => Promise.resolve([]),
  slides: () => Promise.resolve([]),
  video: () => Promise.resolve([]),
};

describe('runExport (T5.1 mock job)', () => {
  it('dispatches by kind and emits done', async () => {
    const events: unknown[] = [];
    const files = await runExport({ ...webJob }, okSteps, (e) => events.push(e));
    expect(files).toEqual(['C:/o/site.zip']);
    expect(events).toEqual([{ type: 'done', outDir: 'C:/o', files }]);
  });

  it('forwards step progress events and step errors', async () => {
    const seen: unknown[] = [];
    const steps: Steps = {
      ...okSteps,
      web: (_job, ctx) => {
        ctx.onEvent({ type: 'progress', percent: 10, step: 'build' });
        return Promise.reject(new Error('vite broke'));
      },
    };
    await expect(runExport({ ...webJob }, steps, (e) => seen.push(e))).rejects.toThrow('vite broke');
    expect(seen).toEqual([{ type: 'progress', percent: 10, step: 'build' }]);
  });

  it('refuses to start (or finish) when cancelled', async () => {
    const c = new AbortController();
    c.abort();
    await expect(runExport({ ...webJob }, okSteps, () => {}, c.signal)).rejects.toThrow(CancelledError);
    const late = new AbortController();
    const steps: Steps = { ...okSteps, web: () => Promise.resolve([]) };
    const p = runExport({ ...webJob }, steps, () => {}, late.signal);
    late.abort();
    await expect(p).rejects.toThrow(CancelledError);
  });

  it('passes the signal to steps', async () => {
    const c = new AbortController();
    const step = vi.fn((...args: unknown[]) => {
      const ctx = args[1] as { signal?: AbortSignal };
      expect(ctx.signal).toBe(c.signal);
      return Promise.resolve([] as string[]);
    });
    await runExport({ ...webJob }, { ...okSteps, web: step }, () => {}, c.signal);
    expect(step).toHaveBeenCalledOnce();
  });
});

describe('spawnFixed', () => {
  it('runs fixed argv with closed stdin and reports the exit code', async () => {
    const r = await spawnFixed(process.execPath, ['-e', 'process.exit(3)']);
    expect(r.code).toBe(3);
  });

  it('streams stdout lines and strips API keys from the child env', async () => {
    const lines: string[] = [];
    const r = await spawnFixed(
      process.execPath,
      ['-e', 'console.log("hi");console.log("leak:" + process.env.GEMINI_API_KEY + "/" + process.env.DO_NOT_TRACK)'],
      { env: { ...process.env, GEMINI_API_KEY: 'secret' }, onLine: (_s, l) => lines.push(l) },
    );
    expect(r.code).toBe(0);
    expect(lines).toEqual(['hi', 'leak:undefined/1']);
  });

  it('rejects on abort', async () => {
    const c = new AbortController();
    const p = spawnFixed(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: c.signal });
    c.abort();
    await expect(p).rejects.toThrow(CancelledError);
  });

  it('rejects immediately when already aborted', async () => {
    const c = new AbortController();
    c.abort();
    await expect(spawnFixed(process.execPath, ['-e', ''], { signal: c.signal })).rejects.toThrow(CancelledError);
  });
});
