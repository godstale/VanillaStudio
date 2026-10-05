import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { AppShell } from './AppShell';
import { EmptyScreen } from './EmptyScreen';

function renderShell(initial: string) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/workspace" element={<EmptyScreen title="WS-SCREEN" />} />
            <Route path="/scenes" element={<EmptyScreen title="SCENES-SCREEN" />} />
            <Route path="/playground" element={<EmptyScreen title="PLAY-SCREEN" />} />
          </Route>
          <Route path="/settings" element={<div>SETTINGS-SCREEN</div>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('AppShell', () => {
  it('shows the four sidebar entries and the inspector/dock slots', () => {
    const { container } = renderShell('/workspace');
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(container.querySelector('[data-slot="inspector"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="dock"]')).not.toBeNull();
    expect(screen.getByText('WS-SCREEN')).toBeTruthy();
  });

  it('navigates between screens from the sidebar', () => {
    renderShell('/workspace');
    const links = screen.getAllByRole('link');
    fireEvent.click(links[1]);
    expect(screen.getByText('SCENES-SCREEN')).toBeTruthy();
    fireEvent.click(links[2]);
    expect(screen.getByText('PLAY-SCREEN')).toBeTruthy();
    fireEvent.click(links[3]);
    expect(screen.getByText('SETTINGS-SCREEN')).toBeTruthy();
  });
});
