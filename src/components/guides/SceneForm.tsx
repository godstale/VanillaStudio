import { Input } from '@/components/ui/input';
import { customFormFields, getAt, setAt, visibleSections, type FormField } from '@/lib/guides/forms';
import type { GuideTemplate } from '@/lib/guides/template';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Scene } from '@/lib/scene/schema';
import type { Beat } from '@/lib/guides/beats';
import { BeatsEditor } from './BeatsEditor';
import { StepsEditor, type Step } from './StepsEditor';
import { StringList } from './StringList';
import { TermCombobox } from './TermCombobox';

export interface SceneFormProps {
  scene: Scene;
  /** 병합이 끝난 템플릿(용어집·숨김·추가 필드). */
  template: GuideTemplate;
  onChange: (scene: Scene) => void;
}

const area = 'min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

/** 템플릿 폼 정의(forms.ts)대로 신의 가이드 항목을 편집한다. 값은 점 경로로 읽고 쓴다. */
export function SceneForm({ scene, template, onChange }: SceneFormProps) {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const sections = visibleSections(scene, template.schema);
  const custom = customFormFields(template.schema.fields);
  const set = (path: string, value: unknown) => onChange(setAt(scene, path, value));

  const labelOf = (field: FormField): string => {
    if (field.path.startsWith('custom.')) {
      const id = field.path.slice('custom.'.length);
      return template.schema.fields.find((f) => f.id === id)?.label[lang] ?? id;
    }
    return t(`form.${field.path}`);
  };

  function control(field: FormField) {
    const value = getAt(scene, field.path);
    const label = labelOf(field);
    switch (field.widget) {
      case 'text':
        return <Input aria-label={label} value={(value as string | undefined) ?? ''} onChange={(e) => set(field.path, e.target.value)} />;
      case 'longtext':
        return (
          <textarea
            aria-label={label}
            className={area}
            value={(value as string | null | undefined) ?? ''}
            onChange={(e) => set(field.path, field.nullable && e.target.value === '' ? null : e.target.value)}
          />
        );
      case 'number':
        return (
          <Input
            aria-label={label}
            type="number"
            step="0.1"
            min={field.min}
            value={(value as number | undefined) ?? 0}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (e.target.value !== '' && Number.isFinite(n)) set(field.path, n);
            }}
          />
        );
      case 'bool':
        return (
          <input aria-label={label} type="checkbox" checked={Boolean(value)} onChange={(e) => set(field.path, e.target.checked)} className="h-4 w-4 self-start" />
        );
      case 'enum':
        return (
          <select
            aria-label={label}
            value={(value as string | undefined) ?? ''}
            onChange={(e) => set(field.path, e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {t(`form.opt.${o}`) === `form.opt.${o}` ? o : t(`form.opt.${o}`)}
              </option>
            ))}
          </select>
        );
      case 'term-single':
        return (
          <TermCombobox
            glossary={template.glossary}
            category={field.category!}
            multiple={false}
            label={label}
            value={value ? [value as string] : []}
            onChange={(v) => set(field.path, v[0] ?? '')}
          />
        );
      case 'term-multi':
        return <TermCombobox glossary={template.glossary} category={field.category!} label={label} value={(value as string[] | undefined) ?? []} onChange={(v) => set(field.path, v)} />;
      case 'string-list':
        return <StringList label={label} value={(value as string[] | undefined) ?? []} onChange={(v) => set(field.path, v)} />;
      case 'beats': {
        const timed = scene as Extract<Scene, { type: 'motion' | '3d' }>;
        return <BeatsEditor beats={timed.beats as Beat[]} duration={timed.duration.seconds} glossary={template.glossary} onChange={(beats) => set('beats', beats)} />;
      }
      case 'steps':
        return <StepsEditor steps={(value as Step[] | undefined) ?? []} glossary={template.glossary} onChange={(steps) => set('steps', steps)} />;
    }
  }

  const row = (field: FormField) => {
    const wide = field.widget === 'beats' || field.widget === 'steps';
    return (
      <div key={field.path} className="flex flex-col gap-1 text-xs">
        {!wide && <span className="text-muted-foreground">{labelOf(field)}</span>}
        {control(field)}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" data-testid="scene-form">
      {sections.map((s) => (
        <details key={s.id} open={s.id === 'structure' || s.id === 'page'} className="rounded-md border border-border">
          <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold">{t(`form.section.${s.id}`)}</summary>
          <div className="flex flex-col gap-3 p-2">{s.fields.map(row)}</div>
        </details>
      ))}
      {custom.length > 0 && (
        <details open className="rounded-md border border-border">
          <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold">{t('form.custom')}</summary>
          <div className="flex flex-col gap-3 p-2">{custom.map(row)}</div>
        </details>
      )}
    </div>
  );
}
