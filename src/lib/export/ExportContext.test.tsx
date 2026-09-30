import { describe, expect, it } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { ExportProvider } from './ExportContext';
import { useExport } from './exportContextValue';
import type { BackendExportEvent, ExportApi, ExportReport } from './exportApi';
import type { ExportJobRow } from './exportRepo';
import type { ExportBuildDetails } from './jobBuilder';

function scriptedApi(script: (onEvent: (e: BackendExportEvent) => void) => ExportReport): ExportApi {
  const calls: string[] = [];
  return {
    calls,
    async start(_root: string, jobId: string, _json: string, onEvent) {
      void _root;
      void _json;
      calls.push(jobId);
      onEvent({ kind: 'started', jobId, program: 'node', argv: ['x'] });
      onEvent({ kind: 'progress', percent: 50, step: 'build', message: null });
      await Promise.resolve();
      return script(onEvent);
    },
    async cancel() {},
  } as ExportApi & { calls: string[] };
}

const webDetails: ExportBuildDetails = { kind: 'web', format: 'web' };

function harness(deps: {
  api: ExportApi;
  saved?: ExportJobRow[];
  ids?: string[];
  projectRoot?: string | null;
}) {
  const saved = deps.saved ?? [];
  const ids = deps.ids ?? ['j1', 'j2', 'j3'];
  let seen: ReturnType<typeof useExport> | null = null;
  function Probe() {
    seen = useExport();
    return null;
  }
  function Frame() {
    return (
      <ExportProvider
        api={deps.api}
        load={async () => []}
        save={async (_root, row) => {
          void _root;
          saved.push(row);
        }}
        now={() => new Date('2026-09-29T00:00:00.000Z')}
        newId={() => ids.shift() ?? `extra-${saved.length}`}
        projectRoot={deps.projectRoot !== undefined ? deps.projectRoot : '/p'}
      >
        <Probe />
      </ExportProvider>
    );
  }
  render(<Frame />);
  return {
    get value() {
      if (!seen) throw new Error('provider not mounted');
      return seen;
    },
    saved,
  };
}

describe('ExportProvider queue', () => {
  it('processes two queued jobs strictly one after another', async () => {
    const order: string[] = [];
    const api = scriptedApi((onEvent) => {
      const id = `done-${order.length}`;
      order.push(id);
      onEvent({ kind: 'log', stream: 'stdout', line: `hello ${id}` });
      return { outDir: `/p/exports/${id}`, files: [`${id}.zip`] };
    });
    const h = harness({ api });

    let id1 = '';
    let id2 = '';
    await act(async () => {
      id1 = await h.value.enqueue('web', 'Web site', webDetails);
      id2 = await h.value.enqueue('web', 'Web site 2', webDetails);
    });
    expect([id1, id2]).toEqual(['j1', 'j2']);

    await waitFor(() => {
      const jobs = h.value.jobs;
      if (jobs.length !== 2 || jobs.some((j) => j.status !== 'done')) throw new Error('not settled');
    });
    const [first, second] = h.value.jobs;
    expect(first).toMatchObject({ id: 'j1', status: 'done', percent: 100, files: ['done-0.zip'] });
    expect(first.logs).toContainEqual({ stream: 'stdout', line: 'hello done-0' });
    expect(second).toMatchObject({ id: 'j2', status: 'done', files: ['done-1.zip'] });
    // Sequential: the fake api resolves immediately, but the runner only
    // picks the second job after the first settles.
    expect((api as unknown as { calls: string[] }).calls).toEqual(['j1', 'j2']);
    // Terminal states persist.
    expect(h.saved.filter((r) => r.status === 'done').map((r) => r.id).sort()).toEqual(['j1', 'j2']);
  });

  it('settles a failing job and continues the queue', async () => {
    const api: ExportApi = {
      async start(_root, jobId, _json, onEvent) {
        void _root;
        void _json;
        onEvent({ kind: 'started', jobId, program: 'node', argv: [] });
        if (jobId === 'j1') throw new Error('exit:1');
        return { outDir: '/p/exports/ok', files: [] };
      },
      async cancel() {},
    };
    const h = harness({ api });
    await act(async () => {
      await h.value.enqueue('web', 'W1', webDetails);
      await h.value.enqueue('web', 'W2', webDetails);
    });
    await waitFor(() => {
      const jobs = h.value.jobs;
      if (jobs.length !== 2 || jobs.some((j) => j.status === 'queued' || j.status === 'running')) throw new Error('not settled');
    });
    expect(h.value.jobs[0]).toMatchObject({ id: 'j1', status: 'failed', error: 'exit:1' });
    expect(h.value.jobs[1]).toMatchObject({ id: 'j2', status: 'done' });
  });

  it('cancels a queued job without starting it and refuses without a project', async () => {
    const started: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api: ExportApi = {
      async start(_root, jobId, _json, onEvent) {
        void _root;
        void _json;
        started.push(jobId);
        onEvent({ kind: 'started', jobId, program: 'node', argv: [] });
        // The first job stays running until the test cancels the queued one.
        if (jobId === 'j1') await gate;
        return { outDir: '/p/exports/x', files: [] };
      },
      async cancel() {},
    };
    const h = harness({ api });
    let second = '';
    await act(async () => {
      await h.value.enqueue('web', 'W1', webDetails);
      second = await h.value.enqueue('web', 'W2', webDetails);
    });
    // j1 is running, j2 is queued behind it.
    await waitFor(() => {
      if (!h.value.jobs.some((j) => j.id === 'j1' && j.status === 'running')) throw new Error('j1 not running');
    });
    await act(async () => {
      h.value.cancel(second);
    });
    expect(h.value.jobs.find((j) => j.id === second)).toMatchObject({ status: 'cancelled' });
    await act(async () => {
      release();
    });
    await waitFor(() => {
      if (h.value.jobs.some((j) => j.status === 'queued' || j.status === 'running')) throw new Error('not settled');
    });
    // The worker started once (j1); the cancelled j2 never started it.
    expect(started).toEqual(['j1']);
    expect(h.value.jobs.find((j) => j.id === 'j1')).toMatchObject({ status: 'done' });

    const h2 = harness({ api, projectRoot: null, ids: ['z1'] });
    await expect(h2.value.enqueue('web', 'W', webDetails)).rejects.toThrow('no-project');
  });
});
