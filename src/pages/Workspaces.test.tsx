import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

const tauri = vi.hoisted(() => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@tauri-apps/api/core', () => tauri);

const ctx = vi.hoisted(() => ({ workspaceRoot: '/w/current' as string | null, setWorkspaceRoot: vi.fn() }));
vi.mock('@/lib/context/WorkspaceContext', () => ({ useWorkspace: () => ctx }));

const repo = vi.hoisted(() => ({
  listRecentWorkspaces: vi.fn(),
  removeWorkspace: vi.fn(async () => undefined),
}));
vi.mock('@/lib/db/repositories/workspacesRepo', () => repo);

const api = vi.hoisted(() => ({
  openWorkspace: vi.fn(async () => ({ kind: 'workspace' as const, workspaceId: 'x', name: 'x' })),
  pickFolder: vi.fn(async () => null),
}));
vi.mock('@/lib/workspace/api', () => ({ tauriWorkspaceApi: api }));
vi.mock('@/lib/scene/files', () => ({ listScenes: async () => [] }));

import { Workspaces } from './Workspaces';

const rec = (id: string, path: string, name: string) => ({
  workspaceId: id,
  path,
  name,
  trusted: true,
  lastOpenedAt: '2026-10-01',
});

function renderWorkspaces() {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/workspaces']}>
        <Routes>
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/workspace" element={<div>WORKSPACE-SCREEN</div>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.listRecentWorkspaces.mockResolvedValue([rec('a', '/w/a', 'Alpha'), rec('cur', '/w/current', 'Current')]);
});

describe('Workspaces', () => {
  it('opens the workspace when its card is clicked', async () => {
    renderWorkspaces();
    fireEvent.click(await screen.findByRole('button', { name: /Alpha 열기|Open Alpha/ }));
    await waitFor(() => expect(api.openWorkspace).toHaveBeenCalledWith('/w/a'));
    expect(ctx.setWorkspaceRoot).toHaveBeenCalledWith('/w/a');
    expect(await screen.findByText('WORKSPACE-SCREEN')).toBeTruthy();
  });

  it('tags only the current workspace card', async () => {
    renderWorkspaces();
    await screen.findByText('Alpha');
    const badges = screen.getAllByTestId('workspace-current-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0].closest('li')?.textContent).toContain('Current');
  });

  it('deletes a history card without opening it', async () => {
    renderWorkspaces();
    await screen.findByText('Alpha');
    const del = screen.getByRole('button', { name: /목록에서 삭제: Alpha|Remove from list: Alpha/ });
    fireEvent.click(del);
    await waitFor(() => expect(repo.removeWorkspace).toHaveBeenCalledWith('a'));
    expect(api.openWorkspace).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull());
    expect(screen.getByText('Current')).toBeTruthy();
  });

  it('reveals the current workspace folder in Explorer', async () => {
    renderWorkspaces();
    fireEvent.click(await screen.findByRole('button', { name: /탐색기에서 열기|Reveal in Explorer/ }));
    await waitFor(() =>
      expect(tauri.invoke).toHaveBeenCalledWith('reveal_in_explorer', {
        path: '/w/current',
        workspaceRoot: '/w/current',
      }),
    );
  });
});
