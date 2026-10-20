import { useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { searchTerms, termLabel } from '@/lib/guides/glossary';
import type { Glossary } from '@/lib/guides/template';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

export interface TermComboboxProps {
  glossary: Glossary;
  category: string;
  /** 저장된 값: 용어 ID 또는 자유 입력 문자열. */
  value: string[];
  onChange: (value: string[]) => void;
  /** false면 하나만 고른다(고르면 이전 값을 대체). */
  multiple?: boolean;
  label: string;
}

/** 용어집 드롭다운: 검색·다중 선택·자유 입력·툴팁 정의. 저장은 용어 ID(자유 입력은 입력 문자열 그대로). */
export function TermCombobox({ glossary, category, value, onChange, multiple = true, label }: TermComboboxProps) {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => searchTerms(glossary, category, query).filter((x) => !value.includes(x.id)), [glossary, category, query, value]);
  const typed = query.trim();
  const canAddCustom = typed !== '' && !value.includes(typed) && !searchTerms(glossary, category, typed).some((x) => x.id === typed || x.label[lang] === typed);
  const options: { key: string; id: string; text: string; hint?: string; custom?: boolean }[] = [
    ...matches.map((x) => ({ key: x.id, id: x.id, text: x.label[lang], hint: x.definition[lang] })),
    ...(canAddCustom ? [{ key: `custom:${typed}`, id: typed, text: t('terms.addCustom', { value: typed }), custom: true }] : []),
  ];

  function pick(id: string) {
    onChange(multiple ? [...value, id] : [id]);
    setQuery('');
    setActive(0);
    if (!multiple) setOpen(false);
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = options[active] ?? options[0];
      if (o) pick(o.id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && query === '' && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  return (
    <div className="relative text-sm">
      <div
        className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-xs" title={glossary.terms.find((x) => x.category === category && x.id === v)?.definition[lang]}>
            {termLabel(glossary, category, v, lang)}
            <button type="button" aria-label={t('terms.remove', { value: termLabel(glossary, category, v, lang) })} onClick={() => remove(v)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder={value.length === 0 ? t('terms.placeholder') : ''}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="min-w-24 flex-1 bg-transparent text-xs outline-none"
        />
      </div>
      {open && options.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {options.map((o, i) => (
            <li
              key={o.key}
              role="option"
              aria-selected={i === active}
              title={o.hint}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o.id);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('cursor-pointer rounded px-2 py-1 text-xs', i === active && 'bg-accent', o.custom && 'italic')}
            >
              <div>{o.text}</div>
              {o.hint && <div className="text-[11px] text-muted-foreground">{o.hint}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
