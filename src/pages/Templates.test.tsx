import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { Templates } from './Templates';

vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => null,
}));

describe('Templates', () => {
  it('shows tabs and guide cards in a gallery with favorites and apply', () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('templates-page')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /가이드 템플릿|Guide templates/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /컬러 팔레트|Color palettes/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /구성 기법|Techniques/ })).toBeTruthy();
    // 내장 가이드 3종(타입별 1개).
    expect(screen.getAllByTestId('guide-card').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /즐겨찾기|Favorite/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /적용|Apply/ })[0]);
    expect(screen.getByTestId('template-apply-dialog')).toBeTruthy();
  });

  it('shows the palette gallery on its tab', () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /컬러 팔레트|Color palettes/ }));
    expect(screen.getByText('Paper Dawn')).toBeTruthy();
    expect(screen.getAllByTestId('palette-card').length).toBeGreaterThan(0);
  });

  it('shows technique cards on its tab', () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /구성 기법|Techniques/ }));
    expect(screen.getAllByTestId('technique-card').length).toBeGreaterThan(0);
  });
});
