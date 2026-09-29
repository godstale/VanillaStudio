import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { initialStates } from '@/lib/pipeline/pipelineModel';
import type { PipelineStates } from '@/lib/pipeline/stages';
import { PipelineProvider } from '@/lib/pipeline/PipelineContext';
import { usePipeline } from '@/lib/pipeline/pipelineContextValue';
import { PipelinePanel } from '@/components/pipeline/PipelinePanel';

const mocks = vi.hoisted(() => ({
  openTab: vi.fn(),
  root: { current: '/proj' as string | null },
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => ({ workspaceRoot: mocks.root.current }),
}));
vi.mock('@/lib/context/WorkspaceTabsContext', () => ({
  useWorkspaceTabs: () => ({ openTab: mocks.openTab }),
}));
vi.mock('@/lib/pipeline/pipelineRepo', () => ({
  loadPipelineStates: mocks.load,
  savePipelineStates: mocks.save,
}));

// Exposes the context to assertions; refreshed after every render.
const holder: { api: ReturnType<typeof usePipeline> | null } = { api: null };
const getApi = () => holder.api as ReturnType<typeof usePipeline>;
function Probe() {
  const ctx = usePipeline();
  useEffect(() => {
    holder.api = ctx;
  });
  return null;
}

function renderPanel() {
  return renderWithProviders(
    <PipelineProvider>
      <Probe />
      <PipelinePanel />
    </PipelineProvider>,
  );
}

const availability = (stage: string) =>
  screen.getByTestId(`pipeline-stage-${stage}`).getAttribute('data-availability');

beforeEach(() => {
  mocks.openTab.mockReset();
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.load.mockReset().mockResolvedValue(initialStates());
  mocks.root.current = '/proj';
});

describe('PipelinePanel', () => {
  it('shows six stages with only the first one open', async () => {
    renderPanel();
    await waitFor(() => expect(getApi().isLoaded).toBe(true));
    expect(screen.getAllByTestId(/^pipeline-stage-/)).toHaveLength(6);
    expect(availability('brief')).toBe('open');
    expect(availability('plan')).toBe('locked');
  });

  it('advances the stages, saves each change and lets the user reopen', async () => {
    renderPanel();
    await waitFor(() => expect(getApi().isLoaded).toBe(true));

    act(() => {
      getApi().transition('brief', 'done');
    });
    expect(availability('brief')).toBe('complete');
    expect(availability('plan')).toBe('open');
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][0]).toBe('/proj');
    expect(mocks.save.mock.calls[0][1].map((s: { stage: string }) => s.stage)).toEqual(['brief']);

    act(() => {
      expect(getApi().transition('build', 'done').ok).toBe(false);
    });

    fireEvent.click(screen.getByTestId('pipeline-stage-brief').querySelector('button')!);
    expect(mocks.openTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'brief:main', type: 'brief' }));

    fireEvent.click(screen.getAllByRole('button', { name: /^(다시 열기|Reopen)/ })[0]);
    expect(availability('brief')).toBe('open');
    expect(availability('plan')).toBe('locked');
  });

  it('opens the prompts tab for the build stage', async () => {
    renderPanel();
    await waitFor(() => expect(getApi().isLoaded).toBe(true));
    fireEvent.click(screen.getByTestId('pipeline-stage-build').querySelector('button')!);
    expect(mocks.openTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'prompts:main', type: 'prompts' }));
  });

  it('restores persisted states on load', async () => {
    const saved: PipelineStates = initialStates();
    saved.brief = { ...saved.brief, status: 'done' };
    saved.plan = { ...saved.plan, status: 'approved', approvedAt: 'x' };
    mocks.load.mockResolvedValue(saved);
    renderPanel();
    await waitFor(() => expect(availability('plan')).toBe('complete'));
    expect(availability('prompts')).toBe('open');
    expect(getApi().current).toBe('prompts');
  });

  it('keeps working in memory when the database is unavailable', async () => {
    mocks.load.mockRejectedValue(new Error('no db'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderPanel();
    await waitFor(() => expect(getApi().isLoaded).toBe(true));
    expect(availability('brief')).toBe('open');
  });

  it('asks for a project folder when none is open', () => {
    mocks.root.current = null;
    renderPanel();
    expect(screen.queryAllByTestId(/^pipeline-stage-/)).toHaveLength(0);
    expect(screen.getByTestId('pipeline-panel')).toBeTruthy();
  });
});
