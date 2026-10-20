import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { Playground } from './Playground';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useWorkspace: () => ({ workspaceRoot: '/w', setWorkspaceRoot: vi.fn() }),
}));

function renderPlayground() {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/playground']}>
        <Routes>
          <Route path="/playground" element={<Playground />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('Playground (disabled)', () => {
  it('shows the disabled notice with a link to Play and no player', async () => {
    renderPlayground();
    expect(await screen.findByText(/비활성화|disabled/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /재생 메뉴|Go to Play/ })).toBeTruthy();
    expect(screen.queryByTestId('sequence-player')).toBeNull();
    expect(screen.queryByTestId('playground-float-player')).toBeNull();
  });
});
