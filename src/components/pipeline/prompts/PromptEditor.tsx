import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView, keymap, type ViewUpdate } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface PromptEditorProps {
  /** Project-relative path shown above the editor (the file is saved by the parent). */
  file: string;
  value: string;
  onChange: (next: string) => void;
}

/** Compact markdown editor for one prompt file. The parent owns loading and saving. */
export function PromptEditor({ file, value, onChange }: PromptEditorProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    const view = new EditorView({
      parent: containerRef.current,
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([...defaultKeymap, indentWithTab]),
        markdown(),
        EditorView.theme({
          '&': { backgroundColor: 'transparent', fontSize: '13px', height: '100%' },
          '.cm-content': { fontFamily: 'var(--font-mono, monospace)' },
          '.cm-scroller': { overflow: 'auto' },
        }),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Rebuilt when switching files; keystrokes stay inside one mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // The parent replaces the doc when another file is selected or reloaded.
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <div data-testid="prompt-editor" className="flex h-full min-h-0 flex-col">
      <p data-testid="prompt-editor-file" className="truncate px-1 pb-1 font-mono text-xs text-muted-foreground">
        {file}
      </p>
      <div
        ref={containerRef}
        role="textbox"
        aria-label={t('pipeline.prompts.editor')}
        aria-multiline="true"
        tabIndex={0}
        data-testid="prompt-editor-body"
        className="min-h-0 flex-1 overflow-auto rounded-md border border-input bg-transparent"
      />
    </div>
  );
}

export default PromptEditor;
