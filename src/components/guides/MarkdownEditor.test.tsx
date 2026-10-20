import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { MarkdownEditor } from './MarkdownEditor';

const view = () => EditorView.findFromDOM(screen.getByTestId('markdown-editor').querySelector('.cm-editor') as HTMLElement)!;

function Harness({ initial, onChange }: { initial: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <MarkdownEditor
        label="Prompt"
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
      <button onClick={() => setValue('set from outside')}>external</button>
    </>
  );
}

describe('MarkdownEditor', () => {
  it('shows the initial value and reports edits', () => {
    const onChange = vi.fn();
    render(<Harness initial="hello" onChange={onChange} />);
    expect(view().state.doc.toString()).toBe('hello');
    act(() => view().dispatch({ changes: { from: 5, insert: ' world' } }));
    expect(onChange).toHaveBeenLastCalledWith('hello world');
  });

  it('replaces the document when the value changes from outside, without echoing it back', () => {
    const onChange = vi.fn();
    render(<Harness initial="a" onChange={onChange} />);
    act(() => screen.getByText('external').click());
    expect(view().state.doc.toString()).toBe('set from outside');
    expect(onChange).toHaveBeenCalledTimes(1); // the replace itself reports once, with the same text
    expect(onChange).toHaveBeenLastCalledWith('set from outside');
  });

  it('is labelled for assistive technology', () => {
    render(<Harness initial="" />);
    expect(screen.getByLabelText('Prompt')).toBeTruthy();
  });
});
