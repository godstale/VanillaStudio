import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { SqlDatabase } from '@/lib/db/client';
import type { WorkspaceTab } from '@/lib/types/workspaceTab';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

const dbs = vi.hoisted(() => new Map<string, unknown>());

vi.mock('@/lib/db/client', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  const dbFor = (key: string) => {
    if (!dbs.has(key)) dbs.set(key, new actual.MemorySqlFallback());
    return dbs.get(key) as SqlDatabase;
  };
  return {
    ...actual,
    getGlobalDatabase: async () => dbFor('<global>'),
    getProjectDatabase: async (root?: string | null) => dbFor(root ?? '<global>'),
  };
});

import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';
import {
  WorkspaceTabsProvider,
  useWorkspaceTabs,
} from './WorkspaceTabsContext';
import { seedOpenTabs } from '@/lib/project/openProject';
import * as settingsRepo from '@/lib/db/repositories/settingsRepo';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <WorkspaceTabsProvider>{children}</WorkspaceTabsProvider>
    </WorkspaceProvider>
  );
}

function useBoth() {
  return { ws: useWorkspace(), tabs: useWorkspaceTabs() };
}

const brief: WorkspaceTab = { id: 'brief:main', type: 'brief', title: 'Brief', pane: 'primary' };
const plan: WorkspaceTab = { id: 'plan:main', type: 'plan', title: 'Plan', pane: 'primary' };

async function tabsOf(root: string) {
  const db = (await import('@/lib/db/client')).getProjectDatabase(root);
  return (await settingsRepo.getSettings(await db)).openTabs.map((t) => t.id);
}

describe('WorkspaceTabsProvider per-project tabs', () => {
  beforeEach(() => {
    dbs.clear();
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('restores each project own tabs and drops the previous project tabs on switch', async () => {
    await seedOpenTabs('/p/a', [brief]);
    await seedOpenTabs('/p/b', [plan]);
    // /p/c has no saved tabs at all.

    const { result } = renderHook(useBoth, { wrapper });
    act(() => result.current.ws.setWorkspaceRoot('/p/a'));
    await waitFor(() =>
      expect(result.current.tabs.tabs.map((t) => t.id)).toEqual(['brief:main']),
    );

    act(() => result.current.ws.setWorkspaceRoot('/p/b'));
    expect(result.current.tabs.tabs).toEqual([]); // never shows A's tabs under B
    await waitFor(() =>
      expect(result.current.tabs.tabs.map((t) => t.id)).toEqual(['plan:main']),
    );

    act(() => result.current.ws.setWorkspaceRoot('/p/c'));
    await waitFor(() => expect(result.current.tabs.isTabsLoaded).toBe(true));
    expect(result.current.tabs.tabs).toEqual([]);
  });

  it('saves tab changes into the project DB of the current root only', async () => {
    const { result } = renderHook(useBoth, { wrapper });
    act(() => result.current.ws.setWorkspaceRoot('/p/a'));
    await waitFor(() => expect(result.current.tabs.isTabsLoaded).toBe(true));
    act(() => {
      result.current.tabs.openTab({ type: 'plan', title: 'Plan', id: 'plan:main' });
    });
    await waitFor(async () => expect(await tabsOf('/p/a')).toEqual(['plan:main']), {
      timeout: 2000,
    });
    expect(await tabsOf('/p/b')).toEqual([]);
  });

  it('opens the brief tab seeded by the wizard for a newly created project', async () => {
    const { result } = renderHook(useBoth, { wrapper });
    act(() => result.current.ws.setWorkspaceRoot('/p/a'));
    await waitFor(() => expect(result.current.tabs.isTabsLoaded).toBe(true));

    await seedOpenTabs('/p/new', [brief]);
    act(() => result.current.ws.setWorkspaceRoot('/p/new'));
    await waitFor(() => {
      expect(result.current.tabs.tabs.map((t) => t.id)).toEqual(['brief:main']);
      expect(result.current.tabs.activeTabId).toBe('brief:main');
    });
  });
});
