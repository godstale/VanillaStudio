import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { buildAdvance, parseAdvance, type AdvanceKind as Kind } from '@/lib/guides/advance';
import type { Glossary } from '@/lib/guides/template';
import { TermCombobox } from './TermCombobox';

export interface Step {
  id: string;
  title: string;
  copy: string;
  layout: string;
  enter: string;
  advance: string;
}

export interface StepsEditorProps {
  steps: Step[];
  glossary: Glossary;
  onChange: (steps: Step[]) => void;
}

function nextId(steps: Step[]): string {
  const used = new Set(steps.map((s) => s.id));
  for (let n = steps.length + 1; ; n++) if (!used.has(`s${n}`)) return `s${n}`;
}

/** 정적 페이지의 스텝 편집기: 제목·문구·레이아웃·등장 방식·진행 입력(클릭/키/선택지). */
export function StepsEditor({ steps, glossary, onChange }: StepsEditorProps) {
  const { t } = useLanguage();
  const set = (i: number, patch: Partial<Step>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="flex flex-col gap-3" data-testid="steps-editor">
      {steps.length === 0 && <p className="text-xs text-muted-foreground">{t('steps.empty')}</p>}
      {steps.map((s, i) => {
        const { kind, arg } = parseAdvance(s.advance);
        const needsArg = kind !== 'click';
        const invalid = needsArg && arg.trim() === '';
        return (
          <fieldset key={s.id} className="flex flex-col gap-2 rounded-md border border-border p-2">
            <legend className="px-1 text-xs font-semibold">{s.id}</legend>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t('steps.title')}
              <Input value={s.title} onChange={(e) => set(i, { title: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t('steps.copy')}
              <textarea className="min-h-12 w-full rounded-md border border-input bg-background px-2 py-1 text-xs" value={s.copy} onChange={(e) => set(i, { copy: e.target.value })} />
            </label>
            <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t('steps.layout')}
              <TermCombobox glossary={glossary} category="layout" multiple={false} label={`${s.id} ${t('steps.layout')}`} value={s.layout ? [s.layout] : []} onChange={(v) => set(i, { layout: v[0] ?? '' })} />
            </div>
            <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t('steps.enter')}
              <TermCombobox glossary={glossary} category="enter" multiple={false} label={`${s.id} ${t('steps.enter')}`} value={s.enter ? [s.enter] : []} onChange={(v) => set(i, { enter: v[0] ?? '' })} />
            </div>
            <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t('steps.advance')}
              <div className="flex gap-2">
                <select
                  aria-label={`${s.id} ${t('steps.advance')}`}
                  value={kind}
                  onChange={(e) => set(i, { advance: buildAdvance(e.target.value as Kind, kind === e.target.value ? arg : e.target.value === 'key' ? 'ArrowRight' : '') })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {(['click', 'key', 'choice'] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(`steps.advance.${k}`)}
                    </option>
                  ))}
                </select>
                {needsArg && (
                  <Input
                    aria-label={kind === 'key' ? t('steps.keyName') : t('steps.choiceLabel')}
                    placeholder={kind === 'key' ? t('steps.keyName') : t('steps.choiceLabel')}
                    value={arg}
                    onChange={(e) => set(i, { advance: buildAdvance(kind, e.target.value) })}
                  />
                )}
              </div>
              {invalid && <span role="alert" className="text-destructive">{t('steps.invalid')}</span>}
            </div>
            <div>
              <Button type="button" size="sm" variant="ghost" aria-label={`${t('steps.remove')} ${s.id}`} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </fieldset>
        );
      })}
      <div>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...steps, { id: nextId(steps), title: '', copy: '', layout: '', enter: 'fade', advance: 'click' }])}>
          <Plus className="mr-1 h-3 w-3" />
          {t('steps.add')}
        </Button>
      </div>
    </div>
  );
}
