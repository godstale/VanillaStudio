import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import type { WorkspaceApi } from '@/lib/workspace/api';

const ctx = vi.hoisted(() => ({ setWorkspaceRoot: vi.fn(), trustWorkspace: vi.fn() }));
const nav = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('@/lib/context/WorkspaceContext', () => ({ useWorkspace: () => ctx }));
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => nav.navigate };
});
vi.mock('@/lib/db/repositories/workspacesRepo', () => ({ touchWorkspace: vi.fn(async () => undefined) }));

import { Onboarding } from './Onboarding';

function makeApi(over: Partial<WorkspaceApi>): WorkspaceApi {
  return {
    pickFolder: vi.fn(async () => '/work/reel'),
    inspectFolder: vi.fn(async () => ({ kind: 'empty' as const })),
    createWorkspace: vi.fn(async () => 'ws_1'),
    openWorkspace: vi.fn(async () => ({ kind: 'workspace' as const, workspaceId: 'ws_1', name: 'reel' })),
    installDeps: vi.fn(async () => 0),
    ...over,
  };
}

const renderOnboarding = (api: WorkspaceApi) =>
  render(
    <LanguageProvider>
      <Onboarding api={api} />
    </LanguageProvider>,
  );

const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  nav.navigate.mockClear();
});

describe('Onboarding', () => {
  it('creates a workspace in an empty folder and enters it', async () => {
    const api = makeApi({});
    renderOnboarding(api);
    click(/폴더 선택|Choose folder/);
    const nameInput = await screen.findByDisplayValue('reel');
    fireEvent.change(nameInput, { target: { value: 'My Reel' } });
    fireEvent.click(screen.getByRole('button', { name: /초기화 및 열기|Initialize & Create|만들기|Create/ }));
    await waitFor(() => expect(ctx.setWorkspaceRoot).toHaveBeenCalledWith('/work/reel'));
    await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith('/storyboard'));
    expect(api.createWorkspace).toHaveBeenCalledWith(
      '/work/reel',
      'My Reel',
      expect.objectContaining({ aspect: '16:9', width: 1920, height: 1080, fps: 30 }),
    );
    expect(api.installDeps).toHaveBeenCalled();
    expect(ctx.trustWorkspace).toHaveBeenCalledWith('/work/reel');
  });

  it('skips pnpm install when the consent box is cleared', async () => {
    const api = makeApi({});
    renderOnboarding(api);
    click(/폴더 선택|Choose folder/);
    await screen.findByDisplayValue('reel');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /초기화 및 열기|Initialize & Create|만들기|Create/ }));
    await waitFor(() => expect(ctx.setWorkspaceRoot).toHaveBeenCalled());
    await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith('/storyboard'));
    expect(api.installDeps).not.toHaveBeenCalled();
  });

  it('opens an existing workspace without creating', async () => {
    const api = makeApi({ inspectFolder: vi.fn(async () => ({ kind: 'workspace' as const, workspaceId: 'ws_9', name: 'x' })) });
    renderOnboarding(api);
    click(/폴더 선택|Choose folder/);
    await waitFor(() => expect(ctx.setWorkspaceRoot).toHaveBeenCalledWith('/work/reel'));
    await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith('/storyboard'));
    expect(api.createWorkspace).not.toHaveBeenCalled();
  });

  it('allows initializing a non-empty folder (kind: other) while showing preservation notice instead of an error', async () => {
    const api = makeApi({ inspectFolder: vi.fn(async () => ({ kind: 'other' as const })) });
    renderOnboarding(api);
    click(/폴더 선택|Choose folder/);
    expect(await screen.findByTestId('onboarding-preserve-notice')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /초기화 및 열기|Initialize & Create|만들기|Create/ }));
    await waitFor(() => expect(ctx.setWorkspaceRoot).toHaveBeenCalledWith('/work/reel'));
    expect(api.createWorkspace).toHaveBeenCalledWith(
      '/work/reel',
      'reel',
      expect.objectContaining({ aspect: '16:9', width: 1920, height: 1080, fps: 30 }),
    );
  });

  it('still enters the workspace when pnpm install fails', async () => {
    const api = makeApi({ installDeps: vi.fn(async () => Promise.reject(new Error('boom'))) });
    renderOnboarding(api);
    click(/폴더 선택|Choose folder/);
    await screen.findByDisplayValue('reel');
    fireEvent.click(screen.getByRole('button', { name: /초기화 및 열기|Initialize & Create|만들기|Create/ }));
    await waitFor(() => expect(ctx.setWorkspaceRoot).toHaveBeenCalledWith('/work/reel'));
  });
});
