import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { initialStates, transitionStage } from '@/lib/pipeline/pipelineModel';
import { PipelineProvider } from '@/lib/pipeline/PipelineContext';
import { PromptsTab } from './PromptsTab';

const ROOT = 'C:/proj';
const VALID_TASKS = JSON.stringify({
  version: 1,
  tasks: [
    { id: 'T01', kind: 'asset', target: 'logo', prompt: 'prompts/assets/logo.md', dependsOn: [] },
    { id: 'T02', kind: 'compose', target: '', prompt: 'prompts/00-master.md', dependsOn: ['T01'] },
  ],
});

const mocks = vi.hoisted(() => ({
  files: new Map<string, string>(),
  root: { current: 'C:/proj' as string | null },
  loadStates: vi.fn(),
  saveStates: vi.fn(),
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
    if (cmd === 'write_text_file') {
      mocks.files.set(args.path, args.contents);
      return null;
    }
    throw new Error(`unexpected command ${cmd}`);
  },
}));
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => ({ workspaceRoot: mocks.root.current }),
}));
vi.mock('@/lib/agents/sessionContextValue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agents/sessionContextValue')>();
  return { ...actual, useSafeAgentSession: () => null };
});
vi.mock('@/lib/pipeline/pipelineRepo', () => ({
  loadPipelineStates: mocks.loadStates,
  savePipelineStates: mocks.saveStates,
}));

/** brief done + plan approved so the prompts stage is open (not locked). */
function openPromptsStates() {
  const brief = transitionStage(initialStates(), 'brief', 'done');
  if (!brief.ok) throw new Error('fixture failed');
  const plan = transitionStage(brief.states, 'plan', 'approved');
  if (!plan.ok) throw new Error('fixture failed');
  return plan.states;
}

function renderTab() {
  return renderWithProviders(
    <PipelineProvider>
      <PromptsTab />
    </PipelineProvider>,
  );
}

beforeEach(() => {
  mocks.files.clear();
  mocks.root.current = ROOT;
  mocks.loadStates.mockReset().mockResolvedValue(openPromptsStates());
  mocks.saveStates.mockReset().mockResolvedValue(undefined);
});

describe('PromptsTab', () => {
  it('shows an empty state when nothing was generated yet', async () => {
    renderTab();
    await screen.findByTestId('prompts-empty');
    expect((screen.getByTestId('prompts-generate') as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists prompt files, validates tasks.json and draws the graph', async () => {
    mocks.files.set(`${ROOT}/prompts/00-master.md`, '# Master\n\nBuild order.');
    mocks.files.set(`${ROOT}/prompts/assets/logo.md`, '# Logo\n\nMake it.');
    mocks.files.set(`${ROOT}/prompts/tasks.json`, VALID_TASKS);
    renderTab();
    await waitFor(() => expect(screen.getByTestId('prompt-file-prompts/00-master.md')).toBeTruthy());
    expect(screen.getByTestId('task-node-T01')).toBeTruthy();
    expect(screen.queryByTestId('prompts-tasks-invalid')).toBeNull();
    expect(screen.getByTestId('prompts-approve')).toBeTruthy();
  });

  it('lists schema errors for an invalid tasks.json', async () => {
    mocks.files.set(`${ROOT}/prompts/00-master.md`, '# Master');
    mocks.files.set(
      `${ROOT}/prompts/tasks.json`,
      JSON.stringify({
        tasks: [{ id: 'T01', kind: 'asset', target: 'logo', prompt: 'nope.txt', dependsOn: [] }],
      }),
    );
    renderTab();
    const box = await screen.findByTestId('prompts-tasks-invalid');
    expect(box.textContent).toContain('.md');
    expect(screen.queryByTestId('prompts-approve')).toBeNull();
  });

  it('opens a file and saves edits', async () => {
    mocks.files.set(`${ROOT}/prompts/00-master.md`, '# Master');
    mocks.files.set(`${ROOT}/prompts/tasks.json`, VALID_TASKS);
    renderTab();
    fireEvent.click(await screen.findByTestId('prompt-file-prompts/00-master.md'));
    await waitFor(() => expect(screen.getByTestId('prompt-editor')).toBeTruthy());
    expect(screen.getByTestId('prompt-save-state').textContent).toMatch(/저장됨|Saved/);
  });

  it('asks for a project folder when none is open', () => {
    mocks.root.current = null;
    renderTab();
    expect(screen.getByTestId('prompts-no-project')).toBeTruthy();
  });
});
