import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hideableFields, validateDraft, type TemplateDraft } from '@/lib/guides/templateEditor';
import { CUSTOM_FIELD_TYPES, PROMPT_NAMES, type CustomField, type GuideTemplate } from '@/lib/guides/template';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface TemplateEditorProps {
  draft: TemplateDraft;
  /** 부모(해석이 끝난 템플릿). 확장 규칙 검증에 쓴다. */
  parent: GuideTemplate;
  /** 새로 만드는 중이면 id를 바꿀 수 있다. */
  isNew: boolean;
  onSave: (draft: TemplateDraft) => Promise<void>;
  onCancel: () => void;
}

const area = 'min-h-20 w-full rounded-md border border-input bg-background px-2 py-1 text-xs';

/** "id|한국어|English" 한 줄에 선택지 하나. */
const optionsToText = (f: CustomField) => (f.options ?? []).map((o) => `${o.id}|${o.label.ko}|${o.label.en}`).join('\n');
function textToOptions(text: string): CustomField['options'] {
  const rows = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [id, ko, en] = l.split('|').map((p) => p.trim());
      return { id, label: { ko: ko || id, en: en || ko || id } };
    });
  return rows.length ? rows : undefined;
}

/** 사용자 정의 템플릿 편집기: 이름·숨길 필드·추가 필드·추가 규칙·체크리스트·프롬프트. 내장 스키마를 확장만 한다. */
export function TemplateEditor({ draft: initial, parent, isNew, onSave, onCancel }: TemplateEditorProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const check = useMemo(() => validateDraft(draft, parent), [draft, parent]);
  const set = (patch: Partial<TemplateDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setField = (i: number, patch: Partial<CustomField>) => set({ fields: draft.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  async function submit() {
    if (!check.ok) return;
    setBusy(true);
    setSaveError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="template-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-xs text-muted-foreground">{t('templates.extends', { parent: draft.extends })}</p>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          {t('templates.id')}
          <Input value={draft.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {t('templates.labelKo')}
          <Input value={draft.label.ko} onChange={(e) => set({ label: { ...draft.label, ko: e.target.value } })} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {t('templates.labelEn')}
          <Input value={draft.label.en} onChange={(e) => set({ label: { ...draft.label, en: e.target.value } })} />
        </label>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-semibold">{t('templates.hide')}</legend>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {hideableFields(draft.type).map((f) => (
            <label key={f} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.hide.includes(f)}
                onChange={(e) => set({ hide: e.target.checked ? [...draft.hide, f] : draft.hide.filter((x) => x !== f) })}
              />
              {f}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold">{t('templates.fields')}</legend>
        {draft.fields.map((f, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-2" data-testid="custom-field">
            <div className="grid grid-cols-4 gap-2">
              <Input aria-label={t('templates.fieldId')} placeholder={t('templates.fieldId')} value={f.id} onChange={(e) => setField(i, { id: e.target.value })} />
              <select
                aria-label={t('templates.fieldType')}
                value={f.type}
                onChange={(e) => setField(i, { type: e.target.value as CustomField['type'], default: undefined })}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                {CUSTOM_FIELD_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              <Input aria-label={t('templates.labelKo')} placeholder={t('templates.labelKo')} value={f.label.ko} onChange={(e) => setField(i, { label: { ...f.label, ko: e.target.value } })} />
              <Input aria-label={t('templates.labelEn')} placeholder={t('templates.labelEn')} value={f.label.en} onChange={(e) => setField(i, { label: { ...f.label, en: e.target.value } })} />
            </div>
            {(f.type === 'select' || f.type === 'multiselect') && (
              <textarea aria-label={t('templates.options')} placeholder={t('templates.optionsHint')} className={area} value={optionsToText(f)} onChange={(e) => setField(i, { options: textToOptions(e.target.value) })} />
            )}
            {(f.type === 'text' || f.type === 'longtext' || f.type === 'select') && (
              <Input
                aria-label={t('templates.default')}
                placeholder={t('templates.default')}
                value={typeof f.default === 'string' ? f.default : ''}
                onChange={(e) => setField(i, { default: e.target.value === '' ? undefined : e.target.value })}
              />
            )}
            <div>
              <Button type="button" size="sm" variant="ghost" aria-label={t('templates.removeField')} onClick={() => set({ fields: draft.fields.filter((_, j) => j !== i) })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => set({ fields: [...draft.fields, { id: '', type: 'text', label: { ko: '', en: '' } }] })}>
            <Plus className="mr-1 h-3 w-3" />
            {t('templates.addField')}
          </Button>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-xs">
        {t('templates.rules')}
        <textarea className={area} value={draft.rules} onChange={(e) => set({ rules: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        {t('templates.checklist')}
        <textarea className={area} value={draft.checklist} onChange={(e) => set({ checklist: e.target.value })} />
      </label>
      {PROMPT_NAMES.map((p) => (
        <label key={p} className="flex flex-col gap-1 text-xs">
          {t('templates.prompt', { name: p })}
          <textarea className={area} placeholder={t('templates.promptInherit')} value={draft.prompts[p]} onChange={(e) => set({ prompts: { ...draft.prompts, [p]: e.target.value } })} />
        </label>
      ))}

      {!check.ok && (
        <p role="alert" className="text-xs text-destructive">
          {t('templates.invalid', { reason: check.error })}
        </p>
      )}
      {saveError && (
        <p role="alert" className="text-xs text-destructive">
          {saveError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!check.ok || busy}>
          {t('templates.save')}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          {t('templates.cancel')}
        </Button>
      </div>
    </form>
  );
}
