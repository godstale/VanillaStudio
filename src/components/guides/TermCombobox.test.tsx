import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { defaultTemplateFor } from '@/lib/guides/template';
import { TermCombobox } from './TermCombobox';

const glossary = defaultTemplateFor('motion').glossary;

function Harness({ initial = [], multiple = true, onChange }: { initial?: string[]; multiple?: boolean; onChange?: (v: string[]) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <LanguageProvider>
      <TermCombobox
        glossary={glossary}
        category="camera"
        label="Camera"
        multiple={multiple}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    </LanguageProvider>
  );
}

const box = () => screen.getByRole('combobox', { name: 'Camera' });

describe('TermCombobox', () => {
  it('lists terms on focus and picks one by click, storing the id', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(box());
    expect(screen.getAllByRole('option').length).toBeGreaterThan(5);
    fireEvent.mouseDown(screen.getByText(/푸시인|Push-in/));
    expect(onChange).toHaveBeenLastCalledWith(['push-in']);
    expect(screen.getByText(/푸시인|Push-in/)).toBeTruthy();
  });

  it('filters by search in either language', () => {
    render(<Harness />);
    fireEvent.change(box(), { target: { value: 'crane' } });
    expect(screen.getAllByRole('option')).toHaveLength(1); // exact id match: no "add custom" row
    fireEvent.change(box(), { target: { value: 'cran' } });
    expect(screen.getAllByRole('option')).toHaveLength(2); // the term + "add custom"
    fireEvent.change(box(), { target: { value: '크레인' } });
    expect(screen.getAllByRole('option').some((o) => /크레인|Crane/.test(o.textContent ?? ''))).toBe(true);
  });

  it('supports multiple values and hides picked ones from the list', () => {
    render(<Harness initial={['push-in']} />);
    fireEvent.focus(box());
    expect(screen.getAllByRole('option').some((o) => /^(푸시인|Push-in)/.test(o.textContent ?? ''))).toBe(false);
  });

  it('accepts free input as a custom value', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(box(), { target: { value: 'wobble cam' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /wobble cam/ }));
    expect(onChange).toHaveBeenLastCalledWith(['wobble cam']);
  });

  it('works from the keyboard: arrows, Enter, Backspace, Escape', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(box());
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledOnce();
    const first = onChange.mock.calls[0][0];
    expect(first).toHaveLength(1);
    fireEvent.keyDown(box(), { key: 'Backspace' });
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('removes a chip with its button', () => {
    const onChange = vi.fn();
    render(<Harness initial={['push-in', 'crane']} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onChange).toHaveBeenLastCalledWith(['crane']);
  });

  it('single mode replaces the value', () => {
    const onChange = vi.fn();
    render(<Harness initial={['push-in']} multiple={false} onChange={onChange} />);
    fireEvent.focus(box());
    fireEvent.mouseDown(screen.getByText(/크레인|Crane/));
    expect(onChange).toHaveBeenLastCalledWith(['crane']);
  });

  it('shows the definition as a tooltip', () => {
    render(<Harness />);
    fireEvent.focus(box());
    const option = screen.getAllByRole('option')[0];
    expect(option.getAttribute('title')).toBeTruthy();
  });
});
