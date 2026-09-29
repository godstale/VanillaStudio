import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { TemplatesPanel } from './TemplatesPanel';

const ROOT = 'C:/proj';
const DESIGN = `---
colors:
  canvas: "#FFFFFF"
  ink: "#111111"
  primary: "#1E2BFA"
  accent: "#F59E0B"
---
# Brand
`;
const MANIFEST = JSON.stringify({
  version: 1,
  name: 'Demo',
  outputType: 'video',
  format: { width: 1920, height: 1080, fps: 30, durationSec: 10 },
  template: null,
  palette: { id: 'default', source: 'builtin' },
  agents: { default: 'claude-code', enabled: ['claude-code'] },
  runtime: { version: '0.1.0' },
  createdAt: '2026-09-29T00:00:00.000Z',
});

const mocks = vi.hoisted(() => ({ files: new Map<string, string>(), opened: [] as unknown[] }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, string>) => {
    if (cmd === 'list_dir') {
      const dir = (args.path as string).replace(/\/$/, '');
      const entries = [...mocks.files.keys()]
        .filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'))
        .map((p) => ({ name: p.slice(dir.length + 1), path: p, is_dir: false, size: 0 }));
      if (entries.length === 0) throw new Error('not found');
      return entries;
    }
    if (cmd === 'read_text_file') {
      const text = mocks.files.get(args.path as string);
      if (text === undefined) throw new Error('missing');
      return text;
    }
    if (cmd === 'write_text_file') {
      mocks.files.set(args.path as string, (args as unknown as { contents: string }).contents);
      return null;
    }
    if (cmd === 'checkpoint_commit') return { id: 'abc123', backend: 'git' };
    throw new Error(`unexpected command ${cmd}`);
  },
}));
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => ({ workspaceRoot: ROOT }),
}));
vi.mock('@/lib/context/WorkspaceTabsContext', () => ({
  useWorkspaceTabs: () => ({
    openTab: (tab: unknown) => {
      mocks.opened.push(tab);
      return 'palette:paper-dawn';
    },
  }),
}));

function openPalettes() {
  renderWithProviders(<TemplatesPanel />);
  fireEvent.click(screen.getByRole('button', { name: '팔레트' }));
}

describe('TemplatesPanel', () => {
  beforeEach(() => {
    mocks.files.clear();
    mocks.opened.length = 0;
    mocks.files.set(`${ROOT}/DESIGN.md`, DESIGN);
    mocks.files.set(`${ROOT}/vanilla.json`, MANIFEST);
  });

  it('keeps the templates placeholder on the first tab', () => {
    renderWithProviders(<TemplatesPanel />);
    expect(screen.getByTestId('empty-panel-templates')).toBeTruthy();
  });

  it('lists built-in palettes with search and scheme filter', async () => {
    openPalettes();
    expect(await screen.findByTestId('palette-option-paper-dawn')).toBeTruthy();
    expect(screen.getByTestId('palette-option-midnight-rampart')).toBeTruthy();

    fireEvent.change(screen.getByTestId('palette-search'), { target: { value: 'rampart' } });
    expect(screen.queryByTestId('palette-option-paper-dawn')).toBeNull();
    expect(screen.getByTestId('palette-option-midnight-rampart')).toBeTruthy();

    fireEvent.change(screen.getByTestId('palette-search'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('palette-scheme-dark'));
    expect(screen.queryByTestId('palette-option-paper-dawn')).toBeNull();
    expect(screen.getByTestId('palette-option-ember-night')).toBeTruthy();
  });

  it('opens the palette editor tab', async () => {
    openPalettes();
    await screen.findByTestId('palette-option-paper-dawn');
    fireEvent.click(screen.getByTestId('palette-edit-paper-dawn'));
    expect(mocks.opened).toContainEqual(
      expect.objectContaining({ type: 'palette', meta: { paletteId: 'paper-dawn' } }),
    );
  });

  it('applies a palette to the open project', async () => {
    openPalettes();
    await screen.findByTestId('palette-option-paper-dawn');
    fireEvent.click(screen.getByTestId('palette-apply-paper-dawn'));
    await waitFor(() => expect(mocks.files.get(`${ROOT}/DESIGN.md`) ?? '').toContain('canvas: "#FAF6EC"'));
    const manifest = JSON.parse(mocks.files.get(`${ROOT}/vanilla.json`) ?? '{}') as { palette: unknown };
    expect(manifest.palette).toEqual({ id: 'paper-dawn', source: 'builtin' });
  });
});
