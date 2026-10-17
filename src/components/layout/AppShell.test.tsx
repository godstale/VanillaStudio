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
            <Route path="/workspace" element={<EmptyScreen title="SEQUENCE-SCREEN" />} />
            <Route path="/scenes" element={<EmptyScreen title="SCENES-SCREEN" />} />
            <Route path="/templates" element={<EmptyScreen title="TEMPLATES-SCREEN" />} />
            <Route path="/playground" element={<EmptyScreen title="PLAY-SCREEN" />} />
          </Route>
          <Route path="/settings" element={<div>SETTINGS-SCREEN</div>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('AppShell', () => {
  it('shows the four sidebar entries plus settings pinned at the bottom', () => {
    renderShell('/workspace');
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(links[4].getAttribute('href')).toContain('/settings');
    expect(screen.getByText('SEQUENCE-SCREEN')).toBeTruthy();
  });

  it('navigates between screens from the sidebar', () => {
    renderShell('/workspace');
    const links = screen.getAllByRole('link');
    fireEvent.click(links[1]);
    expect(screen.getByText('SCENES-SCREEN')).toBeTruthy();
    fireEvent.click(links[2]);
    expect(screen.getByText('TEMPLATES-SCREEN')).toBeTruthy();
    fireEvent.click(links[3]);
    expect(screen.getByText('PLAY-SCREEN')).toBeTruthy();
    fireEvent.click(links[4]);
    expect(screen.getByText('SETTINGS-SCREEN')).toBeTruthy();
  });
});
