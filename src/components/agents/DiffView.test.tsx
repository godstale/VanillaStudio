import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { DiffView } from '@/components/agents/DiffView';

describe('DiffView', () => {
  it('shows removed and added lines under before/after headers', () => {
    renderWithProviders(<DiffView path="a.txt" oldText={'one\ntwo'} newText={'one\nthree'} />);
    const view = screen.getByTestId('diff-view');
    expect(view.textContent).toContain('a.txt');
    expect(view.textContent).toContain('two');
    expect(view.textContent).toContain('three');
  });

  it('marks a missing old text as a new file', () => {
    renderWithProviders(<DiffView path="b.txt" newText={'hello'} />);
    expect(screen.getByTestId('diff-view').textContent).toContain('b.txt');
  });
});
