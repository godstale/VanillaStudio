import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

const repo = vi.hoisted(() => ({
  touchWorkspace: vi.fn(async () => undefined),
  getWorkspaceByPath: vi.fn(async () => null),
}));
vi.mock('@/lib/db/repositories/workspacesRepo', () => repo);

import { invoke } from '@tauri-apps/api/core';
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <WorkspaceProvider>{children}</WorkspaceProvider>
);

describe('WorkspaceProvider trust', () => {
  beforeEach(() => localStorage.clear());

  it('asks for confirmation when opening an unknown folder', () => {
    const { result } = renderHook(useWorkspace, { wrapper });
    act(() => result.current.setWorkspaceRoot('/p/unknown'));
    expect(result.current.isTrusted).toBe(false);
    expect(result.current.trustModalOpen).toBe(true);
  });

  it('trustWorkspace before opening skips the trust dialog', () => {
    const { result } = renderHook(useWorkspace, { wrapper });
    act(() => {
      result.current.trustWorkspace('/p/wizard');
      result.current.setWorkspaceRoot('/p/wizard');
    });
    expect(result.current.isTrusted).toBe(true);
    expect(result.current.trustModalOpen).toBe(false);
  });

  it('trusting one path does not trust another', async () => {
    const { result } = renderHook(useWorkspace, { wrapper });
    act(() => result.current.trustWorkspace('/p/wizard'));
    act(() => result.current.setWorkspaceRoot('/p/other'));
    await waitFor(() => expect(result.current.trustModalOpen).toBe(true));
    expect(result.current.isTrusted).toBe(false);
  });
});

describe('WorkspaceProvider history', () => {
  beforeEach(() => localStorage.clear());

  it('records every opened workspace in the history, whichever screen opened it', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string, args?: unknown) => {
      if (cmd !== 'inspect_workspace_folder') return undefined;
      const path = (args as { path: string }).path;
      return { kind: 'workspace', workspaceId: `id:${path}`, name: path.slice(-1).toUpperCase() };
    });
    const { result } = renderHook(useWorkspace, { wrapper });
    act(() => result.current.setWorkspaceRoot('/w/a'));
    await waitFor(() => expect(repo.touchWorkspace).toHaveBeenCalledWith({ workspaceId: 'id:/w/a', path: '/w/a', name: 'A' }));
    act(() => result.current.setWorkspaceRoot('/w/b'));
    await waitFor(() => expect(repo.touchWorkspace).toHaveBeenCalledWith({ workspaceId: 'id:/w/b', path: '/w/b', name: 'B' }));
  });
});
