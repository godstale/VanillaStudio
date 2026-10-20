import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { StoryboardFile } from '@/lib/storyboard/schema';

interface Props {
  brief: string | null;
  flow: string | null;
  visual: string | null;
  file: StoryboardFile;
}

function Card({ title, body, extra }: { title: string; body: string | null; extra?: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <section className="space-y-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-bold">{title}</h2>
      {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded border border-border px-2 py-1 text-xs hover:bg-accent">
          {t('storyboard.viewDoc')}
        </button>
      ) : (
        <>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{body ?? t('storyboard.empty')}</pre>
          <button type="button" onClick={() => setOpen(false)} className="rounded border border-border px-2 py-1 text-xs hover:bg-accent">
            {t('float.close')}
          </button>
        </>
      )}
    </section>
  );
}

/** 1층: 3대 문서 시각 카드. */
export function ThreePillarCards({ brief, flow, visual, file }: Props) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card title={t('storyboard.briefCard')} body={brief} extra={[file.brief?.title, file.brief?.oneLiner].filter(Boolean).join(' — ') || undefined} />
      <Card title={t('storyboard.flowCard')} body={flow} extra={file.designFlow.narrativeArc || undefined} />
      <Card title={t('storyboard.visualCard')} body={visual} extra={file.visualDirection.moodKeywords.join(', ') || undefined} />
    </div>
  );
}
