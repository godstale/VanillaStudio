import { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface StringListProps {
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
}

/** 자유 문자열 목록(화면 문구 원문·제약 등). 입력 후 Enter로 추가, 칩의 X로 삭제. 원문 보존을 위해 앞뒤 공백만 다듬는다. */
export function StringList({ value, onChange, label }: StringListProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');

  function commit() {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft('');
  }

  return (
    <div className="flex flex-col gap-1">
      {value.length > 0 && (
        <ul className="flex flex-col gap-1">
          {value.map((v, i) => (
            <li key={`${v}-${i}`} className="flex items-start gap-2 rounded border border-border bg-muted px-2 py-1 text-xs">
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{v}</span>
              <button type="button" aria-label={t('form.listRemove', { value: v })} onClick={() => onChange(value.filter((_, j) => j !== i))} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        aria-label={label}
        value={draft}
        placeholder={t('form.listPlaceholder')}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      />
    </div>
  );
}
