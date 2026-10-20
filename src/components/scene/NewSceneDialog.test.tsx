import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { NewSceneDialog } from './NewSceneDialog';

function renderDialog(onCreate = vi.fn(async () => undefined), onOpenChange = vi.fn()) {
  render(
    <LanguageProvider>
      <NewSceneDialog open onOpenChange={onOpenChange} onCreate={onCreate} />
    </LanguageProvider>,
  );
  return { onCreate, onOpenChange };
}

const create = () => screen.getByRole('button', { name: /만들기|Create/ }) as HTMLButtonElement;

describe('NewSceneDialog', () => {
  it('needs a name', () => {
    renderDialog();
    expect(create().disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  ' } });
    expect(create().disabled).toBe(true);
  });

  it.each([
    ['static', 'web-page@1'],
    ['motion', 'commercial@1'],
    ['3d', 'three-scene@1'],
  ] as const)('creates a %s scene with its default template', async (type, template) => {
    const { onCreate, onOpenChange } = renderDialog();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' My Scene ' } });
    fireEvent.click(screen.getByDisplayValue(type));
    fireEvent.click(create());
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: 'My Scene', type, template: expect.objectContaining({ ref: template }) }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('recommends an Opus template from prompt input and shows preview & live demo link', async () => {
    const { onCreate } = renderDialog();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Morph Hero' } });
    fireEvent.change(screen.getByTestId('new-scene-prompt-input'), {
      target: { value: '120BPM UI state morph loop' },
    });
    expect(screen.getByTestId('selected-template-preview')).toBeTruthy();
    fireEvent.click(create());
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Morph Hero',
          type: 'motion',
          template: expect.objectContaining({ ref: 'opus-ui-morph-loop@1' }),
          initialBrief: { subject: '120BPM UI state morph loop' },
          initialUserPrompt: '120BPM UI state morph loop',
        }),
      ),
    );
  });

  it('shows the error and stays open when creating fails', async () => {
    const { onOpenChange } = renderDialog(vi.fn(async () => Promise.reject(new Error('disk full'))));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'X' } });
    fireEvent.click(create());
    expect((await screen.findByRole('alert')).textContent).toContain('disk full');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
