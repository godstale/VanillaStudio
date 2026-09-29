import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

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
