import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useWorkspace: () => ({ workspaceRoot: null, setWorkspaceRoot: vi.fn() }),
}));
vi.mock('@/lib/db/repositories/workspacesRepo', () => ({
  listRecentWorkspaces: async () => [],
  removeWorkspace: async () => undefined,
}));

import { AppShell } from './AppShell';
import { EmptyScreen } from './EmptyScreen';

function renderShell(initial: string) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/storyboard" element={<EmptyScreen title="STORYBOARD-SCREEN" />} />
            <Route path="/workspace" element={<EmptyScreen title="SEQUENCE-SCREEN" />} />
            <Route path="/workspaces" element={<EmptyScreen title="WORKSPACES-SCREEN" />} />
            <Route path="/scenes" element={<EmptyScreen title="SCENES-SCREEN" />} />
            <Route path="/templates" element={<EmptyScreen title="TEMPLATES-SCREEN" />} />
            <Route path="/play" element={<EmptyScreen title="PLAY-SCREEN" />} />
          </Route>
          <Route path="/settings" element={<div>SETTINGS-SCREEN</div>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('AppShell', () => {
  it('shows the sidebar entries plus settings pinned at the bottom', () => {
    renderShell('/workspace');
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
    expect(links[0].getAttribute('href')).toContain('/storyboard');
    expect(links[5].getAttribute('href')).toContain('/settings');
    expect(screen.getByText('SEQUENCE-SCREEN')).toBeTruthy();
  });

  it('navigates between screens from the sidebar', () => {
    renderShell('/workspace');
    const links = screen.getAllByRole('link');
    fireEvent.click(links[0]);
    expect(screen.getByText('STORYBOARD-SCREEN')).toBeTruthy();
    fireEvent.click(links[2]);
    expect(screen.getByText('SCENES-SCREEN')).toBeTruthy();
    fireEvent.click(links[3]);
    expect(screen.getByText('TEMPLATES-SCREEN')).toBeTruthy();
    fireEvent.click(links[4]);
    expect(screen.getByText('PLAY-SCREEN')).toBeTruthy();
    fireEvent.click(links[5]);
    expect(screen.getByText('SETTINGS-SCREEN')).toBeTruthy();
  });

  it('blocks the context menu outside designated areas', () => {
    renderShell('/workspace');
    // fireEvent는 preventDefault가 불리면 false를 돌려준다.
    expect(fireEvent.contextMenu(screen.getByText('SEQUENCE-SCREEN'))).toBe(false);
  });
});
