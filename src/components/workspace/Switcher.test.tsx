import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import type { WorkspaceApi } from '@/lib/workspace/api';

const ctx = vi.hoisted(() => ({ workspaceRoot: '/w/current' as string | null, setWorkspaceRoot: vi.fn() }));
const repo = vi.hoisted(() => ({
  listRecentWorkspaces: vi.fn(),
  removeWorkspace: vi.fn(async () => undefined),
}));
vi.mock('@/lib/context/WorkspaceContext', () => ({ useWorkspace: () => ctx }));
vi.mock('@/lib/db/repositories/workspacesRepo', () => repo);

import { registerBusy } from '@/lib/workspace/switchGuard';
import { Switcher } from './Switcher';

const rec = (id: string, path: string) => ({ workspaceId: id, path, name: `N-${id}`, trusted: true, lastOpenedAt: '2026-01-01' });
const api = (): WorkspaceApi => ({
  pickFolder: vi.fn(),
  inspectFolder: vi.fn(),
  createWorkspace: vi.fn(),
  openWorkspace: vi.fn(async () => ({ kind: 'workspace' as const, workspaceId: 'x', name: 'x' })),
  installDeps: vi.fn(),
});

function open(a: WorkspaceApi) {
  render(
    <LanguageProvider>
      <MemoryRouter>
        <Switcher api={a} />
      </MemoryRouter>
    </LanguageProvider>,
  );
  const trigger = screen.getByRole('button');
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.listRecentWorkspaces.mockResolvedValue([rec('a', '/w/a'), rec('b', '/w/b')]);
});

describe('Switcher', () => {
  it('opens a recent workspace', async () => {
    const a = api();
    open(a);
    fireEvent.click(await screen.findByText('N-a'));
    await waitFor(() => expect(ctx.setWorkspaceRoot).toHaveBeenCalledWith('/w/a'));
    expect(a.openWorkspace).toHaveBeenCalledWith('/w/a');
  });

  it('"new" clears the workspace so onboarding shows', async () => {
    open(api());
    fireEvent.click(await screen.findByText(/새로 만들기|New \/ open/));
    await waitFor(() => expect(ctx.setWorkspaceRoot).toHaveBeenCalledWith(null));
  });

  it('asks before stopping running work, then switches', async () => {
    const stop = vi.fn();
    const off = registerBusy({ label: 'Terminal (claude)', onStop: stop });
    open(api());
    fireEvent.click(await screen.findByText('N-b'));
    expect(await screen.findByText('Terminal (claude)')).toBeTruthy();
    expect(ctx.setWorkspaceRoot).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /정리하고 전환|Stop and switch/ }));
    await waitFor(() => expect(ctx.setWorkspaceRoot).toHaveBeenCalledWith('/w/b'));
    expect(stop).toHaveBeenCalledOnce();
    off();
  });

  it('drops a stale recent entry when the folder cannot be opened', async () => {
    const a = api();
    a.openWorkspace = vi.fn(async () => Promise.reject(new Error('gone')));
    open(a);
    fireEvent.click(await screen.findByText('N-a'));
    await waitFor(() => expect(repo.removeWorkspace).toHaveBeenCalledWith('a'));
    expect(ctx.setWorkspaceRoot).not.toHaveBeenCalled();
  });

  it('removes a recent entry via the delete icon without switching', async () => {
    const a = api();
    open(a);
    const del = await screen.findByRole('button', { name: /N-a/ });
    fireEvent.click(del);
    await waitFor(() => expect(repo.removeWorkspace).toHaveBeenCalledWith('a'));
    expect(ctx.setWorkspaceRoot).not.toHaveBeenCalled();
    expect(a.openWorkspace).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('N-a')).toBeNull());
    expect(screen.getByText('N-b')).toBeTruthy();
  });
});
