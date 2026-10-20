import { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder, type ViewUpdate } from '@codemirror/view';

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  minHeight?: string;
}

// 앱 시맨틱 토큰(DESIGN.md §3.3)으로 칠한다. 테마 전환은 CSS 변수가 맡는다.
const theme = EditorView.theme({
  '&': { backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--input))', borderRadius: '6px', fontSize: '12px' },
  '&.cm-focused': { outline: '2px solid hsl(var(--ring))' },
  '.cm-content': { caretColor: 'hsl(var(--foreground))', padding: '6px 0' },
  '.cm-cursor': { borderLeftColor: 'hsl(var(--foreground))' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'hsl(var(--accent))' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.5' },
});

/** 마크다운 편집기(CodeMirror 6). 값은 부모가 쥐고, 바깥에서 값이 바뀌면 문서를 교체한다. */
export function MarkdownEditor({ value, onChange, label, placeholder, minHeight = '8rem' }: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          theme,
          EditorView.contentAttributes.of({ 'aria-label': label, 'aria-multiline': 'true' }),
          ...(placeholder ? [cmPlaceholder(placeholder)] : []),
          EditorView.updateListener.of((u: ViewUpdate) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // 편집기는 한 번만 만들고, 이후 값은 아래 효과로 동기화한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} data-testid="markdown-editor" style={{ minHeight }} />;
}
