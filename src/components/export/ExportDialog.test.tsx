import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { ExportProvider } from '@/lib/export/ExportContext';
import { useExport } from '@/lib/export/exportContextValue';
import type { ExportApi } from '@/lib/export/exportApi';
import type { OptionsStorage } from '@/lib/export/exportOptions';
import { ExportDialog } from './ExportDialog';

function memStorage(): OptionsStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

function setup(api: ExportApi, storage: OptionsStorage, onOpenChange: (open: boolean) => void) {
  let seen: { jobs: Array<{ status: string; error: string | null }> } | null = null;
  function Probe() {
    const { jobs } = useExport();
    seen = { jobs };
    return null;
  }
  renderWithProviders(
    <ExportProvider
      api={api}
      load={async () => []}
      save={async () => undefined}
      projectRoot="/p"
    >
      <Probe />
      <ExportDialog open onOpenChange={onOpenChange} storage={storage} />
    </ExportProvider>,
  );
  return {
    get jobs() {
      return seen?.jobs ?? [];
    },
  };
}

describe('ExportDialog', () => {
  it('shows per-type fields when the kind changes', () => {
    const storage = memStorage();
    setup({ async start() { return { outDir: '', files: [] }; }, async cancel() {} }, storage, () => undefined);
    expect(screen.getByTestId('export-dialog')).toBeDefined();
    // web has no extra fields.
    expect(screen.queryByText('파일 형식')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '이미지' }));
    expect(screen.getByText('파일 형식')).toBeDefined();
    expect(screen.getByText('배율')).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: '영상' }));
    expect(screen.getByText('FPS')).toBeDefined();
    expect(screen.getByText('길이(초)')).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: '슬라이드' }));
    expect(screen.getByText('슬라이드 수')).toBeDefined();
  });

  it('enqueues a job with the chosen options and saves them', async () => {
    const storage = memStorage();
    const seen: Array<{ json: string }> = [];
    let opened = true;
    const onOpenChange = (open: boolean) => {
      opened = open;
    };
    const api: ExportApi = {
      async start(_root, _jobId, jobJson) {
        void _root;
        void _jobId;
        seen.push({ json: jobJson });
        return { outDir: '/p/exports/x-video', files: [] };
      },
      async cancel() {},
    };
    setup(api, storage, onOpenChange);

    fireEvent.click(screen.getByRole('radio', { name: '영상' }));
    const duration = screen.getByLabelText('길이(초)');
    fireEvent.change(duration, { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: '내보내기 시작' }));

    await waitFor(() => {
      if (seen.length === 0) throw new Error('no job enqueued');
    });
    const job = JSON.parse(seen[0].json) as { kind: string; duration: number; format: string };
    expect(job).toMatchObject({ kind: 'video', duration: 20, format: 'mp4' });
    // Options are stored per type and the dialog closes on success.
    const stored = JSON.parse(storage.data['vanilla.export.options.v1']) as { kind: string; video: { duration: number } };
    expect(stored).toMatchObject({ kind: 'video', video: { duration: 20 } });
    await waitFor(() => {
      if (opened) throw new Error('dialog did not close');
    });
  });

  it('queues the job as failed when the worker is missing (shown in the job list)', async () => {
    const storage = memStorage();
    const api: ExportApi = {
      async start() {
        throw new Error('worker-not-found:vanilla-export.mjs');
      },
      async cancel() {},
    };
    let opened = true;
    const view = setup(api, storage, (open) => {
      opened = open;
    });
    fireEvent.click(screen.getByRole('button', { name: '내보내기 시작' }));
    // The dialog only queues: it closes, and the failure lands on the job record.
    await waitFor(() => {
      if (opened) throw new Error('dialog did not close');
    });
    await waitFor(() => {
      const job = view.jobs[0];
      if (!job || job.status !== 'failed') throw new Error('job not failed yet');
      if (!job.error?.includes('worker-not-found')) throw new Error(`wrong error: ${job.error}`);
    });
  });
});
