import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface SaveAsTemplateProps {
  /** 저장한다. 실패하면 던진다(`template-exists`·`name-required`·검증 이유). */
  onSave: (name: string) => Promise<{ ref: string }>;
}

/** 이 신의 구조를 신 템플릿으로 저장한다(T7.3). 내용은 비우고 가이드는 그대로 상속한다. */
export function SaveAsTemplate({ onSave }: SaveAsTemplateProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setSaved(null);
    setError(null);
    try {
      const r = await onSave(name);
      setSaved(r.ref);
      setName('');
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(m === 'template-exists' ? t('saveTemplate.exists') : m === 'name-required' ? t('saveTemplate.nameRequired') : t('saveTemplate.failed', { error: m }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded border border-border p-2 text-xs" data-testid="save-as-template">
      <summary className="cursor-pointer font-medium">{t('saveTemplate.title')}</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-muted-foreground">{t('saveTemplate.hint')}</p>
        <div className="flex gap-2">
          <Input value={name} placeholder={t('saveTemplate.name')} aria-label={t('saveTemplate.name')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && void run()} />
          <Button size="sm" variant="outline" disabled={busy || !name.trim()} onClick={() => void run()}>
            {t('saveTemplate.save')}
          </Button>
        </div>
        {saved && (
          <p role="status" className="text-success">
            {t('saveTemplate.saved', { ref: saved })}
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
