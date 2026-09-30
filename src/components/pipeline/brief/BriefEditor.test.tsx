import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { initialStates } from '@/lib/pipeline/pipelineModel';
import { PipelineProvider } from '@/lib/pipeline/PipelineContext';
import { BriefEditor } from '@/components/pipeline/brief/BriefEditor';

const ROOT = 'C:/proj';

const mocks = vi.hoisted(() => ({
  files: new Map<string, string>(),
  external: new Map<string, string>(),
  pick: vi.fn(),
  failImport: { current: false },
  root: { current: 'C:/proj' as string | null },
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
      mocks.files.set(args.path, (args as unknown as { contents: string }).contents);
      return null;
    }
    if (cmd === 'import_external_file') {
      if (mocks.failImport.current) throw new Error('denied');
      mocks.files.set(args.dest, mocks.external.get(args.source) ?? '');
      return null;
    }
    throw new Error(`unexpected command ${cmd}`);
  },
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.pick }));
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => ({ workspaceRoot: mocks.root.current }),
}));
vi.mock('@/lib/pipeline/pipelineRepo', () => ({
  loadPipelineStates: async () => initialStates(),
  savePipelineStates: async () => undefined,
}));

const BRIEF_FILE = `${ROOT}/brief/brief.md`;

const renderEditor = () =>
  renderWithProviders(
    <PipelineProvider>
      <BriefEditor />
    </PipelineProvider>,
  );

const type = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

beforeEach(() => {
  mocks.files.clear();
  mocks.external.clear();
  mocks.pick.mockReset();
  mocks.failImport.current = false;
  mocks.root.current = ROOT;
});

describe('BriefEditor', () => {
  it('creates brief/brief.md on save and reloads it when reopened', async () => {
    const first = renderEditor();
    await screen.findByTestId('brief-editor');
    expect(mocks.files.has(BRIEF_FILE)).toBe(false);

    type('brief-purpose', 'Launch video');
    type('brief-audience', 'Founders');
    type('brief-tone', 'warm\nbold');
    fireEvent.click(screen.getByRole('button', { name: /^(색 추가|Add color)/ }));
    type('brief-color-0', '#F1EE2E');
    fireEvent.click(screen.getByRole('button', { name: /^(저장|Save)$/ }));

    await waitFor(() => expect(mocks.files.has(BRIEF_FILE)).toBe(true));
    const written = mocks.files.get(BRIEF_FILE)!;
    expect(written).toContain('## Purpose\n\nLaunch video');
    expect(written).toContain('- #F1EE2E');
    await waitFor(() => expect(screen.getByTestId('brief-save-state').textContent).toMatch(/저장됨|Saved/));

    first.unmount();
    renderEditor();
    await screen.findByTestId('brief-editor');
    expect((screen.getByTestId('brief-purpose') as HTMLTextAreaElement).value).toBe('Launch video');
    expect((screen.getByTestId('brief-audience') as HTMLInputElement).value).toBe('Founders');
    expect((screen.getByTestId('brief-tone') as HTMLTextAreaElement).value).toBe('warm\nbold');
    expect((screen.getByTestId('brief-color-0') as HTMLInputElement).value).toBe('#F1EE2E');
  });

  it('copies picked files into brief/materials and records the license note', async () => {
    mocks.pick.mockResolvedValue(['D:/downloads/logo.png']);
    renderEditor();
    await screen.findByTestId('brief-editor');

    fireEvent.click(screen.getByRole('button', { name: /^(자료 추가|Add files)/ }));
    await screen.findByTestId('brief-material-logo.png');
    expect(mocks.files.has(`${ROOT}/brief/materials/logo.png`)).toBe(true);

    fireEvent.change(screen.getByLabelText(/^(라이선스|License): logo.png/), { target: { value: 'CC0' } });
    type('brief-purpose', 'x');
    fireEvent.click(screen.getByRole('button', { name: /^(저장|Save)$/ }));
    await waitFor(() => expect(mocks.files.get(BRIEF_FILE)).toContain('- logo.png | license: CC0 | source: '));
  });

  it('numbers a duplicate material file name', async () => {
    mocks.files.set(`${ROOT}/brief/materials/logo.png`, '');
    mocks.pick.mockResolvedValue(['D:/other/logo.png']);
    renderEditor();
    await screen.findByTestId('brief-material-logo.png');
    fireEvent.click(screen.getByRole('button', { name: /^(자료 추가|Add files)/ }));
    await screen.findByTestId('brief-material-logo-2.png');
    expect(mocks.files.has(`${ROOT}/brief/materials/logo-2.png`)).toBe(true);
  });

  it('shows an error when the copy command fails and keeps the list unchanged', async () => {
    mocks.pick.mockResolvedValue(['D:/x/a.png']);
    mocks.failImport.current = true;
    renderEditor();
    await screen.findByTestId('brief-editor');
    fireEvent.click(screen.getByRole('button', { name: /^(자료 추가|Add files)/ }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('denied');
    expect(screen.queryByTestId('brief-material-a.png')).toBeNull();
  });

  it('flags invalid brand colors and blocks completion', async () => {
    renderEditor();
    await screen.findByTestId('brief-editor');
    type('brief-purpose', 'p');
    fireEvent.click(screen.getByRole('button', { name: /^(색 추가|Add color)/ }));
    type('brief-color-0', 'red');
    expect(screen.getByTestId('brief-color-0').getAttribute('aria-invalid')).toBe('true');
    expect((screen.getByRole('button', { name: /^(브리프 완료|Complete brief)/ }) as HTMLButtonElement).disabled).toBe(true);
    type('brief-color-0', '#ABCDEF');
    expect((screen.getByRole('button', { name: /^(브리프 완료|Complete brief)/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('completes the brief: saves the file and finishes the Brief stage', async () => {
    renderEditor();
    await screen.findByTestId('brief-editor');
    expect((screen.getByRole('button', { name: /^(브리프 완료|Complete brief)/ }) as HTMLButtonElement).disabled).toBe(true);
    type('brief-purpose', 'Ready');
    fireEvent.click(screen.getByRole('button', { name: /^(브리프 완료|Complete brief)/ }));
    await screen.findByText(/브리프가 완료되었습니다|The brief is complete/);
    expect(mocks.files.get(BRIEF_FILE)).toContain('Ready');
  });

  it('asks for a project folder when none is open', () => {
    mocks.root.current = null;
    renderEditor();
    expect(screen.getByTestId('brief-no-project')).toBeTruthy();
  });
});
