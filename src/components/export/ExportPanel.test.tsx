import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { ExportJobList } from './ExportPanel';
import { newJobRecord, type ExportJobRecord } from '@/lib/export/types';

function job(overrides: Partial<ExportJobRecord> = {}): ExportJobRecord {
  return { ...newJobRecord('j1', 'web', 'Web site'), ...overrides };
}

describe('ExportJobList', () => {
  it('shows the empty state when there are no jobs', () => {
    renderWithProviders(<ExportJobList jobs={[]} onCancel={() => undefined} />);
    expect(screen.getByText('아직 내보내기 작업이 없습니다. 내보내기 탭에서 새 작업을 시작하세요.')).toBeDefined();
  });

  it('shows progress, files and expandable logs, and cancels a running job', () => {
    const onCancel = vi.fn();
    const jobs = [
      job({
        id: 'j1',
        status: 'running',
        percent: 42,
        step: 'build: vite',
        logs: [{ stream: 'stdout', line: 'vite v7' }],
      }),
      job({ id: 'j2', status: 'done', percent: 100, files: ['/p/exports/x/site.zip'] }),
    ];
    renderWithProviders(<ExportJobList jobs={jobs} onCancel={onCancel} />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars.map((b) => b.getAttribute('aria-valuenow')).sort()).toEqual(['100', '42']);
    expect(screen.getByText('/p/exports/x/site.zip')).toBeDefined();

    fireEvent.click(screen.getByText('로그 (1)'));
    expect(screen.getByText('vite v7')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledWith('j1');
  });

  it('shows the error on a failed job', () => {
    renderWithProviders(<ExportJobList jobs={[job({ status: 'failed', error: 'exit:1' })]} onCancel={() => undefined} />);
    expect(screen.getByRole('alert').textContent).toContain('exit:1');
  });
});
