import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import designFixture from '@/lib/design/__fixtures__/DESIGN.md?raw';
import samplePlan from '@/lib/pipeline/__fixtures__/plan.sample.json';
import { initialStates, transitionStage } from '@/lib/pipeline/pipelineModel';
import { PipelineProvider } from '@/lib/pipeline/PipelineContext';
import { PlanViewer } from '@/components/pipeline/plan/PlanViewer';

const ROOT = 'C:/proj';

const mocks = vi.hoisted(() => ({
  files: new Map<string, string>(),
  root: { current: 'C:/proj' as string | null },
  session: { current: null as { sendPrompt: (text: string) => Promise<string> } | null },
  loadStates: vi.fn(),
  saveStates: vi.fn(),
  cpInit: vi.fn(),
  cpCommit: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, string>) => {
    if (cmd === 'list_dir') {
      const dir = args.path.replace(/\/$/, '');
      const entries = [...mocks.files.keys()]
        .filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'))
        .map((p) => ({ name: p.slice(dir.length + 1), path: p, is_dir: false, size: 0 }));
      if (entries.length === 0) throw new Error('not found');
      return entries;
    }
    if (cmd === 'read_text_file') {
      const text = mocks.files.get(args.path);
      if (text === undefined) throw new Error('missing');
      return text;
    }
    throw new Error(`unexpected command ${cmd}`);
  },
}));
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => ({ workspaceRoot: mocks.root.current }),
}));
vi.mock('@/lib/agents/sessionContextValue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agents/sessionContextValue')>();
  return { ...actual, useSafeAgentSession: () => mocks.session.current };
});
vi.mock('@/lib/pipeline/pipelineRepo', () => ({
  loadPipelineStates: mocks.loadStates,
  savePipelineStates: mocks.saveStates,
}));
vi.mock('@/lib/project/checkpoint', () => ({
  checkpointInit: mocks.cpInit,
  checkpointCommit: mocks.cpCommit,
  shortCheckpointId: (id: string) => id,
}));

beforeEach(() => {
  mocks.files.clear();
  mocks.root.current = ROOT;
  mocks.session.current = null;
  mocks.loadStates.mockReset().mockResolvedValue(initialStates());
  mocks.saveStates.mockReset().mockResolvedValue(undefined);
  mocks.cpInit.mockReset().mockResolvedValue({ backend: 'git', gitAvailable: true, isRepo: true, head: null });
  mocks.cpCommit.mockReset().mockResolvedValue({ id: 'abc123', backend: 'git' });
});

describe('PlanViewer', () => {
  it('renders the sample plan: storyboard, assets, timeline, params, design, document', async () => {
    mocks.files.set(`${ROOT}/plan/plan.json`, JSON.stringify(samplePlan));
    mocks.files.set(`${ROOT}/plan/plan.md`, '# Solar plan\n\nWarm and **editorial**.');
    mocks.files.set(`${ROOT}/DESIGN.md`, designFixture);
    renderWithProviders(<PlanViewer />);

    await waitFor(() => expect(screen.getByTestId('plan-title').textContent).toBe('Solar Parchment Intro'));

    expect(screen.getByTestId('scene-card-s1-intro').textContent).toContain('Logo reveal');
    expect(screen.getByTestId('scene-card-s2-outro').textContent).toContain('6s – 15s');
    expect(screen.getByTestId('asset-row-logo').textContent).toContain('three');
    expect(screen.getByTestId('timeline-row-s1-intro')).toBeTruthy();
    expect(screen.getByTestId('timeline-row-logo-reveal')).toBeTruthy();
    expect(screen.getByTestId('param-row-spin').textContent).toContain('0 – 4 (step 0.1)');
    expect(screen.getByTestId('swatch-canvas').textContent).toContain('#E9E5DB');
    expect(screen.getByTestId('design-typography').textContent).toContain('display');
    expect(screen.getByTestId('plan-markdown').textContent).toContain('Warm and editorial.');
  });

  it('shows an empty state when there is no plan yet', async () => {
    renderWithProviders(<PlanViewer />);
    await screen.findByTestId('plan-empty');
  });

  it('lists schema errors for an invalid plan.json', async () => {
    mocks.files.set(`${ROOT}/plan/plan.json`, JSON.stringify({ ...samplePlan, version: 9 }));
    renderWithProviders(<PlanViewer />);
    const box = await screen.findByTestId('plan-invalid');
    expect(box.textContent).toContain('version');
  });

  it('does not render raw HTML from plan.md', async () => {
    mocks.files.set(`${ROOT}/plan/plan.json`, JSON.stringify(samplePlan));
    mocks.files.set(`${ROOT}/plan/plan.md`, 'hello <img src=x onerror=alert(1)> world');
    renderWithProviders(<PlanViewer />);
    const md = await screen.findByTestId('plan-markdown');
    expect(md.querySelector('img')).toBeNull();
  });

  it('re-reads the files on refresh', async () => {
    renderWithProviders(<PlanViewer />);
    await screen.findByTestId('plan-empty');
    mocks.files.set(`${ROOT}/plan/plan.json`, JSON.stringify(samplePlan));
    fireEvent.click(screen.getByRole('button', { name: /^(새로고침|Refresh)/ }));
    await screen.findByTestId('plan-title');
  });

  it('asks for a project folder when none is open', () => {
    mocks.root.current = null;
    renderWithProviders(<PlanViewer />);
    expect(screen.getByTestId('plan-no-project')).toBeTruthy();
  });
});

describe('PlanViewer approval (T3.11)', () => {
  /** brief done so the plan stage is open (not locked). */
  function openPlanStates() {
    const brief = transitionStage(initialStates(), 'brief', 'done');
    if (!brief.ok) throw new Error('fixture failed');
    return brief.states;
  }

  function renderWithPipeline() {
    return renderWithProviders(
      <PipelineProvider>
        <PlanViewer />
      </PipelineProvider>,
    );
  }

  function seedValidPlan() {
    mocks.files.set(`${ROOT}/plan/plan.json`, JSON.stringify(samplePlan));
    mocks.files.set(`${ROOT}/plan/plan.md`, '# Solar plan\n\nWarm and **editorial**.');
    mocks.files.set(`${ROOT}/DESIGN.md`, designFixture);
  }

  it('shows the approval controls for a valid plan when the stage is open', async () => {
    mocks.loadStates.mockResolvedValue(openPlanStates());
    seedValidPlan();
    renderWithPipeline();
    await screen.findByTestId('plan-title');
    expect(screen.getByTestId('plan-approve')).toBeTruthy();
    expect(screen.getByTestId('plan-revision')).toBeTruthy();
  });

  it('approves: checkpoint init, commit, then the next stage opens', async () => {
    mocks.loadStates.mockResolvedValue(openPlanStates());
    seedValidPlan();
    renderWithPipeline();
    fireEvent.click(await screen.findByTestId('plan-approve'));
    await screen.findByTestId('plan-approved');
    expect(mocks.cpInit).toHaveBeenCalledTimes(1);
    expect(mocks.cpCommit).toHaveBeenCalledWith(ROOT, 'plan approved');
    expect(mocks.saveStates).toHaveBeenCalledWith(
      ROOT,
      expect.arrayContaining([expect.objectContaining({ stage: 'plan', status: 'approved', checkpoint: 'abc123' })]),
    );
  });

  it('sends a revision request to the agent and reopens the stage', async () => {
    mocks.loadStates.mockResolvedValue(openPlanStates());
    seedValidPlan();
    const sendPrompt = vi.fn<(text: string) => Promise<string>>(async () => 'end_turn');
    mocks.session.current = { sendPrompt };
    renderWithPipeline();
    await screen.findByTestId('plan-title');
    fireEvent.change(screen.getByTestId('plan-revision'), { target: { value: 'Add a night scene.' } });
    fireEvent.click(screen.getByTestId('plan-request-changes'));
    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
    expect(sendPrompt.mock.calls[0]?.[0]).toContain('Add a night scene.');
    // Still unapproved: the approve button stays instead of the approved note.
    expect(screen.getByTestId('plan-approve')).toBeTruthy();
    expect(screen.queryByTestId('plan-approved')).toBeNull();
  });
});
