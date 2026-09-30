import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { TemplateGallery } from './TemplateGallery';

function renderGallery(onSelect?: (id: string) => void) {
  renderWithProviders(<TemplateGallery onSelect={onSelect} />);
}

describe('TemplateGallery', () => {
  it('shows the three built-in templates with preview, tags and types', () => {
    renderGallery();
    for (const id of ['editorial-slides', 'product-showcase-video', 'kinetic-type-web']) {
      expect(screen.getByTestId(`template-card-${id}`)).toBeTruthy();
      expect(screen.getByTestId(`template-preview-${id}`).innerHTML).toContain('<svg');
    }
    // Type badges reuse the project type labels.
    expect(screen.getAllByText('슬라이드').length).toBeGreaterThan(0);
  });

  it('filters by search text, output type and tag', () => {
    renderGallery();
    fireEvent.change(screen.getByTestId('template-search'), { target: { value: 'showcase' } });
    expect(screen.queryByTestId('template-card-editorial-slides')).toBeNull();
    expect(screen.getByTestId('template-card-product-showcase-video')).toBeTruthy();

    fireEvent.change(screen.getByTestId('template-search'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('template-type-video'));
    expect(screen.queryByTestId('template-card-kinetic-type-web')).toBeNull();
    expect(screen.getByTestId('template-card-product-showcase-video')).toBeTruthy();

    fireEvent.click(screen.getByTestId('template-type-all'));
    fireEvent.change(screen.getByTestId('template-tag'), { target: { value: 'typography' } });
    expect(screen.queryByTestId('template-card-editorial-slides')).toBeNull();
    expect(screen.getByTestId('template-card-kinetic-type-web')).toBeTruthy();

    fireEvent.change(screen.getByTestId('template-search'), { target: { value: 'no-such-template' } });
    expect(screen.getByTestId('template-empty')).toBeTruthy();
  });

  it('re-tints the card preview when the palette changes', () => {
    renderGallery();
    const preview = screen.getByTestId('template-preview-editorial-slides');
    const before = preview.style.getPropertyValue('--color-canvas');
    expect(before).not.toBe('');
    fireEvent.change(screen.getByTestId('template-palette-editorial-slides'), { target: { value: 'forest-mist' } });
    const after = screen.getByTestId('template-preview-editorial-slides').style.getPropertyValue('--color-canvas');
    expect(after).not.toBe('');
    expect(after).not.toBe(before);
  });

  it('selects a card and reports the id', () => {
    const onSelect = vi.fn();
    renderGallery(onSelect);
    fireEvent.click(screen.getByTestId('template-select-kinetic-type-web'));
    expect(onSelect).toHaveBeenCalledWith('kinetic-type-web');
    expect(screen.getByTestId('template-select-kinetic-type-web').getAttribute('aria-pressed')).toBe('true');
  });
});
