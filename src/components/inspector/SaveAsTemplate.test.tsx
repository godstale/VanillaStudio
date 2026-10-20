import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { SaveAsTemplate } from './SaveAsTemplate';

function setup(onSave: (name: string) => Promise<{ ref: string }>) {
  render(
    <LanguageProvider>
      <SaveAsTemplate onSave={onSave} />
    </LanguageProvider>,
  );
  const input = screen.getByLabelText(/템플릿 이름|Template name/) as HTMLInputElement;
  const button = screen.getByRole('button', { name: /템플릿 저장|Save template/ }) as HTMLButtonElement;
  return { input, button };
}

describe('SaveAsTemplate', () => {
  it('needs a name, then saves and confirms with the template ref', async () => {
    const onSave = vi.fn(async () => ({ ref: 'warm-promo@1' }));
    const { input, button } = setup(onSave);
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Warm promo' } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('warm-promo@1'));
    expect(onSave).toHaveBeenCalledWith('Warm promo');
    expect(input.value).toBe(''); // ready for another
  });

  it('explains an existing name instead of overwriting', async () => {
    const { input, button } = setup(async () => {
      throw new Error('template-exists');
    });
    fireEvent.change(input, { target: { value: 'Warm promo' } });
    fireEvent.click(button);
    expect((await screen.findByRole('alert')).textContent).toMatch(/이미 있습니다|already exists/);
  });

  it('shows other failures with their reason', async () => {
    const { input, button } = setup(async () => {
      throw new Error('beats: must add up');
    });
    fireEvent.change(input, { target: { value: 'X' } });
    fireEvent.click(button);
    expect((await screen.findByRole('alert')).textContent).toContain('beats: must add up');
  });
});
