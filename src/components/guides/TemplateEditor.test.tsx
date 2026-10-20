import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { defaultTemplateFor } from '@/lib/guides/template';
import { duplicateDraft, type TemplateDraft } from '@/lib/guides/templateEditor';
import { TemplateEditor } from './TemplateEditor';

const parent = defaultTemplateFor('motion');

function setup(onSave = vi.fn(async (draft: TemplateDraft) => void draft)) {
  const onCancel = vi.fn();
  render(
    <LanguageProvider>
      <TemplateEditor draft={duplicateDraft(parent, 'house', { ko: '우리 회사', en: 'House style' })} parent={parent} isNew onSave={onSave} onCancel={onCancel} />
    </LanguageProvider>,
  );
  return { onSave, onCancel };
}

const save = () => screen.getByRole('button', { name: /^저장$|^Save$/ }) as HTMLButtonElement;

describe('TemplateEditor', () => {
  it('a plain duplicate is valid and saves as is', async () => {
    const { onSave } = setup();
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({ id: 'house', extends: 'commercial@1', hide: [], fields: [] });
  });

  it('hides fields, adds a select field with options and a rule, then saves them', async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByLabelText('audio'));
    fireEvent.click(screen.getByRole('button', { name: /필드 추가|Add field/ }));
    fireEvent.change(screen.getByLabelText(/필드 ID|Field ID/), { target: { value: 'tone' } });
    fireEvent.change(screen.getAllByLabelText(/이름\(한국어\)|Name \(Korean\)/)[1], { target: { value: '톤' } });
    fireEvent.change(screen.getAllByLabelText(/이름\(영어\)|Name \(English\)/)[1], { target: { value: 'Tone' } });
    fireEvent.change(screen.getByLabelText(/^종류$|^Type$/), { target: { value: 'select' } });
    fireEvent.change(screen.getByLabelText(/^선택지$|^Options$/), { target: { value: 'friendly|친근|Friendly\nformal|격식|Formal' } });
    fireEvent.change(screen.getByLabelText(/기본값|Default/), { target: { value: 'friendly' } });
    fireEvent.change(screen.getByLabelText(/추가 규칙|Additional rules/), { target: { value: 'Always end on the logo.' } });
    fireEvent.click(save());
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const d = onSave.mock.calls[0][0] as { hide: string[]; fields: { id: string; type: string; options: { id: string }[]; default: string }[]; rules: string };
    expect(d.hide).toEqual(['audio']);
    expect(d.fields[0]).toMatchObject({ id: 'tone', type: 'select', default: 'friendly' });
    expect(d.fields[0].options.map((o) => o.id)).toEqual(['friendly', 'formal']);
    expect(d.rules).toBe('Always end on the logo.');
  });

  it('blocks saving and explains why when the extension breaks a rule', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /필드 추가|Add field/ }));
    fireEvent.change(screen.getByLabelText(/필드 ID|Field ID/), { target: { value: 'beats' } }); // redefines a built-in field
    fireEvent.change(screen.getAllByLabelText(/이름\(한국어\)|Name \(Korean\)/)[1], { target: { value: '비트' } });
    fireEvent.change(screen.getAllByLabelText(/이름\(영어\)|Name \(English\)/)[1], { target: { value: 'Beats' } });
    expect(save().disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toMatch(/redefines a built-in/);
  });

  it('requires both label languages', () => {
    setup();
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '' } });
    expect(save().disabled).toBe(true);
  });

  it('shows a save error and stays open', async () => {
    setup(vi.fn(async (draft: TemplateDraft) => Promise.reject(new Error(`disk full ${draft.id}`))));
    fireEvent.click(save());
    expect((await screen.findByRole('alert')).textContent).toContain('disk full');
  });

  it('cancel does not save', () => {
    const { onSave, onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^취소$|^Cancel$/ }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
