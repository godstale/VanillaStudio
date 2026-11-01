import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { Templates } from './Templates';

vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => null,
}));

describe('Templates', () => {
  it('splits project templates from styles and searches the 200-style library', () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    expect(screen.getAllByTestId('project-template-card').length).toBeGreaterThanOrEqual(8);
    fireEvent.click(screen.getByRole('tab', { name: /^(스타일|Styles)$/ }));
    expect(screen.getAllByTestId('style-card')).toHaveLength(200);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'chrome' } });
    expect(screen.getAllByTestId('style-card').length).toBeLessThan(200);
    fireEvent.click(screen.getAllByRole('button', { name: /적용|Apply/ })[0]);
    expect(screen.getByTestId('style-apply-dialog')).toBeTruthy();
  });

  it('opens an example with its note and source from a style card', async () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /^(스타일|Styles)$/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'popart' } });
    fireEvent.click(screen.getByTestId('example-thumb'));
    const dialog = screen.getByTestId('example-dialog');
    expect(dialog.textContent).toMatch(/망점|halftone/);
    fireEvent(dialog.querySelector('details')!, new Event('toggle'));
    expect(await screen.findByText(/<!doctype html>/)).toBeTruthy();
  });

  it('shows tabs, preview thumbnails, and live demo links on guide cards', () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /^(스타일|Styles)$/ }));
    expect(screen.getByTestId('templates-page')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /신 가이드|Scene guides/ }));
    expect(screen.getByRole('tab', { name: /세부 프리셋|Decomposed Presets/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Opus 쇼케이스 레시피|Opus Showcase Recipes/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /컬러 팔레트|Color palettes/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /구성 기법|Techniques/ })).toBeTruthy();

    expect(screen.getAllByTestId('guide-card').length).toBeGreaterThanOrEqual(15);
    expect(screen.getAllByTestId('live-demo-link').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /즐겨찾기|Favorite/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /적용|Apply/ })[0]);
    expect(screen.getByTestId('template-apply-dialog')).toBeTruthy();
  });

  it('shows decomposed building-block presets and filters them by category', () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /^(스타일|Styles)$/ }));
    fireEvent.click(screen.getByRole('tab', { name: /세부 프리셋|Decomposed Presets/ }));
    const allCards = screen.getAllByTestId('decomposed-card');
    expect(allCards.length).toBeGreaterThanOrEqual(12);
    expect(screen.getAllByTestId('live-demo-link').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /타이포그래피|Typography/ }));
    const typoCards = screen.getAllByTestId('decomposed-card');
    expect(typoCards.length).toBeGreaterThan(0);
    expect(typoCards.length).toBeLessThan(allCards.length);
  });

  it('shows Opus showcase recipes and filters by media intent', () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /^(스타일|Styles)$/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Opus 쇼케이스 레시피|Opus Showcase Recipes/ }));
    const allRecipes = screen.getAllByTestId('recipe-card');
    expect(allRecipes.length).toBeGreaterThanOrEqual(20);

    const mediaGroup = screen.getByRole('group', { name: /매체 분류|Media/ });
    fireEvent.click(within(mediaGroup).getByRole('button', { name: /슬라이드|Slide/ }));
    const slideRecipes = screen.getAllByTestId('recipe-card');
    expect(slideRecipes.length).toBeGreaterThan(0);
    expect(slideRecipes.length).toBeLessThan(allRecipes.length);
  });

  it('shows the palette gallery on its tab', () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /^(스타일|Styles)$/ }));
    fireEvent.click(screen.getByRole('tab', { name: /컬러 팔레트|Color palettes/ }));
    expect(screen.getByText('Paper Dawn')).toBeTruthy();
    expect(screen.getByText('Opus Keynote Lime')).toBeTruthy();
    expect(screen.getAllByTestId('palette-card').length).toBeGreaterThanOrEqual(16);
  });

  it('shows technique cards on its tab', () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /^(스타일|Styles)$/ }));
    fireEvent.click(screen.getByRole('tab', { name: /구성 기법|Techniques/ }));
    expect(screen.getAllByTestId('technique-card').length).toBeGreaterThan(0);
  });
});
